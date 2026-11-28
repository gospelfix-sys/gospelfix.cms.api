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
import { normalizeEmail } from '@/libs/supabase/queries/email-verification';
import {
  upsertSellerIdentity,
  type SellerIdentityInput,
} from '@/libs/supabase/queries/seller-identity';
import {
  isValidBusinessAddress,
  isValidBusinessNumber,
  verifyBusinessWithNts,
  fetchBusinessTaxType,
  BusinessVerifyError,
  type SellerTaxType,
} from '@/libs/nts/businessVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SellerRequestBody {
  sellerType?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessNumber?: string;
  // 국세청 진위확인에만 쓰고 저장하지 않는다 (YYYYMMDD)
  businessOpenedAt?: string;
  mailOrderReportNumber?: string;
}

const MOBILE_REGEX = /^01[0-9]{8,9}$/;
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
  // 사업자는 대표자명이 있어 개인만 이름을 받는다
  const contactName = text(body.contactName, 50);
  if (sellerType === 'individual' && !contactName) {
    return badRequest('이름을 입력해주세요.');
  }
  const contactPhone = digits(body.contactPhone);
  if (!MOBILE_REGEX.test(contactPhone)) {
    return badRequest('올바른 휴대폰 번호를 입력해주세요.');
  }
  const contactEmail = normalizeEmail(body.contactEmail ?? '');
  if (!contactEmail) return badRequest('이메일을 입력해주세요.');
  // 연락처는 인증 없이 입력만 받는다. 신원 확인은 사업자는 국세청 진위확인, 개인은 관리자 승인이 맡는다

  const input: SellerIdentityInput = {
    sellerType,
    contactName,
    contactPhone,
    contactEmail,
  };

  let verifyBusiness: (() => Promise<boolean>) | null = null;
  if (sellerType === 'business') {
    const businessNumber = digits(body.businessNumber);
    const openedAt = digits(body.businessOpenedAt);
    input.businessName = text(body.businessName, 100);
    input.representativeName = text(body.representativeName, 50);
    input.businessAddress = text(body.businessAddress, 200);
    input.mailOrderReportNumber = text(body.mailOrderReportNumber, 50);
    input.businessNumber = businessNumber;

    if (
      !input.businessName ||
      !input.representativeName ||
      !input.businessAddress
    ) {
      return badRequest('상호, 대표자, 주소를 모두 입력해주세요.');
    }
    if (!isValidBusinessAddress(input.businessAddress)) {
      return badRequest(
        '사업장 주소를 정확히 입력해주세요. (예: 서울특별시 강남구 테헤란로 123)',
      );
    }
    if (!isValidBusinessNumber(businessNumber)) {
      return badRequest('사업자등록번호가 올바르지 않습니다.');
    }
    if (!OPENED_AT_REGEX.test(openedAt)) {
      return badRequest('개업일자를 8자리(YYYYMMDD)로 입력해주세요.');
    }
    verifyBusiness = () =>
      verifyBusinessWithNts({
        businessNumber,
        representativeName: input.representativeName as string,
        businessName: input.businessName as string,
        openedAt,
      });
  }

  try {
    const user = await requireBearerUser(request);

    // 기존 판매자는 신원정보만 새로 제출하고, 일반 회원은 판매자 신청 신호도 함께 남긴다
    const role = await getAdminProfileRole(user.id);
    if (role !== 'user' && role !== 'seller') {
      throw new AccountError(400, '이미 판매자이거나 신청할 수 없는 상태입니다.');
    }

    let businessVerified = false;
    let taxType: SellerTaxType | null = null;
    if (verifyBusiness) {
      businessVerified = await verifyBusiness();
      if (!businessVerified) {
        return badRequest(
          '국세청에 등록된 사업자 정보와 일치하지 않습니다. 사업자번호·상호·대표자·개업일자를 확인해주세요.',
        );
      }
    }

    if (input.businessNumber) {
      taxType = await fetchBusinessTaxType(input.businessNumber);
    }

    await upsertSellerIdentity(user.id, input, { businessVerified, taxType });
    if (role === 'user') await requestSellerRole(user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
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
