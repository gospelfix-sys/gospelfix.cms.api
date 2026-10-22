import sanitizeHtml from 'sanitize-html';
import { createAdminClient } from '@/libs/supabase/admin';
import { getActiveProductCategoryValues } from '@/libs/supabase/queries/product-categories.admin';
import { getActiveProductSubCategoryValues } from '@/libs/supabase/queries/product-sub-categories.admin';
import type {
  Product,
  ProductCodePreviewItem,
  ProductPurchaseOption,
} from '@/types/product';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// gospelfix `UploadWorkEditor`의 작업 캔버스(이미지+동영상 링크+에디터 블록)를 이어붙인
// 상품 상세 content_html용 — `internal-agent.ts`의 sanitizeContent(블로그용)와 달리 이미지
// 블록이 <img> 태그로, 동영상 링크 블록이 <div class="video-embed">...<iframe>...</iframe>
// </div>로 직렬화되므로 img/div/iframe을 허용해야 한다. 판매자(신뢰도 낮은 소스) 입력이 그대로
// 공개 상품 페이지에 렌더링되므로 반드시 이 화이트리스트를 거쳐야 한다(Stored XSS 방지) —
// 특히 iframe은 임의 호스트를 허용하면 그 자체로 위험하므로 gospelfix `lib/sanitizeHtml.ts`와
// 동일하게 유튜브/Vimeo 임베드 호스트로만 제한한다(allowedIframeHostnames).
const PRODUCT_CONTENT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'strong',
    'em',
    'u',
    's',
    'a',
    'img',
    'div',
    'iframe',
  ],
  allowedAttributes: {
    // target은 허용하지 않는다 — reverse tabnabbing 방지
    a: ['href', 'rel'],
    img: ['src', 'alt'],
    div: ['class'],
    iframe: ['src', 'class', 'allow', 'allowfullscreen', 'loading', 'title'],
  },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
};

export function sanitizeProductContentHtml(content: string): string {
  return sanitizeHtml(content, PRODUCT_CONTENT_SANITIZE_OPTIONS).trim();
}

// DB 컬럼명(options)과 앱 필드명(purchase_options)이 다르므로 select에서 별칭 처리.
// seller_id는 055에서, review_status는 056에서 추가 — 관리자 목록/승인 UI가 판매자
// 소유·검수 상태를 표시하려면 필요. status(단수, active/inactive)는 001부터 있던
// 무관한 레거시 컬럼이라 충돌을 피해 DB 컬럼명은 review_status를 쓰되 앱 필드명은
// status로 별칭 처리한다(056_fix_products_status_column_collision 메모리 참고).
const ADMIN_SELECT_COLUMNS =
  'id,slug,name,description,content_html,discount_starts_at,discount_ends_at,category,sub_categories,price,thumbnail_url,images,demo_url,is_active,sort_order,supply_price,purchase_options:options,production_solution,product_code,design_type,like_count,has_ai_starter_kit,file_path,code_preview,license,created_at,updated_at,seller_id,status:review_status';

export function assertValidUUID(id: string): void {
  if (!id || !UUID_REGEX.test(id))
    throw new Error('유효하지 않은 상품 ID입니다.');
}

// 라벨이 빈 행은 저장하지 않고, 별도 문의 옵션은 가격을 null로 정리
export function sanitizePurchaseOptions(
  options: ProductPurchaseOption[],
): ProductPurchaseOption[] {
  return options
    .filter((opt) => opt.label.trim().length > 0)
    .map((opt) => ({
      id: opt.id,
      label: opt.label.trim(),
      price: opt.is_inquiry_only ? null : opt.price,
      description: opt.description?.trim() || null,
      // 과거 숫자 타입으로 저장된 레거시 데이터가 섞여 들어올 수 있어 문자열로 정규화 후 trim
      work_period_days:
        opt.work_period_days != null
          ? String(opt.work_period_days).trim() || null
          : null,
      is_inquiry_only: opt.is_inquiry_only,
      detail: opt.detail?.trim() || null,
    }));
}

// 라벨/코드가 둘 다 빈 행은 저장하지 않는다 (관리자가 "탭 추가"만 누르고 비워둔 경우)
export function sanitizeCodePreview(
  items: ProductCodePreviewItem[],
): ProductCodePreviewItem[] {
  return items
    .filter(
      (item) => item.label.trim().length > 0 || item.code.trim().length > 0,
    )
    .map((item) => ({
      id: item.id,
      label: item.label.trim(),
      code: item.code,
    }));
}

// 업종 소분류 태그 최대 개수(비즈니스 규칙, taxonomy 값과 무관하게 고정).
const MAX_SUB_CATEGORIES = 3;

// 2026-08-27부터 대분류/소분류 화이트리스트는 moda_product_categories/
// moda_product_sub_categories 테이블(관리자 CRUD 가능)에서 관리한다. 값이 자주
// 바뀔 수 있어 DB CHECK가 아니라 여기서 조회한 is_active=true 목록으로 검증한다.
export async function sanitizeSubCategories(
  values: string[],
): Promise<string[]> {
  const valid = await getActiveProductSubCategoryValues();
  const deduped = Array.from(new Set(values.filter((v) => valid.includes(v))));
  return deduped.slice(0, MAX_SUB_CATEGORIES);
}

