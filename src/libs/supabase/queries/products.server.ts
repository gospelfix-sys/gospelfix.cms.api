import { createClient } from '@/libs/supabase/server';
import type { ProductPurchaseOption } from '@/types/product';

// DB 컬럼명(options)과 응답 필드명(purchase_options)이 다르므로 alias로 select
const PUBLIC_FIELDS =
  'id,slug,name,description,category,thumbnail_url,images,demo_url,price,supply_price,purchase_options:options,production_solution,product_code,design_type,created_at,updated_at' as const;

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  demo_url: string | null;
  price: number;
  supply_price: number | null;
  purchase_options: ProductPurchaseOption[] | null;
  production_solution: string | null;
  product_code: string | null;
  design_type: string | null;
  created_at: string;
  updated_at: string;
}

export async function getActiveProducts(
  page: number,
  limit: number,
): Promise<{ products: PublicProduct[]; total: number }> {
  const supabase = createClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('moda_products')
    .select(PUBLIC_FIELDS, { count: 'exact' })
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[getActiveProducts]', error);
    throw new Error('상품 목록을 불러오지 못했습니다.');
  }
  return { products: (data ?? []) as PublicProduct[], total: count ?? 0 };
}

export async function getActiveProductById(
  id: string,
): Promise<PublicProduct | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(PUBLIC_FIELDS)
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[getActiveProductById]', error);
    throw new Error('상품을 불러오지 못했습니다.');
  }
  return data as PublicProduct;
}

export async function getActiveProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('moda_products')
    .select(PUBLIC_FIELDS)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('[getActiveProductBySlug]', error);
    throw new Error('상품을 불러오지 못했습니다.');
  }
  return data as PublicProduct;
}
