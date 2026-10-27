import { randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { createAdminClient } from '@/libs/supabase/admin';

export const CODE_TTL_MS = 3 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * 발송 요청이 과도한 경우(재전송 쿨다운, 시간당 한도 초과) 던진다.
 * 라우트에서 429로 매핑한다.
 */
export class EmailRateLimitError extends Error {}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function maskEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

/** 이메일은 항상 소문자·공백 제거 형태로 저장·비교한다(DB 함수와 같은 규칙). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Gmail SMTP(앱 비밀번호)로 인증번호 메일을 발송한다.
 * env(GMAIL_USER/GMAIL_APP_PASSWORD)가 없으면 개발 환경에서만 콘솔 로그로 대체한다 —
 * 운영에서 조용히 목업으로 빠지면 코드가 미발송된 채 성공 처리되므로 예외를 던진다.
 */
async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '이메일 발송 설정(GMAIL_USER/GMAIL_APP_PASSWORD)이 누락되었습니다.',
      );
    }
    console.log(
      `[EMAIL MOCK] ${maskEmail(email)} 로 인증번호 발송: ${code} (3분 내 유효, 개발 환경 전용)`,
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10_000,
    socketTimeout: 10_000,
  });
  await transporter.sendMail({
    from: `GOSPELFIX <${user}>`,
    to: email,
    subject: '[GOSPELFIX] 이메일 인증번호 안내',
    html:
      `<p>회원가입 이메일 인증번호입니다.</p>` +
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>` +
      `<p>3분 이내에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>`,
  });
  console.log(`[EMAIL SENT] ${maskEmail(email)}`);
}

/**
 * 이메일 인증번호를 생성해 email_verifications에 저장하고 발송한다.
 * 재전송 쿨다운(60초)과 시간당 발송 횟수(5회) 제한은 DB 함수
 * `create_email_verification_code` 안에서 advisory lock으로 원자적으로 검사한다.
 */
export async function createEmailVerificationCode(
  rawEmail: string,
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const supabase = createAdminClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { data, error } = await supabase.rpc('create_email_verification_code', {
    p_email: email,
    p_code: code,
    p_expires_at: expiresAt,
    p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
    p_max_per_hour: MAX_SENDS_PER_HOUR,
  });
  if (error) throw new Error(error.message);

  if (data === 'cooldown') {
    throw new EmailRateLimitError('잠시 후 다시 시도해주세요.');
  }
  if (data === 'limit_exceeded') {
    throw new EmailRateLimitError(
      '인증번호 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.',
    );
  }

  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    const { error: cleanupError } = await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email)
      .eq('code', code);
    if (cleanupError) {
      console.error(
        '[email-verification] 발송 실패 row 정리 실패:',
        cleanupError,
      );
    }
    throw err;
  }
}

/**
 * 인증번호를 검증하고, 성공 시 회원가입 단계에서 제시할 1회용 토큰을 발급한다.
 * 시도 횟수 제한(MAX_VERIFY_ATTEMPTS 초과 시 코드 폐기)은 DB 함수가 원자적으로 처리한다.
 */
export async function verifyEmailCode(
  rawEmail: string,
  code: string,
): Promise<{ verified: boolean; token?: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('verify_email_verification_code', {
    p_email: normalizeEmail(rawEmail),
    p_code: code,
    p_max_attempts: MAX_VERIFY_ATTEMPTS,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row || !row.verified) return { verified: false };
  return { verified: true, token: row.token };
}

async function findValidEmailVerificationCandidate(
  email: string,
  token: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const tokenNotBefore = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  const { data: candidate, error } = await supabase
    .from('email_verifications')
    .select('id')
    .eq('email', email)
    .eq('verification_token', token)
    .is('consumed_at', null)
    .not('verified_at', 'is', null)
    .gt('verified_at', tokenNotBefore)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return candidate?.id ?? null;
}

/**
 * 토큰을 검증하고 소비(재사용 방지)한다. 성공하면 소비한 row의 id를, 유효하지 않으면
 * null을 반환한다. 조건부 UPDATE(CAS: `consumed_at IS NULL`일 때만 갱신)로 동시 이중
 * 소비를 막으므로 반드시 auth.signUp() **이전에** 호출한다. signUp이 이후 단계에서
 * 실패하면 restoreEmailVerificationToken(id)로 되돌려 인증부터 다시 하지 않게 한다.
 */
export async function consumeEmailVerificationToken(
  rawEmail: string,
  token: string,
): Promise<string | null> {
  const email = normalizeEmail(rawEmail);
  const supabase = createAdminClient();
  const candidateId = await findValidEmailVerificationCandidate(email, token);
  if (!candidateId) return null;

  const { data, error } = await supabase
    .from('email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', candidateId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? candidateId : null;
}

/** consumeEmailVerificationToken으로 방금 소비한 토큰을 다시 유효 상태로 되돌린다. */
export async function restoreEmailVerificationToken(
  candidateId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('email_verifications')
    .update({ consumed_at: null })
    .eq('id', candidateId);

  if (error) throw new Error(error.message);
}
