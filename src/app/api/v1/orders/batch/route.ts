import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { requireBearerUser, AdminAuthError } from '@/libs/supabase/queries/auth';
import { getActiveProductById } from '@/libs/supabase/queries/products';
import {
  hasPurchasedProduct,
  createPendingOrder,
  deleteOrdersByOrderIds,
} from '@/libs/supabase/queries/orders';
import { getEffectivePrice } from '@/libs/pricing/productPriceState';

interface BatchOrderItem {
  productId: string;
  amount: number;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/orders/batch
 * 장바구니에서 선택한 여러 상품을 한 번에 pending 주문으로 생성한다.
 * (참고: main/src/components/cart/CartModal — 배치 결제하기 버튼)
 * orders 테이블/createPendingOrder는 바꾸지 않고, 항목 수만큼 반복 생성한다(주문 1건 = 상품 1건 유지).
 * 하나라도 검증 실패하면 아무 주문도 생성하지 않는다(all-or-nothing).
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const { items, agreedToWithdrawalNotice } = (await request.json()) as {
      items?: BatchOrderItem[];
      agreedToWithdrawalNotice?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '선택된 상품이 없습니다.' }, { status: 400 });
    }
    if (
      items.some(
        (item) => !item.productId || typeof item.amount !== 'number' || item.amount < 0,
      )
    ) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }
    if (agreedToWithdrawalNotice !== true) {
      return NextResponse.json(
        { error: '청약철회 제한 안내 동의가 필요합니다.' },
        { status: 400 },
      );
    }

    const user = await requireBearerUser(request);

    // 1단계: 전체 항목 검증 (하나라도 실패하면 아무것도 생성하지 않음)
    for (const item of items) {
      const product = await getActiveProductById(item.productId);
      if (!product) {
        return NextResponse.json(
          { error: `상품을 찾을 수 없습니다. (productId: ${item.productId})` },
          { status: 404 },
        );
      }
      if (getEffectivePrice(product) !== item.amount) {
        return NextResponse.json(
          { error: `결제 금액이 올바르지 않습니다. (productId: ${item.productId})` },
          { status: 400 },
        );
      }
      const alreadyPurchased = await hasPurchasedProduct(user.id, item.productId);
      if (alreadyPurchased) {
        return NextResponse.json(
          { error: `이미 구매한 상품입니다. (productId: ${item.productId})` },
          { status: 409 },
        );
      }
    }

    // 2단계: 검증 통과한 항목만큼 pending 주문 생성
    const orderIds: string[] = [];
    try {
      for (const item of items) {
        const orderId = crypto.randomUUID();
        await createPendingOrder({
          userId: user.id,
          productId: item.productId,
          orderId,
          amount: item.amount,
          agreedToWithdrawalNotice,
        });
        orderIds.push(orderId);
      }
    } catch (insertError) {
      console.error('[POST /api/v1/orders/batch] insert error:', insertError);
      // 부분 생성된 pending 주문이 남지 않도록 보상 트랜잭션으로 정리한다(all-or-nothing 유지)
      if (orderIds.length > 0) {
        try {
          await deleteOrdersByOrderIds(orderIds, user.id);
        } catch (rollbackError) {
          console.error('[POST /api/v1/orders/batch] rollback error:', rollbackError);
        }
      }
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ orderIds });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/v1/orders/batch] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
