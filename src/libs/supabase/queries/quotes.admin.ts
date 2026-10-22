import { createAdminClient } from '@/libs/supabase/admin';
import type { AdminQuoteDetail, AdminQuoteListItem } from '@/types/quote';

const LIST_COLUMNS =
  'id, contact_name, contact_value, contact_email, estimated_total, user_agent, referer, utm_params, created_at';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUUID(id: string): void {
  if (!id || !UUID_REGEX.test(id))
    throw new Error('유효하지 않은 견적 신청 ID입니다.');
}

/**
 * 관리자 "견적 신청" 목록을 페이지네이션으로 반환한다.
 * gospelfix_quote_submissions는 제출될 때마다 계속 쌓이는 로그성 데이터라
 * orders와 동일하게 DB 레벨(.range())로 페이지네이션한다.
 */
export async function getAllQuotesAdmin(
  page: number,
  limit: number,
): Promise<{ data: AdminQuoteListItem[]; total: number }> {
  const supabase = createAdminClient();

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('gospelfix_quote_submissions')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as AdminQuoteListItem[], total: count ?? 0 };
}

/**
 * 견적 신청 1건의 전체 컬럼(위저드 응답 + 방문 메타데이터)을 반환한다.
 */
export async function getQuoteByIdAdmin(
  id: string,
): Promise<AdminQuoteDetail | null> {
  assertValidUUID(id);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gospelfix_quote_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AdminQuoteDetail | null;
}
