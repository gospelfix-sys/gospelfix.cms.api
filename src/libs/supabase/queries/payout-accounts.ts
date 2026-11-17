import { createAdminClient } from '@/libs/supabase/admin';
import { encryptAccountNumber } from '@/libs/crypto/payoutAccount';

// 판매자 정산 계좌. 번호 평문은 응답·로그 어디에도 내보내지 않고, 화면용으로는 끝 4자리만 준다.

export interface PayoutAccountSummary {
  bankName: string;
  accountHolder: string;
  accountLast4: string;
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
  updated_at: string;
}

function toSummary(row: PayoutAccountRow): PayoutAccountSummary {
  return {
    bankName: row.bank_name,
    accountHolder: row.account_holder,
    accountLast4: row.account_last4,
    updatedAt: row.updated_at,
  };
}

export async function getPayoutAccount(
  userId: string,
): Promise<PayoutAccountSummary | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('seller_payout_accounts')
    .select('bank_name, account_holder, account_last4, updated_at')
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
    .from('seller_payout_accounts')
    .upsert(
      {
        user_id: userId,
        bank_name: input.bankName,
        account_holder: input.accountHolder,
        account_number_encrypted: encryptAccountNumber(input.accountNumber),
        account_last4: input.accountNumber.slice(-4),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('bank_name, account_holder, account_last4, updated_at')
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
    .from('seller_payout_accounts')
    .delete()
    .eq('user_id', userId);
  if (error) {
    console.error('[deletePayoutAccount]', error.message);
    throw new Error('정산 계좌 삭제에 실패했습니다.');
  }
}
