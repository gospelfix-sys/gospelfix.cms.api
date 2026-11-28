import { createAdminClient } from '@/libs/supabase/admin';
import {
  encryptAccountNumber,
  decryptAccountNumber,
} from '@/libs/crypto/payoutAccount';

// 판매자 정산 계좌. 번호 평문은 로그에 남기지 않고, 응답은 구매자 입금 안내와 판매자 본인 송금 QR
// 조회 두 경로에서만 내보낸다. 그 외 화면용 조회는 끝 4자리만 준다.

export interface PayoutAccountSummary {
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  // 구매자에게 계좌를 보여주는 것(제3자 제공)에 동의했는지. false면 구매자에게 노출되지 않는다
  consented: boolean;
  updatedAt: string;
}

export interface PayoutAccountInput {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

interface PayoutAccountRow {
  bank_name: string;
  account_holder: string;
  account_last4: string;
  third_party_consent_at: string | null;
  updated_at: string;
}

function toSummary(row: PayoutAccountRow): PayoutAccountSummary {
  return {
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    accountLast4: row.account_last4,
    consented: row.third_party_consent_at !== null,
    updatedAt: row.updated_at,
  };
}

export async function getPayoutAccount(
  userId: string,
): Promise<PayoutAccountSummary | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_payout_accounts')
    .select(
      'bank_name, account_holder, account_last4, third_party_consent_at, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[getPayoutAccount]', error.message);
    throw new Error('정산 계좌 조회에 실패했습니다.');
  }
  return data ? toSummary(data as PayoutAccountRow) : null;
}

export async function upsertPayoutAccount(
  userId: string,
  input: PayoutAccountInput,
): Promise<PayoutAccountSummary> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_payout_accounts')
    .upsert(
      {
        user_id: userId,
        bank_name: input.bankName,
        account_holder: input.accountHolder,
        account_number_encrypted: encryptAccountNumber(input.accountNumber),
        account_last4: input.accountNumber.slice(-4),
        // 저장 시점의 안내문에 동의한 것으로 기록한다(라우트에서 동의 없으면 400)
        third_party_consent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select(
      'bank_name, account_holder, account_last4, third_party_consent_at, updated_at',
    )
    .single();
  if (error) {
    console.error('[upsertPayoutAccount]', error.message);
    throw new Error('정산 계좌 저장에 실패했습니다.');
  }
  return toSummary(data as PayoutAccountRow);
}

export async function deletePayoutAccount(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('moda_seller_payout_accounts')
    .delete()
    .eq('user_id', userId);
  if (error) {
    console.error('[deletePayoutAccount]', error.message);
    throw new Error('정산 계좌 삭제에 실패했습니다.');
  }
}

export interface BuyerVisiblePayoutAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/**
 * 구매자 입금 안내용으로 판매자 계좌를 복호화해 돌려준다. 동의 전(third_party_consent_at null)이거나
 * 미등록이면 null. 호출부에서 주문 소유자·상태를 먼저 검증해야 하며, 결과를 로그에 남기지 않는다.
 */
export async function getBuyerVisiblePayoutAccount(
  sellerId: string,
): Promise<BuyerVisiblePayoutAccount | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_payout_accounts')
    .select('bank_name, account_holder, account_number_encrypted')
    .eq('user_id', sellerId)
    .not('third_party_consent_at', 'is', null)
    .maybeSingle();
  if (error) {
    console.error('[getBuyerVisiblePayoutAccount]', error.message);
    throw new Error('판매자 계좌 조회에 실패했습니다.');
  }
  if (!data) return null;
  return {
    bankName: data.bank_name as string,
    accountHolder: data.account_holder as string,
    accountNumber: decryptAccountNumber(
      data.account_number_encrypted as string,
    ),
  };
}

/**
 * 판매자 본인이 자기 계좌의 송금 QR을 만들 수 있게 번호 평문을 돌려준다. 구매자용과 달리 동의 여부와
 * 무관하다(본인 계좌이고 구매자에게는 노출되지 않는다). 호출부에서 판매자 본인 인증을 먼저 검증해야 하며,
 * 결과를 로그에 남기지 않는다.
 */
export async function getOwnPayoutAccountForTransfer(
  userId: string,
): Promise<BuyerVisiblePayoutAccount | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_payout_accounts')
    .select('bank_name, account_holder, account_number_encrypted')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[getOwnPayoutAccountForTransfer]', error.message);
    throw new Error('정산 계좌 조회에 실패했습니다.');
  }
  if (!data) return null;
  return {
    bankName: data.bank_name as string,
    accountHolder: data.account_holder as string,
    accountNumber: decryptAccountNumber(
      data.account_number_encrypted as string,
    ),
  };
}

/** 구매자에게 노출 가능한(등록 + 동의) 계좌가 있는지만 확인한다. 복호화하지 않는다. */
export async function hasBuyerVisiblePayoutAccount(
  sellerId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_seller_payout_accounts')
    .select('user_id')
    .eq('user_id', sellerId)
    .not('third_party_consent_at', 'is', null)
    .maybeSingle();
  if (error) {
    console.error('[hasBuyerVisiblePayoutAccount]', error.message);
    throw new Error('판매자 계좌 조회에 실패했습니다.');
  }
  return !!data;
}
