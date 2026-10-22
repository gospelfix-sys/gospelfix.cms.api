import { createAdminClient } from '@/libs/supabase/admin';

export interface ContentApiConfig {
  id: string;
  resource_slug: string;
  label: string;
  table_name: string;
  is_enabled: boolean;
  filter_column: string | null;
  filter_value: string | null;
  filter_is_bool: boolean;
  identifier_column: string;
  identifier_type: 'uuid' | 'text';
  order_column: string;
  order_direction: 'asc' | 'desc';
  select_columns: string | null;
  created_at: string;
  updated_at: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 요청 쿼리(sort_by)로 order_column을 덮어쓸 때 허용하는 컬럼 화이트리스트.
// 임의 컬럼명을 그대로 .order()에 넘기면 존재하지 않는 컬럼 조회 시 500 에러로
// 이어지고, 장기적으로는 요청값을 검증 없이 쿼리에 꽂는 나쁜 선례가 되므로 제한한다.
const SORTABLE_COLUMNS = ['created_at', 'like_count'];

export type ListQueryOptions = {
  sortBy?: string | null;
  priceType?: 'free' | 'premium' | null;
};

// products 리소스는 price는 그대로 두고 is_free/price_display 필드를 추가한다 (기존 API 컨슈머의 price 타입을 깨지 않기 위함).
function enrichProductFields(
  config: ContentApiConfig,
  item: Record<string, unknown>,
): Record<string, unknown> {
  if (config.resource_slug === 'products' && 'price' in item) {
    const price = typeof item.price === 'number' ? item.price : null;
    const isFree = price === 0;
    return {
      ...item,
      is_free: isFree,
      price_display:
        price === null
          ? null
          : isFree
            ? 'FREE'
            : `${price.toLocaleString('ko-KR')}원`,
    };
  }
  return item;
}

export class InvalidIdentifierError extends Error {
  constructor() {
    super('Invalid identifier format');
    this.name = 'InvalidIdentifierError';
  }
}

export async function getApiConfigBySlug(
  slug: string,
): Promise<ContentApiConfig | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_api_configs')
    .select('*')
    .eq('resource_slug', slug)
    .single();
  if (error || !data) return null;
  return data as ContentApiConfig;
}

export async function getAllApiConfigs(): Promise<ContentApiConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_api_configs')
    .select('*')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as ContentApiConfig[];
}

export async function toggleApiConfig(
  id: string,
  isEnabled: boolean,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('content_api_configs')
    .update({ is_enabled: isEnabled })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function queryConfigList(
  config: ContentApiConfig,
  page: number,
  limit: number,
  options?: ListQueryOptions,
): Promise<{ data: unknown[]; total: number }> {
  const supabase = createAdminClient();
  const selectCols = config.select_columns ?? '*';

  let query = supabase
    .from(config.table_name)
    .select(selectCols, { count: 'exact' });

  if (config.filter_column && config.filter_value !== null) {
    const filterVal: string | boolean = config.filter_is_bool
      ? config.filter_value === 'true'
      : config.filter_value;
    query = query.eq(config.filter_column, filterVal);
  }

  // 상품 전용 가격 필터(무료/프리미엄) — DB 설정 필터(filter_column)와 달리 요청
  // 시점에 동적으로 켜고 끄는 값이라 config가 아니라 매 요청의 쿼리 파라미터로 받는다.
  if (config.resource_slug === 'products' && options?.priceType) {
    query =
      options.priceType === 'free' ? query.eq('price', 0) : query.gt('price', 0);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // sort_by 요청 파라미터가 화이트리스트에 있으면 order_column을 덮어쓴다
  // (예: 인기순=like_count, 최근순=created_at). 없으면 기존 config 값 그대로.
  // price_type과 동일하게 products 전용으로 게이팅 — like_count 컬럼은 products 테이블에만
  // 존재해서, 게이팅 없이 news/portfolios에 sort_by=like_count가 오면 존재하지 않는 컬럼
  // 기준 정렬로 Supabase 쿼리 에러(500)가 난다.
  const sortOverride =
    config.resource_slug === 'products' && options?.sortBy && SORTABLE_COLUMNS.includes(options.sortBy)
      ? options.sortBy
      : null;
  const orderColumn = sortOverride ?? config.order_column;
  const orderDirection = sortOverride ? 'desc' : config.order_direction;

  query = query.order(orderColumn, {
    ascending: orderDirection === 'asc',
    nullsFirst: false,
  });

  // order_column만으로는 값이 같은 행(예: sort_order가 모두 0인 신규 상품)의 순서가
  // 확정되지 않아, 관리자 목록(sort_order asc → created_at desc)과 공개 API의 노출
  // 순서가 어긋나고 페이지네이션 경계에서 중복·누락도 생길 수 있다. 관리자 쿼리
  // (products.admin.ts / posts.admin.ts / portfolios.admin.ts)와 동일한 2차 정렬을 건다.
  if (orderColumn !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return {
    data: rows.map((row) => enrichProductFields(config, row)),
    total: count ?? 0,
  };
}

export async function queryConfigDetail(
  config: ContentApiConfig,
  identifier: string,
): Promise<unknown | null> {
  if (config.identifier_type === 'uuid') {
    if (!UUID_REGEX.test(identifier)) throw new InvalidIdentifierError();
  }

  const supabase = createAdminClient();
  const selectCols = config.select_columns ?? '*';

  const { data, error } = await supabase
    .from(config.table_name)
    .select(selectCols)
    .eq(config.identifier_column, identifier)
    .single();

  if (error || !data) return null;
  return enrichProductFields(
    config,
    data as unknown as Record<string, unknown>,
  );
}
