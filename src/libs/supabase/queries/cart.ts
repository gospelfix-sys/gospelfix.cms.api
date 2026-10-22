import { createAdminClient } from '@/libs/supabase/admin';

export interface CartItemInput {
  userId: string;
  productId: string;
  optionId: string;
  optionLabel: string;
  price: number;
}

/**
 * 장바구니에 상품+옵션을 담는다.
 * (user_id, product_id, option_id) unique 제약 위반(23505)은 이미 담긴 것으로
 * 간주해 무시한다(idempotent — 재요청해도 에러 없이 성공 처리).
 */
export async function addCartItem(input: CartItemInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('moda_cart_items').insert({
    user_id: input.userId,
    product_id: input.productId,
    option_id: input.optionId,
    option_label: input.optionLabel,
    price: input.price,
  });

  if (error && error.code !== '23505') throw new Error(error.message);
}

export interface CartItemWithProduct {
  id: string;
  optionId: string;
  optionLabel: string;
  price: number;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnailUrl: string | null;
  } | null;
}

/**
 * 로그인 유저의 장바구니 목록을 상품 정보와 함께 반환한다.
 * FK join 대신 2단계 조회 후 앱단에서 매핑한다 (원본: orders.ts의 getPurchasedOrders).
 */
export async function getCartItems(
  userId: string,
): Promise<CartItemWithProduct[]> {
  const supabase = createAdminClient();

  // 1단계: 장바구니 항목 조회
  const { data: items, error: itemsError } = await supabase
    .from('moda_cart_items')
    .select('id, option_id, option_label, price, created_at, product_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (itemsError || !items || items.length === 0) {
    if (itemsError) console.error('[getCartItems] items error:', itemsError);
    return [];
  }

  // 2단계: 상품 정보 조회 (FK 설정 여부와 무관하게 동작)
  const productIds = (items as { product_id: string | null }[])
    .map((i) => i.product_id)
    .filter((id): id is string => Boolean(id));

  const { data: products, error: productsError } = await supabase
    .from('moda_products')
    .select('id, name, slug, thumbnail_url')
    .in('id', productIds);

  if (productsError)
    console.error('[getCartItems] products error:', productsError);

  const productMap = new Map(
    (
      (products ?? []) as {
        id: string;
        name: string;
        slug: string;
        thumbnail_url: string | null;
      }[]
    ).map((p) => [p.id, p]),
  );

  return (
    items as {
      id: string;
      option_id: string;
      option_label: string;
      price: number;
      created_at: string;
      product_id: string | null;
    }[]
  ).map((item) => {
    const product = item.product_id
      ? (productMap.get(item.product_id) ?? null)
      : null;

    return {
      id: item.id,
      optionId: item.option_id,
      optionLabel: item.option_label,
      price: item.price,
      createdAt: item.created_at,
      product: product
        ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            thumbnailUrl: product.thumbnail_url,
          }
        : null,
    };
  }) as CartItemWithProduct[];
}

/**
 * 장바구니 항목을 삭제한다. 본인 소유가 아니면 조용히 0행 삭제(false 반환) —
 * 404 처리는 호출부(route.ts)에서 담당한다.
 */
export async function deleteCartItem(
  userId: string,
  cartItemId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('moda_cart_items')
    .delete()
    .eq('id', cartItemId)
    .eq('user_id', userId)
    .select('id');

  if (error) throw new Error(error.message);
  return !!data && data.length > 0;
}
