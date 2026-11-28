import { createAdminClient } from '@/libs/supabase/admin';

// 판매자 신원정보. 휴대폰·이메일은 본인 확인용이라 구매자 공개 응답에 넣지 않는다.

export type SellerType = 'individual' | 'business';
export type SellerIdentityStatus = 'pending' | 'approved' | 'rejected';

export interface SellerIdentityInput {
  sellerType: SellerType;
  contactPhone: string;
  contactEmail: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessNumber?: string;
  mailOrderReportNumber?: string;
}

export interface SellerIdentitySummary {
  sellerType: SellerType;
  contactPhone: string;
  phoneVerified: boolean;
  contactEmail: string;
  emailVerified: boolean;
  businessName: string | null;
  representativeName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  businessNumber: string | null;
  mailOrderReportNumber: string | null;
  businessVerified: boolean;
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
    phone: string;
    businessNumber: string;
    mailOrderReportNumber: string;
  } | null;
}

interface SellerIdentityRow {
  seller_type: SellerType;
  contact_phone: string;
  phone_verified_at: string | null;
  contact_email: string;
  email_verified_at: string | null;
  business_name: string | null;
  representative_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_number: string | null;
  mail_order_report_number: string | null;
  business_verified_at: string | null;
  status: SellerIdentityStatus;
  submitted_at: string;
}

const COLUMNS =
  'seller_type, contact_phone, phone_verified_at, contact_email, email_verified_at, business_name, representative_name, business_address, business_phone, business_number, mail_order_report_number, business_verified_at, status, submitted_at';

function toSummary(row: SellerIdentityRow): SellerIdentitySummary {
  return {
    sellerType: row.seller_type,
    contactPhone: row.contact_phone,
    phoneVerified: row.phone_verified_at !== null,
    contactEmail: row.contact_email,
    emailVerified: row.email_verified_at !== null,
    businessName: row.business_name,
    representativeName: row.representative_name,
    businessAddress: row.business_address,
    businessPhone: row.business_phone,
    businessNumber: row.business_number,
    mailOrderReportNumber: row.mail_order_report_number,
    businessVerified: row.business_verified_at !== null,
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
 * 신청 내용을 저장한다(재신청이면 덮어쓰고 pending으로 되돌린다). 휴대폰·이메일 인증 시각은
 * 호출부가 토큰을 소비한 뒤에만 넘기므로 항상 "지금"으로 기록한다.
 */
export async function upsertSellerIdentity(
  userId: string,
  input: SellerIdentityInput,
  businessVerified: boolean,
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const isBusiness = input.sellerType === 'business';
  const { error } = await supabase.from('moda_seller_identities').upsert(
    {
      user_id: userId,
      seller_type: input.sellerType,
      contact_phone: input.contactPhone,
      phone_verified_at: now,
      contact_email: input.contactEmail,
      email_verified_at: now,
      business_name: isBusiness ? input.businessName : null,
      representative_name: isBusiness ? input.representativeName : null,
      business_address: isBusiness ? input.businessAddress : null,
      business_phone: isBusiness ? input.businessPhone : null,
      business_number: isBusiness ? input.businessNumber : null,
      mail_order_report_number: isBusiness
        ? input.mailOrderReportNumber
        : null,
      business_verified_at: isBusiness && businessVerified ? now : null,
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

/** 구매자 공개용. 행이 없거나 승인 전이면 null(= 신원 확인 중). */
export async function getPublicSellerIdentity(
  sellerId: string,
): Promise<PublicSellerIdentity | null> {
  const row = await getSellerIdentity(sellerId);
  if (!row || row.status !== 'approved') return null;
  const isBusiness = row.sellerType === 'business';
  return {
    sellerType: row.sellerType,
    verified: row.phoneVerified && row.emailVerified,
    business:
      isBusiness &&
      row.businessName &&
      row.representativeName &&
      row.businessAddress &&
      row.businessPhone &&
      row.businessNumber &&
      row.mailOrderReportNumber
        ? {
            name: row.businessName,
            representativeName: row.representativeName,
            address: row.businessAddress,
            phone: row.businessPhone,
            businessNumber: row.businessNumber,
            mailOrderReportNumber: row.mailOrderReportNumber,
          }
        : null,
  };
}
