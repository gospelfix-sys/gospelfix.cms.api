import { createAdminClient } from '@/libs/supabase/admin';
import type { SellerTaxType } from '@/libs/nts/businessVerify';

// 판매자 신원정보. 휴대폰·이메일은 본인 확인용이라 구매자 공개 응답에 넣지 않는다.

export type SellerType = 'individual' | 'business';
export type SellerIdentityStatus = 'pending' | 'approved' | 'rejected';

export interface SellerIdentityInput {
  sellerType: SellerType;
  contactName?: string;
  contactPhone: string;
  contactEmail: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessNumber?: string;
  mailOrderReportNumber?: string;
}

export interface SellerIdentitySummary {
  sellerType: SellerType;
  contactName: string | null;
  contactPhone: string;
  phoneVerified: boolean;
  contactEmail: string;
  emailVerified: boolean;
  businessName: string | null;
  representativeName: string | null;
  businessAddress: string | null;
  businessNumber: string | null;
  mailOrderReportNumber: string | null;
  businessVerified: boolean;
  taxType: SellerTaxType | null;
  status: SellerIdentityStatus;
  submittedAt: string;
}

// 구매자에게 주문 전 공개하는 항목. 개인은 확인 여부만, 사업자는 법정 표시 항목을 준다.
export interface PublicSellerIdentity {
  sellerType: SellerType;
  verified: boolean;
  business: {
    name: string;
    representativeName: string;
    address: string;
    businessNumber: string;
    mailOrderReportNumber: string | null;
  } | null;
}

interface SellerIdentityRow {
  seller_type: SellerType;
  contact_name: string | null;
  contact_phone: string;
  phone_verified_at: string | null;
  contact_email: string;
  email_verified_at: string | null;
  business_name: string | null;
  representative_name: string | null;
  business_address: string | null;
  business_number: string | null;
  mail_order_report_number: string | null;
  business_verified_at: string | null;
  tax_type: SellerTaxType | null;
  status: SellerIdentityStatus;
  submitted_at: string;
}

const COLUMNS =
  'seller_type, contact_name, contact_phone, phone_verified_at, contact_email, email_verified_at, business_name, representative_name, business_address, business_number, mail_order_report_number, business_verified_at, tax_type, status, submitted_at';

function toSummary(row: SellerIdentityRow): SellerIdentitySummary {
  return {
    sellerType: row.seller_type,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    phoneVerified: row.phone_verified_at !== null,
    contactEmail: row.contact_email,
    emailVerified: row.email_verified_at !== null,
    businessName: row.business_name,
    representativeName: row.representative_name,
    businessAddress: row.business_address,
    businessNumber: row.business_number,
    mailOrderReportNumber: row.mail_order_report_number,
    businessVerified: row.business_verified_at !== null,
    taxType: row.tax_type,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export async function getSellerIdentity(
  userId: string,
): Promise<SellerIdentitySummary | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_identities')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[getSellerIdentity]', error.message);
    throw new Error('판매자 신원정보 조회에 실패했습니다.');
  }
  return data ? toSummary(data as SellerIdentityRow) : null;
}

/**
 * 신청 내용을 저장한다(재신청이면 덮어쓰고 pending으로 되돌린다). 연락처는 인증 없이 입력만 받으므로
 * *_verified_at은 항상 null이다.
 */
