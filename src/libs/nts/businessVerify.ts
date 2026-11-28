// 국세청 사업자등록정보 진위확인(공공데이터포털). 번호·대표자·개업일자·상호가 모두 일치해야 통과한다.
// 서비스키는 서버 환경변수 NTS_SERVICE_KEY. 요청·응답 본문은 개인정보라 로그에 남기지 않는다.

const VALIDATE_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/validate';
const STATUS_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status';
const REQUEST_TIMEOUT_MS = 5000;

export class BusinessVerifyError extends Error {}

export interface BusinessVerifyInput {
  businessNumber: string;
  representativeName: string;
  // 사용자가 입력한 상호. 빠뜨리면 아무 상호나 저장되므로 국세청에도 함께 보내 대조한다
  businessName: string;
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
 * 사업장 주소의 최소 형식 검사. 국세청 진위확인에는 주소 항목이 없어 실재·소유 여부는 확인하지 못하고,
 * 한글·숫자(번지·건물번호)·행정구역/도로명 단위가 모두 있는 문자열만 통과시켜 임의 문자열을 거른다.
 * 앱의 isValidBusinessAddress(sellerIdentityValidation.ts)와 같은 규칙이다.
 */
export function isValidBusinessAddress(value: string): boolean {
  const address = value.trim();
  return (
    address.length >= 8 &&
    /[가-힣]/.test(address) &&
    /\d/.test(address) &&
    /(시|도|군|구|읍|면|동|리|로|길)/.test(address)
  );
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
              b_nm: input.businessName,
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

export type SellerTaxType = 'general' | 'simplified' | 'exempt' | 'other';

/**
 * 국세청 상태조회(status)로 과세유형을 정한다. 부가세 가산은 일반과세자에게만 하므로
 * 계속사업자(b_stt_cd=01)이면서 tax_type_cd=01인 경우만 general이다.
 * 휴·폐업이거나 코드를 모르는 값이면 other, 국세청에 없는 번호면 null(미확인)이다.
 * 서비스키 누락·통신 실패는 BusinessVerifyError로 던진다.
 */
export async function fetchBusinessTaxType(
  businessNumber: string,
): Promise<SellerTaxType | null> {
  const serviceKey = process.env.NTS_SERVICE_KEY;
  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new BusinessVerifyError(
        '사업자 확인 서비스 설정(NTS_SERVICE_KEY)이 누락되었습니다.',
      );
    }
    console.log(
      '[NTS MOCK] NTS_SERVICE_KEY 없음 — 개발 환경이라 일반과세자로 처리',
    );
    return 'general';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${STATUS_URL}?serviceKey=${encodeURIComponent(serviceKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: [businessNumber] }),
        signal: controller.signal,
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      throw new BusinessVerifyError(
        `국세청 상태조회 요청이 실패했습니다. (${res.status})`,
      );
    }
    const json = (await res.json()) as {
      data?: Array<{ b_stt_cd?: string; tax_type_cd?: string }>;
    };
    const row = json.data?.[0];
    // 등록되지 않은 번호는 b_stt_cd·tax_type_cd가 빈 값으로 온다
    if (!row?.b_stt_cd) return null;
    if (row.b_stt_cd !== '01') return 'other';
    switch (row.tax_type_cd) {
      case '01':
        return 'general';
      case '02':
      case '07':
        return 'simplified';
      case '03':
      case '04':
        return 'exempt';
      default:
        return 'other';
    }
  } catch (err) {
    if (err instanceof BusinessVerifyError) throw err;
    throw new BusinessVerifyError('국세청 상태조회 중 오류가 발생했습니다.');
  } finally {
    clearTimeout(timer);
  }
}