// 대분류는 지금까지 값 검증이 전혀 없었다(2026-08-27 이전) — moda_products.category는
// plain text 컬럼이라 임의 문자열이 그대로 저장될 수 있었다. 이 함수로 그 공백을 메운다.
// 유효하지 않으면 null을 반환하고, 호출부(products.my.ts)가 400 에러로 명시적 거부한다.
export async function sanitizeCategory(value: string): Promise<string | null> {
  const valid = await getActiveProductCategoryValues();
  return valid.includes(value) ? value : null;
}

export async function getAllProducts(): Promise<Product[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(ADMIN_SELECT_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getAllProducts]', error);
    throw new Error('상품 목록을 불러오지 못했습니다.');
  }
  return (data ?? []) as unknown as Product[];
}

export async function getProductByIdAdmin(id: string): Promise<Product | null> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(ADMIN_SELECT_COLUMNS)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[getProductByIdAdmin]', error);
    throw new Error('상품을 불러오지 못했습니다.');
  }
  return data as unknown as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { error } = await supabase.from('moda_products').delete().eq('id', id);
  if (error) {
    console.error('[deleteProduct]', error);
    throw new Error('상품 삭제에 실패했습니다.');
  }
}

export async function duplicateProduct(id: string): Promise<Product> {
  assertValidUUID(id);
  const supabase = createAdminClient();

  const { data: allItems, error: listError } = await supabase
    .from('moda_products')
    .select(ADMIN_SELECT_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (listError) {
    console.error('[duplicateProduct] list', listError);
    throw new Error('상품 목록을 불러오지 못했습니다.');
  }

  const originalIdx = (allItems ?? []).findIndex((item) => item.id === id);
  if (originalIdx === -1) throw new Error('상품을 찾을 수 없습니다.');
  const original = allItems![originalIdx];

  const reordered = [...allItems!];
  reordered.splice(originalIdx + 1, 0, { id: '__new__' } as typeof original);
  const newSortOrder = originalIdx + 2;

  const reorderUpdates = reordered
    .filter((item) => item.id !== '__new__')
    .map((item, i) => ({ id: item.id, sort_order: i + 1 }));

  if (reorderUpdates.length > 0) {
    const reorderResults = await Promise.all(
      reorderUpdates.map(({ id: itemId, sort_order }) =>
        supabase.from('moda_products').update({ sort_order }).eq('id', itemId),
      ),
    );
    const reorderFailed = reorderResults.find(({ error }) => error);
    if (reorderFailed?.error) {
      console.error('[duplicateProduct] reorder', reorderFailed.error);
      throw new Error('순서 재배치에 실패했습니다.');
    }
  }

  const { data, error } = await supabase
    .from('moda_products')
    .insert({
      slug: `${original.slug}-copy-${Date.now()}`,
      name: `${original.name} (복사본)`,
      description: original.description,
      content_html: original.content_html,
      discount_starts_at: original.discount_starts_at,
      discount_ends_at: original.discount_ends_at,
      category: original.category,
      sub_categories: original.sub_categories,
      thumbnail_url: original.thumbnail_url,
      images: original.images,
      demo_url: original.demo_url,
      price: original.price,
      supply_price: original.supply_price,
      options: original.purchase_options,
      production_solution: original.production_solution,
      // 제품코드는 상품 고유 SKU 성격이라 복사본에는 넘기지 않는다(관리자가 새로 입력)
      product_code: null,
      design_type: original.design_type,
      has_ai_starter_kit: original.has_ai_starter_kit,
      // 다운로드 파일도 복사하지 않는다 — 원본 zip이 나중에 교체/삭제되면 복제 상품까지
      // 함께 깨지는 걸 막기 위해 관리자가 복사본에 새로 업로드하도록 한다
      file_path: null,
      // 코드 미리보기는 파일 참조가 아니라 순수 텍스트 발췌본이라 content_html과
      // 마찬가지로 복사본에도 그대로 옮긴다
      code_preview: original.code_preview,
      license: original.license,
      is_active: false,
      sort_order: newSortOrder,
    })
    .select(ADMIN_SELECT_COLUMNS)
    .single();

  if (error) {
    console.error('[duplicateProduct] insert', error);
    throw new Error('상품 복사에 실패했습니다.');
  }
  return data as unknown as Product;
}

// 판매자가 제출(status='pending')한 상품을 관리자가 검수 승인한다. 승인과 동시에
// is_active=true로 전환해 공개 카탈로그(콘텐츠 API의 is_active 필터)에 바로 노출시킨다
// — status와 is_active를 분리된 두 단계 승인으로 나누지 않기로 한 설계 결정
// (project_product_crud_migration_to_mypage 메모리 참고).
export async function approveProduct(id: string): Promise<Product> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .update({ review_status: 'approved', is_active: true })
    .eq('id', id)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[approveProduct]', error);
    throw new Error('상품 승인에 실패했습니다.');
  }
  return data as unknown as Product;
}

export async function rejectProduct(id: string): Promise<Product> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .update({ review_status: 'rejected', is_active: false })
    .eq('id', id)
    .select(ADMIN_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[rejectProduct]', error);
    throw new Error('상품 반려에 실패했습니다.');
  }
  return data as unknown as Product;
}

export async function updateProductsSortOrder(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const supabase = createAdminClient();
  const results = await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('moda_products').update({ sort_order }).eq('id', id),
    ),
  );
  const failed = results.find(({ error }) => error);
  if (failed?.error) {
    console.error('[updateProductsSortOrder]', failed.error);
    throw new Error('순서 저장에 실패했습니다.');
  }
}
