import { createAdminClient } from '@/libs/supabase/admin';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ProductCategoryForm의 클라이언트 측 검증과 동일한 규칙 — 폼을 우회해 Server Action을
// 직접 호출해도 서버에서 다시 막는다.
const VALUE_REGEX = /^[a-z][a-z0-9_]*$/;

const ADMIN_SELECT_COLUMNS = 'id,value,label,sort_order,is_active,created_at,updated_at';

export interface ProductCategory {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategoryFormInput {
  value: string;
  label: string;
  is_active: boolean;
}

function assertValidUUID(id: string): void {
  if (!id || !UUID_REGEX.test(id)) throw new Error('유효하지 않은 카테고리 ID입니다.');
}

export async function getAllProductCategories(): Promise<ProductCategory[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .select(ADMIN_SELECT_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getAllProductCategories]', error);
    throw new Error('카테고리 목록을 불러오지 못했습니다.');
  }
  return (data ?? []) as unknown as ProductCategory[];
}

export async function getProductCategoryByIdAdmin(id: string): Promise<ProductCategory | null> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .select(ADMIN_SELECT_COLUMNS)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[getProductCategoryByIdAdmin]', error);
    throw new Error('카테고리를 불러오지 못했습니다.');
  }
  return data as unknown as ProductCategory;
}

export async function createProductCategory(
  input: ProductCategoryFormInput,
): Promise<ProductCategory> {
  if (!VALUE_REGEX.test(input.value)) {
    throw new Error('value는 소문자로 시작하는 영문 소문자/숫자/언더스코어만 가능합니다.');
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .insert(input)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[createProductCategory]', error);
    throw new Error('카테고리 저장에 실패했습니다.');
  }
  return data as unknown as ProductCategory;
}

// value는 moda_products.category가 그대로 참조하는 안정적인 key라 수정 시 바뀌면
// 기존 상품이 orphan(존재하지 않는 카테고리를 참조)이 된다. 폼(ProductCategoryForm)이
// value 입력을 readOnly로 막아두긴 하지만, 그건 클라이언트 측 UX 방어일 뿐이라
// 여기서도 input.value를 무시하고 label/is_active만 업데이트해 서버 레벨에서 불변식을
// 강제한다 — 이 함수를 다른 경로(devtools 직접 호출, 향후 재사용 등)에서 호출해도 깨지지 않음.
export async function updateProductCategory(
  id: string,
  input: ProductCategoryFormInput,
): Promise<ProductCategory> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .update({ label: input.label, is_active: input.is_active })
    .eq('id', id)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[updateProductCategory]', error);
    throw new Error('카테고리 수정에 실패했습니다.');
  }
  return data as unknown as ProductCategory;
}

// FK가 없어 moda_products.category 참조를 DB 레벨에서 강제할 수 없으므로, 삭제 전
// 앱 레벨에서 사용중 여부를 직접 확인한다 — 이미 상품이 참조 중인 카테고리를 지우면
// 해당 상품의 category가 존재하지 않는 값(orphan)이 되어버린다. is_active=false
// 토글은 이 체크 없이 항상 허용한다(deleteProductCategory에서만 검사).
export async function deleteProductCategory(id: string): Promise<void> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const target = await getProductCategoryByIdAdmin(id);
  if (!target) throw new Error('카테고리를 찾을 수 없습니다.');

  const { data: inUse } = await supabase
    .from('moda_products')
    .select('id')
    .eq('category', target.value)
    .limit(1);
  if (inUse && inUse.length > 0) {
    throw new Error(
      '이미 상품에서 사용 중인 카테고리는 삭제할 수 없습니다. 먼저 비활성화해주세요.',
    );
  }

  const { error } = await supabase.from('moda_product_categories').delete().eq('id', id);
  if (error) {
    console.error('[deleteProductCategory]', error);
    throw new Error('카테고리 삭제에 실패했습니다.');
  }
}

// 복제본은 목록 맨 뒤(가장 큰 sort_order + 1)에 추가한다 — referral_banners의
// duplicateReferralBanner와 동일하게 원본 바로 다음 위치로 끼워넣기 위해 기존 행
// 전체의 sort_order를 재배치하지는 않는다. value는 UNIQUE 제약이 있어 원본 값을
// 그대로 복사할 수 없으므로 타임스탬프를 붙여 자동 생성한다(관리자가 수정 화면에서
// 원하는 값으로 다시 바꿀 수 있음 — 단, value는 생성 화면에서만 편집 가능하므로
// 복제본의 value는 그대로 유지되는 게 의도된 동작이다).
export async function duplicateProductCategory(id: string): Promise<ProductCategory> {
  const original = await getProductCategoryByIdAdmin(id);
  if (!original) throw new Error('카테고리를 찾을 수 없습니다.');

  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from('moda_product_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('moda_product_categories')
    .insert({
      value: `${original.value}_copy_${Date.now()}`,
      label: `${original.label} (복사본)`,
      is_active: false,
      sort_order: nextSortOrder,
    })
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[duplicateProductCategory]', error);
    throw new Error('카테고리 복사에 실패했습니다.');
  }
  return data as unknown as ProductCategory;
}

export async function updateProductCategoriesSortOrder(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const supabase = createAdminClient();
  const results = await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('moda_product_categories').update({ sort_order }).eq('id', id),
    ),
  );
  const failed = results.find(({ error }) => error);
  if (failed?.error) {
    console.error('[updateProductCategoriesSortOrder]', failed.error);
    throw new Error('순서 저장에 실패했습니다.');
  }
}

/** products.admin.ts의 sanitizeCategory()가 유효한 카테고리 값을 검증하는 데 사용한다. */
export async function getActiveProductCategoryValues(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .select('value')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[getActiveProductCategoryValues]', error);
    throw new Error('카테고리 값 목록을 불러오지 못했습니다.');
  }
  return (data ?? []).map((row) => (row as { value: string }).value);
}

/** ProductsTable.tsx/products/[id]/page.tsx가 카테고리 라벨을 표시하는 데 사용한다. */
export async function getProductCategoryLabelMap(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_product_categories')
    .select('value,label');
  if (error) {
    console.error('[getProductCategoryLabelMap]', error);
    throw new Error('카테고리 라벨 목록을 불러오지 못했습니다.');
  }
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { value: string; label: string }[]) {
    map[row.value] = row.label;
  }
  return map;
}
