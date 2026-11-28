// 국세청 사업자등록정보 진위확인(공공데이터포털). 번호·대표자·개업일자가 모두 일치해야 통과한다.
// 서비스키는 서버 환경변수 NTS_SERVICE_KEY. 요청·응답 본문은 개인정보라 로그에 남기지 않는다.

const VALIDATE_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/validate';
const REQUEST_TIMEOUT_MS = 5000;

export class BusinessVerifyError extends Error {}

export interface BusinessVerifyInput {
  businessNumber: string;
  representativeName: string;
  // YYYYMMDD
  openedAt: string;
}

/** 사업자등록번호 10자리 체크섬 검증. 국세청 API를 부르기 전에 명백한 오타를 거른다. */
export function isValidBusinessNumber(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const digits = value.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += digits[i] * weights[i];
  sum += Math.floor((digits[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}

/**
 * 국세청에 사업자 정보가 일치하는지 묻는다. 일치하면 true, 불일치면 false.
 * 서비스키 누락·통신 실패는 BusinessVerifyError로 던진다(운영에서 조용히 통과시키지 않기 위해).
 */
export async function verifyBusinessWithNts(
  input: BusinessVerifyInput,
): Promise<boolean> {
  const serviceKey = process.env.NTS_SERVICE_KEY;
  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new BusinessVerifyError(
        '사업자 확인 서비스 설정(NTS_SERVICE_KEY)이 누락되었습니다.',
      );
    }
    console.log('[NTS MOCK] NTS_SERVICE_KEY 없음 — 개발 환경이라 통과 처리');
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${VALIDATE_URL}?serviceKey=${encodeURIComponent(serviceKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businesses: [
            {
              b_no: input.businessNumber,
              start_dt: input.openedAt,
              p_nm: input.representativeName,
            },
          ],
        }),
        signal: controller.signal,
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      throw new BusinessVerifyError(
        `국세청 확인 요청이 실패했습니다. (${res.status})`,
      );
    }
    const json = (await res.json()) as { data?: Array<{ valid?: string }> };
    return json.data?.[0]?.valid === '01';
  } catch (err) {
    if (err instanceof BusinessVerifyError) throw err;
    throw new BusinessVerifyError('국세청 확인 요청 중 오류가 발생했습니다.');
  } finally {
    clearTimeout(timer);
  }
}
