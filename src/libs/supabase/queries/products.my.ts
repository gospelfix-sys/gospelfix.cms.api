import { createAdminClient } from '@/libs/supabase/admin';
import {
  assertValidUUID,
  sanitizeCategory,
  sanitizeCodePreview,
  sanitizeProductContentHtml,
  sanitizePurchaseOptions,
  sanitizeSubCategories,
} from '@/libs/supabase/queries/products.admin';
import type { MyProductInput, Product } from '@/types/product';

export class MyProductError extends Error {
  status: number;
  field?: string;
  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'MyProductError';
    this.status = status;
    this.field = field;
  }
}

// products.admin.ts의 ADMIN_SELECT_COLUMNS와 동일 — 판매자 본인 조회에도 seller_id/검수
// 상태가 필요하다(소유 확인, 검수 상태 표시). DB 컬럼명은 review_status이지만 앱 필드명은
// status로 별칭 처리한다 — status(단수)는 001부터 있던 무관한 레거시 컬럼이라 충돌 방지
// (056_fix_products_status_column_collision 참고).
const MY_SELECT_COLUMNS =
  'id,slug,name,description,content_html,discount_starts_at,discount_ends_at,category,sub_categories,price,thumbnail_url,images,demo_url,is_active,sort_order,supply_price,purchase_options:options,production_solution,product_code,design_type,like_count,has_ai_starter_kit,file_path,code_preview,license,created_at,updated_at,seller_id,status:review_status';

// 서비스 롤 클라이언트로 쓰되, 모든 쿼리에 seller_id 조건을 강제해 애플리케이션 계층에서
// 소유권을 검증한다(RLS를 seller까지 확장하는 대신 택한 방식 —
// project_product_crud_migration_to_mypage 메모리의 "인증/보안 경계" 결정 참고).
async function toPayload(input: MyProductInput, sellerId: string) {
  const images = input.images.length > 0 ? input.images : null;

  // 2026-08-27부터 대분류도 moda_product_categories 기준으로 검증한다(그 전까지는
  // 검증이 전혀 없었다). 유효하지 않은 값은 무음으로 null 처리하지 않고 400으로
  // 명시적으로 거부한다 — 원인 불명 실패보다 필드 에러가 판매자 UX상 낫다는 판단.
  const category = input.category
    ? await sanitizeCategory(input.category)
    : null;
  if (input.category && !category) {
    throw new MyProductError(400, '유효하지 않은 카테고리입니다.', 'category');
  }

  return {
    slug: input.slug,
    name: input.name,
    description: input.description || null,
    content_html: input.contentHtml
      ? sanitizeProductContentHtml(input.contentHtml)
      : null,
    discount_starts_at: input.discountStartsAt,
    discount_ends_at: input.discountEndsAt,
    category,
    sub_categories: await sanitizeSubCategories(input.subCategories),
    images,
    thumbnail_url: images ? images[0] : null,
    demo_url: input.demoUrl || null,
    price: input.price,
    supply_price: input.supplyPrice,
    options: sanitizePurchaseOptions(
      input.purchaseOptions.map((opt) => ({
        id: opt.id,
        label: opt.label,
        price: opt.price,
        description: opt.description,
        work_period_days: opt.workPeriodDays,
        is_inquiry_only: opt.isInquiryOnly,
        detail: opt.detail,
      })),
    ),
    production_solution: input.productionSolution || null,
    product_code: input.productCode || null,
    design_type: input.designType || null,
    has_ai_starter_kit: input.hasAiStarterKit,
    file_path: input.filePath,
    code_preview: sanitizeCodePreview(input.codePreview),
    license: input.license,
    seller_id: sellerId,
    review_status: input.status,
    // 신규 등록(create) 또는 아직 최초 승인을 못 받은 상품(draft/pending/rejected)의
    // 수정은 항상 미승인 상태로 유지/전환한다 — 관리자 재검수 전까지 비공개.
    // 이미 승인된(approved) 상품의 수정은 updateMyProduct()가 이 두 필드를 payload에서
    // 제거해 재검수 없이 기존 상태(approved/is_active=true)를 그대로 유지시킨다.
    is_active: false,
  };
}

// gospelfix `src/lib/api/myProducts.ts`의 `CmsMyProduct`가 기대하는 camelCase 계약과
// 정확히 일치해야 한다 — 필드명을 바꾸려면 그쪽도 함께 고칠 것
// (project_product_crud_migration_to_mypage 메모리 참고).
export function toApiProduct(product: Product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    contentHtml: product.content_html,
    discountStartsAt: product.discount_starts_at,
    discountEndsAt: product.discount_ends_at,
    category: product.category,
    subCategories: product.sub_categories,
    images: product.images,
    thumbnailUrl: product.thumbnail_url,
    demoUrl: product.demo_url,
    price: product.price,
    supplyPrice: product.supply_price,
    purchaseOptions:
      product.purchase_options?.map((opt) => ({
        id: opt.id,
        label: opt.label,
        price: opt.price,
        description: opt.description,
        workPeriodDays: opt.work_period_days,
        isInquiryOnly: opt.is_inquiry_only,
        detail: opt.detail,
      })) ?? null,
    productionSolution: product.production_solution,
    productCode: product.product_code,
    designType: product.design_type,
    hasAiStarterKit: product.has_ai_starter_kit,
    filePath: product.file_path,
    codePreview: product.code_preview,
    license: product.license,
    status: product.status,
    sellerId: product.seller_id,
    isActive: product.is_active,
    likeCount: product.like_count,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

export async function getMyProducts(sellerId: string): Promise<Product[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(MY_SELECT_COLUMNS)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getMyProducts]', error);
    throw new Error('상품 목록을 불러오지 못했습니다.');
  }
  return (data ?? []) as unknown as Product[];
}

