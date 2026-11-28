import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, requireAuthApiEnabled } from '@/libs/openapi/auth';
import {
  requireBearerUser,
  getAdminProfileRole,
  AdminAuthError,
} from '@/libs/supabase/queries/auth';
import {
  requestSellerRole,
  AccountError,
} from '@/libs/supabase/queries/account';
import {
  consumePhoneVerificationToken,
  restorePhoneVerificationToken,
} from '@/libs/supabase/queries/phone-verification';
import {
  consumeEmailVerificationToken,
  restoreEmailVerificationToken,
  normalizeEmail,
} from '@/libs/supabase/queries/email-verification';
import {
  upsertSellerIdentity,
  type SellerIdentityInput,
} from '@/libs/supabase/queries/seller-identity';
import {
  isValidBusinessNumber,
  verifyBusinessWithNts,
  BusinessVerifyError,
} from '@/libs/nts/businessVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SellerRequestBody {
  sellerType?: string;
  contactPhone?: string;
  phoneVerificationToken?: string;
  contactEmail?: string;
  emailVerificationToken?: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessNumber?: string;
  // 국세청 진위확인에만 쓰고 저장하지 않는다 (YYYYMMDD)
  businessOpenedAt?: string;
  mailOrderReportNumber?: string;
}

const MOBILE_REGEX = /^01[0-9]{8,9}$/;
// 사업장 전화는 지역번호·대표번호(15xx)도 허용한다
const BUSINESS_PHONE_REGEX = /^(0\d{1,2}\d{3,4}\d{4}|1\d{3}\d{4})$/;
const OPENED_AT_REGEX = /^\d{8}$/;

function digits(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function text(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const disabledError = await requireAuthApiEnabled('seller_request');
  if (disabledError) return disabledError;

  let body: SellerRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sellerType = body.sellerType;
  if (sellerType !== 'individual' && sellerType !== 'business') {
    return badRequest('판매자 유형을 선택해주세요.');
  }
  const contactPhone = digits(body.contactPhone);
  if (!MOBILE_REGEX.test(contactPhone)) {
    return badRequest('올바른 휴대폰 번호를 입력해주세요.');
  }
  const contactEmail = normalizeEmail(body.contactEmail ?? '');
  if (!contactEmail) return badRequest('이메일을 입력해주세요.');
  if (!body.phoneVerificationToken || !body.emailVerificationToken) {
    return badRequest('휴대폰과 이메일 인증을 완료해주세요.');
  }

  const input: SellerIdentityInput = {
    sellerType,
    contactPhone,
    contactEmail,
  };

  let verifyBusiness: (() => Promise<boolean>) | null = null;
  if (sellerType === 'business') {
    const businessNumber = digits(body.businessNumber);
    const businessPhone = digits(body.businessPhone);
    const openedAt = digits(body.businessOpenedAt);
    input.businessName = text(body.businessName, 100);
    input.representativeName = text(body.representativeName, 50);
    input.businessAddress = text(body.businessAddress, 200);
    input.mailOrderReportNumber = text(body.mailOrderReportNumber, 50);
    input.businessNumber = businessNumber;
    input.businessPhone = businessPhone;

    if (
      !input.businessName ||
      !input.representativeName ||
      !input.businessAddress ||
      !input.mailOrderReportNumber
    ) {
      return badRequest(
        '상호, 대표자, 주소, 통신판매업 신고번호를 모두 입력해주세요.',
      );
    }
    if (!isValidBusinessNumber(businessNumber)) {
      return badRequest('사업자등록번호가 올바르지 않습니다.');
    }
    if (!BUSINESS_PHONE_REGEX.test(businessPhone)) {
      return badRequest('올바른 사업장 전화번호를 입력해주세요.');
    }
    if (!OPENED_AT_REGEX.test(openedAt)) {
      return badRequest('개업일자를 8자리(YYYYMMDD)로 입력해주세요.');
    }
    verifyBusiness = () =>
      verifyBusinessWithNts({
        businessNumber,
        representativeName: input.representativeName as string,
        openedAt,
      });
  }

  let phoneTokenId: string | null = null;
  let emailTokenId: string | null = null;
  try {
    const user = await requireBearerUser(request);

    // 기존 판매자는 신원정보만 새로 제출하고, 일반 회원은 판매자 신청 신호도 함께 남긴다
    const role = await getAdminProfileRole(user.id);
    if (role !== 'user' && role !== 'seller') {
      throw new AccountError(400, '이미 판매자이거나 신청할 수 없는 상태입니다.');
    }

    // 국세청 확인은 토큰을 쓰기 전에 한다. 불일치로 막혀도 인증을 다시 하지 않게 하려는 순서다
    let businessVerified = false;
    if (verifyBusiness) {
      businessVerified = await verifyBusiness();
      if (!businessVerified) {
        return badRequest(
          '국세청에 등록된 사업자 정보와 일치하지 않습니다. 사업자번호·대표자·개업일자를 확인해주세요.',
        );
      }
    }

    phoneTokenId = await consumePhoneVerificationToken(
      contactPhone,
      body.phoneVerificationToken,
    );
    if (!phoneTokenId) {
      return badRequest('휴대폰 인증이 만료되었거나 올바르지 않습니다.');
    }
    emailTokenId = await consumeEmailVerificationToken(
      contactEmail,
      body.emailVerificationToken,
    );
    if (!emailTokenId) {
      await restorePhoneVerificationToken(phoneTokenId);
      phoneTokenId = null;
      return badRequest('이메일 인증이 만료되었거나 올바르지 않습니다.');
    }

    await upsertSellerIdentity(user.id, input, businessVerified);
    if (role === 'user') await requestSellerRole(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    // 저장 전에 실패했다면 인증번호를 다시 받지 않도록 토큰을 되돌린다
    try {
      if (phoneTokenId) await restorePhoneVerificationToken(phoneTokenId);
      if (emailTokenId) await restoreEmailVerificationToken(emailTokenId);
    } catch (restoreErr) {
      console.error('[auth/seller-request] 토큰 복구 실패:', restoreErr);
    }

    if (err instanceof AdminAuthError || err instanceof AccountError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof BusinessVerifyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error('[auth/seller-request] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