export async function upsertSellerIdentity(
  userId: string,
  input: SellerIdentityInput,
  verification: { businessVerified: boolean; taxType: SellerTaxType | null },
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const isBusiness = input.sellerType === 'business';
  const { error } = await supabase.from('moda_seller_identities').upsert(
    {
      user_id: userId,
      seller_type: input.sellerType,
      contact_name: isBusiness ? null : input.contactName,
      contact_phone: input.contactPhone,
      phone_verified_at: null,
      contact_email: input.contactEmail,
      email_verified_at: null,
      business_name: isBusiness ? input.businessName : null,
      representative_name: isBusiness ? input.representativeName : null,
      business_address: isBusiness ? input.businessAddress : null,
      business_number: isBusiness ? input.businessNumber : null,
      // 신고 면제 대상이 있어 선택 항목이다. 빈 문자열은 null로 저장한다
      mail_order_report_number: isBusiness
        ? input.mailOrderReportNumber || null
        : null,
      business_verified_at:
        isBusiness && verification.businessVerified ? now : null,
      tax_type: isBusiness ? verification.taxType : null,
      tax_type_checked_at: isBusiness ? now : null,
      status: 'pending',
      submitted_at: now,
      reviewed_at: null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.error('[upsertSellerIdentity]', error.message);
    throw new Error('판매자 신원정보 저장에 실패했습니다.');
  }
}

/** 관리자가 신청 내용을 확인하고 승인·반려할 때 상태를 바꾼다. */
export async function setSellerIdentityStatus(
  userId: string,
  status: Exclude<SellerIdentityStatus, 'pending'>,
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('moda_seller_identities')
    .update({ status, reviewed_at: now, updated_at: now })
    .eq('user_id', userId);
  if (error) {
    console.error('[setSellerIdentityStatus]', error.message);
    throw new Error('판매자 신원정보 상태 변경에 실패했습니다.');
  }
}

/** 판매자 과세유형만 가볍게 조회한다. 승인(approved)된 신원정보가 아니면 null(= 가산 대상 아님). */
export async function getApprovedSellerTaxType(
  sellerId: string,
): Promise<SellerTaxType | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_identities')
    .select('tax_type, status')
    .eq('user_id', sellerId)
    .maybeSingle();
  if (error) {
    console.error('[getApprovedSellerTaxType]', error.message);
    throw new Error('판매자 과세유형 조회에 실패했습니다.');
  }
  return data && data.status === 'approved'
    ? ((data.tax_type as SellerTaxType | null) ?? null)
    : null;
}

/** 여러 판매자의 가산 대상 과세유형을 한 번에 조회한다(목록 N+1 방지). 승인되지 않은 판매자는 맵에서 빠진다. */
export async function getApprovedSellerTaxTypes(
  sellerIds: string[],
): Promise<Map<string, SellerTaxType | null>> {
  const result = new Map<string, SellerTaxType | null>();
  if (sellerIds.length === 0) return result;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_identities')
    .select('user_id, tax_type')
    .eq('status', 'approved')
    .in('user_id', sellerIds);
  if (error) {
    console.error('[getApprovedSellerTaxTypes]', error.message);
    throw new Error('판매자 과세유형 조회에 실패했습니다.');
  }
  for (const row of data ?? []) {
    result.set(row.user_id as string, (row.tax_type as SellerTaxType | null) ?? null);
  }
  return result;
}

/** 관리자 재조회 결과를 저장한다. */
export async function setSellerTaxType(
  userId: string,
  taxType: SellerTaxType | null,
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('moda_seller_identities')
    .update({ tax_type: taxType, tax_type_checked_at: now, updated_at: now })
    .eq('user_id', userId);
  if (error) {
    console.error('[setSellerTaxType]', error.message);
    throw new Error('판매자 과세유형 저장에 실패했습니다.');
  }
}

/** 구매자 공개용. 행이 없거나 승인 전이면 null(= 신원 확인 중). */
export async function getPublicSellerIdentity(
  sellerId: string,
): Promise<PublicSellerIdentity | null> {
  const row = await getSellerIdentity(sellerId);
  if (!row || row.status !== 'approved') return null;
  const isBusiness = row.sellerType === 'business';
  return {
    sellerType: row.sellerType,
    verified: isBusiness
      ? row.businessVerified
      : true,
    business:
      isBusiness &&
      row.businessName &&
      row.representativeName &&
      row.businessAddress &&
      row.businessNumber
        ? {
            name: row.businessName,
            representativeName: row.representativeName,
            address: row.businessAddress,
            businessNumber: row.businessNumber,
            mailOrderReportNumber: row.mailOrderReportNumber,
          }
        : null,
  };
}