export async function getMyProductById(
  sellerId: string,
  id: string,
): Promise<Product | null> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(MY_SELECT_COLUMNS)
    .eq('id', id)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (error) {
    console.error('[getMyProductById]', error);
    throw new Error('상품을 불러오지 못했습니다.');
  }
  return data as unknown as Product | null;
}

export async function createMyProduct(
  sellerId: string,
  input: MyProductInput,
): Promise<Product> {
  const supabase = createAdminClient();
  const payload = await toPayload(input, sellerId);
  const { data, error } = await supabase
    .from('moda_products')
    .insert(payload)
    .select(MY_SELECT_COLUMNS)
    .single();
  if (error) {
    console.error('[createMyProduct]', error);
    // 23505 = unique_violation. slug는 UNIQUE 제약이라 다른 판매자/관리자가 이미 쓰고
    // 있는 이름(자동 생성된 slug)이면 여기서 걸린다 — 원인을 구분해 명확히 안내한다.
    if (error.code === '23505') {
      throw new MyProductError(
        409,
        '이미 사용 중인 이름(URL)입니다. 작품명을 다른 이름으로 바꿔서 다시 시도해주세요.',
        'slug',
      );
    }
    throw new Error('상품 등록에 실패했습니다.');
  }
  return data as unknown as Product;
}

export async function updateMyProduct(
  sellerId: string,
  id: string,
  input: MyProductInput,
): Promise<Product> {
  assertValidUUID(id);
  const supabase = createAdminClient();

  // 최초 승인(approved) 이후의 수정은 재검수를 요구하지 않는다 — review_status/is_active를
  // 건드리지 않고 나머지 필드만 즉시 반영한다. 아직 최초 승인을 못 받은 상품
  // (draft/pending/rejected)의 수정은 기존과 동일하게 미승인 상태로 유지된다.
  const { data: existing, error: existingError } = await supabase
    .from('moda_products')
    .select('review_status')
    .eq('id', id)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (existingError) {
    console.error('[updateMyProduct] lookup', existingError);
    throw new Error('상품 수정에 실패했습니다.');
  }
  if (!existing) throw new Error('본인 소유의 상품만 수정할 수 있습니다.');

  const fullPayload = await toPayload(input, sellerId);
  let payload: Partial<typeof fullPayload> = fullPayload;
  if (existing.review_status === 'approved') {
    const {
      review_status: _reviewStatus,
      is_active: _isActive,
      ...rest
    } = fullPayload;
    payload = rest;
  }

  const { data, error } = await supabase
    .from('moda_products')
    .update(payload)
    .eq('id', id)
    .eq('seller_id', sellerId)
    .select(MY_SELECT_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error('[updateMyProduct]', error);
    if (error.code === '23505') {
      throw new MyProductError(
        409,
        '이미 사용 중인 이름(URL)입니다. 작품명을 다른 이름으로 바꿔서 다시 시도해주세요.',
        'slug',
      );
    }
    throw new Error('상품 수정에 실패했습니다.');
  }
  if (!data) throw new Error('본인 소유의 상품만 수정할 수 있습니다.');
  return data as unknown as Product;
}

export async function deleteMyProduct(
  sellerId: string,
  id: string,
): Promise<void> {
  assertValidUUID(id);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_products')
    .delete()
    .eq('id', id)
    .eq('seller_id', sellerId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[deleteMyProduct]', error);
    throw new Error('상품 삭제에 실패했습니다.');
  }
  if (!data) throw new Error('본인 소유의 상품만 삭제할 수 있습니다.');
}

const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20MB

// 브라우저가 아니라 이 서버(service role)가 Storage에 직접 업로드한다 — seller에게
// anon key로 Storage RLS를 열어주지 않기 위한 결정(인증/보안 경계 확정 사항).
export async function uploadMyProductFile(
  file: File,
  bucket: 'products-images' | 'product-files',
  folder: string,
): Promise<{ path: string; publicUrl: string | null }> {
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new MyProductError(413, '파일 용량이 너무 큽니다 (최대 20MB).');
  }

  const supabase = createAdminClient();
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `${folder}/${filename}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
    });
  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);

  if (bucket === 'product-files') {
    // 다운로드 zip은 private 버킷 — public URL이 없다. downloads 엔드포인트가 signed URL을 발급.
    return { path: data.path, publicUrl: null };
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl };
}
