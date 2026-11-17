import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// 정산 계좌번호 암호화(AES-256-GCM). 키는 서버 환경변수에만 두고 코드·로그에 남기지 않는다.
// 형식: v1:<iv>:<authTag>:<ciphertext> (각 base64). 버전 접두사는 키·알고리즘 교체에 대비한 것.
const VERSION = 'v1';

export class PayoutCryptoConfigError extends Error {}

function getKey(): Buffer {
  const raw = process.env.PAYOUT_ACCOUNT_ENCRYPTION_KEY;
  if (!raw) {
    throw new PayoutCryptoConfigError(
      'PAYOUT_ACCOUNT_ENCRYPTION_KEY가 설정되지 않았습니다.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new PayoutCryptoConfigError(
      'PAYOUT_ACCOUNT_ENCRYPTION_KEY는 base64로 인코딩한 32바이트여야 합니다.',
    );
  }
  return key;
}

export function encryptAccountNumber(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv, {
    authTagLength: 16,
  });
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function decryptAccountNumber(payload: string): string {
  const [version, iv, tag, data] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('지원하지 않는 암호문 형식입니다.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(iv, 'base64'),
    { authTagLength: 16 },
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
