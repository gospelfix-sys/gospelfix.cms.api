import { createAdminClient } from '@/libs/supabase/admin';
import {
  getPublicSellerIdentity,
  type PublicSellerIdentity,
} from '@/libs/supabase/queries/seller-identity';

export interface ProductSellerInfo {
  registered_at: string;
  // 플랫폼 직접 등록분(seller_id NULL)은 개인 판매자가 없으므로 null
  seller: {
    name: string;
    avatar_url: string | null;
    handle: string;
  } | null;
  // 전자상거래법 제20조② 주문 전 신원정보. 승인 전·미제출(기존 판매자 유예 포함)이면 null
  identity: PublicSellerIdentity | null;
}

/**
 * 이메일 앞부분을 일부만 보이게 가린다(예: "younho@x.com" → "yo***").
 * 공개 API라 이메일 원문을 내보내면 판매자 개인정보가 노출되므로, 서비스에 별도 "아이디"
 * 컬럼이 생기기 전까지는 가린 이메일 아이디를 판매자 식별자로 쓴다.
 */
function maskEmailHandle(email: string | null): string {
  const local = (email ?? '').split('@')[0];
  if (!local) return '';
  // 짧은 아이디는 앞 2글자만 써도 전부 드러나므로 최소 1글자는 가린다.
  const visible = Math.min(2, local.length - 1);
  return `${local.slice(0, visible)}***`;
}

/**
 * 상품 상세 상단에 노출할 등록일·판매자 공개 정보를 id로 조회한다.
 * 공개 카탈로그의 select_columns 화이트리스트(seller_id·created_at 포함 여부는 DB 설정에
 * 달려 있다)에 의존하지 않도록 전용 조회로 분리했고, 판매자는 이름·프로필 이미지·가린
 * 아이디만 내려준다. 활성(is_active) 상품이 아니면 null.
 */
export async function getProductSellerInfo(
  productId: string,
): Promise<ProductSellerInfo | null> {
  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from('moda_products')
    .select('created_at, seller_id')
    .eq('id', productId)
    .eq('is_active', true)
    .single();

  if (error || !product) return null;

  if (!product.seller_id) {
    return { registered_at: product.created_at, seller: null, identity: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, email')
    .eq('id', product.seller_id)
    .maybeSingle();

  if (!profile) {
    return { registered_at: product.created_at, seller: null, identity: null };
  }

  const handle = maskEmailHandle(profile.email);
  return {
    registered_at: product.created_at,
    seller: {
      name: profile.full_name?.trim() || handle || '판매자',
      avatar_url: profile.avatar_url,
      handle,
    },
    identity: await getPublicSellerIdentity(product.seller_id),
  };
}
