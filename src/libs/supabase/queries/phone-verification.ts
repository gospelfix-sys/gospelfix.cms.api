import { randomInt } from 'crypto';
import { SolapiMessageService } from 'solapi';
import { createAdminClient } from '@/libs/supabase/admin';

const CODE_TTL_MS = 3 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * 발송 요청이 과도한 경우(재전송 쿨다운, 시간당 한도 초과) 던진다.
 * 라우트에서 429로 매핑한다.
 */
export class PhoneRateLimitError extends Error {}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');
}

/**
 * 카카오 알림톡(인증번호 템플릿)으로 발송한다. SMS 대체발송은 쓰지 않는다
 * (disableSms: true — 발신번호 없이 카카오 채널명으로만 발송).
 * env 변수가 하나라도 없으면 콘솔 로그로 대체한다.
 * 운영 환경에서는 조용히 목업으로 빠지면 인증 코드가 미발송된 채 성공 처리되므로 예외를 던진다.
 */
async function sendVerificationSms(phone: string, code: string): Promise<void> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.SOLAPI_KAKAO_PFID;
  const templateId = process.env.SOLAPI_KAKAO_TEMPLATE_ID;

  if (!apiKey || !apiSecret || !pfId || !templateId) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '카카오 알림톡 발송 설정(SOLAPI_API_KEY/SECRET/KAKAO_PFID/KAKAO_TEMPLATE_ID)이 누락되었습니다.',
      );
    }
    console.log(
      `[KAKAO MOCK] ${maskPhone(phone)} 로 인증번호 발송: ${code} (3분 내 유효, 개발 환경 전용)`,
    );
    return;
  }

  const messageService = new SolapiMessageService(apiKey, apiSecret);
  const result = await messageService.send({
    to: phone,
    kakaoOptions: {
      pfId,
      templateId,
      variables: { 인증번호: code },
      disableSms: true,
    },
  });
  console.log(
    `[KAKAO SENT] ${maskPhone(phone)} groupId=${result.groupInfo.groupId} status=${result.groupInfo.status}`,
  );
}

/**
 * 휴대폰 인증번호를 생성해 phone_verifications에 저장하고 발송한다.
 * 재전송 쿨다운(60초)과 시간당 발송 횟수(5회) 제한은 DB 함수
 * `create_phone_verification_code` 안에서 advisory lock으로 원자적으로 검사한다
 * (애플리케이션 레벨 SELECT-then-INSERT는 동시 요청 시 TOCTOU 레이스로 우회될 수 있어 제외).
 */
export async function createPhoneVerificationCode(
  phone: string,
): Promise<void> {
  const supabase = createAdminClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { data, error } = await supabase.rpc('create_phone_verification_code', {
    p_phone: phone,
    p_code: code,
    p_expires_at: expiresAt,
    p_cooldown_seconds: RESEND_COOLDOWN_SECONDS,
    p_max_per_hour: MAX_SENDS_PER_HOUR,
  });
  if (error) throw new Error(error.message);

  if (data === 'cooldown') {
    throw new PhoneRateLimitError('잠시 후 다시 시도해주세요.');
  }
  if (data === 'limit_exceeded') {
    throw new PhoneRateLimitError(
      '인증번호 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.',
    );
  }

  try {
    await sendVerificationSms(phone, code);
  } catch (err) {
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('phone', phone)
      .eq('code', code);
    throw err;
  }
}

/**
 * 인증번호를 검증하고, 성공 시 회원가입 단계에서 제시할 1회용 토큰을 발급한다.
 * DB 함수 `verify_phone_verification_code`가 advisory lock + row lock으로
 * 시도 횟수를 원자적으로 증가시키고, MAX_VERIFY_ATTEMPTS 초과 시 코드를 즉시
 * 폐기(consumed)해 brute force를 막는다.
 */
export async function verifyPhoneCode(
  phone: string,
  code: string,
): Promise<{ verified: boolean; token?: string }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('verify_phone_verification_code', {
    p_phone: phone,
    p_code: code,
    p_max_attempts: MAX_VERIFY_ATTEMPTS,
  });
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row || !row.verified) return { verified: false };
  return { verified: true, token: row.token };
}

async function findValidPhoneVerificationCandidate(
  phone: string,
  token: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const tokenNotBefore = new Date(Date.now() - TOKEN_TTL_MS).toISOString();

  const { data: candidate, error } = await supabase
    .from('phone_verifications')
    .select('id')
    .eq('phone', phone)
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
 * 소비를 원자적으로 막으므로, 반드시 auth.signUp() **이전에** 호출해 같은 인증으로
 * 계정이 중복 생성되는 것을 막아야 한다(먼저 유효성만 확인하고 소비를 뒤로 미루면 그
 * 사이 시간 창에 동시 요청이 둘 다 통과해버리는 TOCTOU 레이스가 생긴다).
 * signUp이 이메일 중복 등 이후 단계에서 실패하면 restorePhoneVerificationToken(id)로
 * 되돌려, 사용자가 휴대폰 인증부터 다시 하지 않고 재시도할 수 있게 한다.
 * 인증 후 TOKEN_TTL_MS 이내에만 유효하다. verifyPhoneCode와 동일한 CAS 패턴이다.
 */
export async function consumePhoneVerificationToken(
  phone: string,
  token: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const candidateId = await findValidPhoneVerificationCandidate(phone, token);
  if (!candidateId) return null;

  const { data, error } = await supabase
    .from('phone_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', candidateId)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? candidateId : null;
}

/**
 * consumePhoneVerificationToken으로 방금 소비한 토큰을, 회원가입이 이후 단계(이메일 중복
 * 등)에서 실패했을 때 다시 유효한 상태로 되돌린다. 이 호출 사이 다른 요청이 같은 row를
 * 건드릴 수 없으므로(우리가 방금 원자적으로 점유했음) 별도 CAS 조건 없이 되돌려도 안전하다.
 */
export async function restorePhoneVerificationToken(candidateId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('phone_verifications')
    .update({ consumed_at: null })
    .eq('id', candidateId);

  if (error) throw new Error(error.message);
}
