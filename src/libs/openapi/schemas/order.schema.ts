import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const OrderSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    user_id: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440001' }),
    product_id: z
      .string()
      .uuid()
      .nullable()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    order_id: z.string().openapi({ example: 'ORD-20260721-001' }),
    amount: z.number().int().openapi({ example: 29000 }),
    status: z
      .enum(['pending', 'pending_confirm', 'paid', 'cancelled'])
      .openapi({ example: 'paid' }),
    payment_key: z
      .string()
      .nullable()
      .openapi({ example: 'toss_payment_key_123' }),
    withdrawal_notice_agreed: z
      .boolean()
      .openapi({ example: true, description: '청약철회 제한 안내 동의 여부' }),
    paid_at: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-07-21T10:00:00.000Z' }),
    created_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-07-21T00:00:00.000Z' }),
    updated_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-07-21T00:00:00.000Z' }),
  })
  .openapi('Order');

export const OrderListResponseSchema = z
  .object({
    data: z.array(OrderSchema),
    total: z.number().int().openapi({ example: 50 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 10 }),
  })
  .openapi('OrderListResponse');

export const OrderDetailResponseSchema = z
  .object({ data: OrderSchema })
  .openapi('OrderDetailResponse');

export const CreateOrderRequestSchema = z
  .object({
    productId: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    amount: z.number().int().openapi({ example: 29000 }),
    agreedToWithdrawalNotice: z.boolean().openapi({
      example: true,
      description: '청약철회 제한 안내 동의 여부 (필수: true)',
    }),
    couponCode: z.string().optional().openapi({
      example: 'GF-AB12-CD34',
      description:
        '적용할 쿠폰 코드(선택). 유료 상품에만 적용 가능하며, 서버에서 할인율만큼 재계산한 금액이 amount와 일치해야 한다.',
    }),
  })
  .openapi('CreateOrderRequest');

export const CreateOrderResponseSchema = z
  .object({
    orderId: z
      .string()
      .openapi({ example: 'b3f1c2e4-5678-4abc-9def-1234567890ab' }),
  })
  .openapi('CreateOrderResponse');

export const NotifyPaymentResponseSchema = z
  .object({ success: z.boolean().openapi({ example: true }) })
  .openapi('NotifyPaymentResponse');

export const ConfirmPaymentRequestSchema = z
  .object({
    paymentKey: z.string().min(1).openapi({
      example: 'T1234567890123456789',
      description:
        '카카오페이 결제 승인 시 발급되는 tid. orders.payment_key 컬럼에 저장된다.',
    }),
  })
  .openapi('ConfirmPaymentRequest');

export const MyOrderSchema = z
  .object({
    orderId: z.string().openapi({ example: 'ORD-20260721-001' }),
    paidAt: z
      .string()
      .datetime()
      .nullable()
      .openapi({ example: '2026-07-21T10:00:00.000Z' }),
    amount: z.number().int().openapi({ example: 29000 }),
    product: z
      .object({
        id: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
        name: z.string().openapi({ example: 'React 대시보드 스타터' }),
        thumbnailUrl: z
          .string()
          .nullable()
          .openapi({ example: 'https://example.com/thumbnail.jpg' }),
        filePath: z
          .string()
          .nullable()
          .openapi({ example: 'products/react-dashboard.zip' }),
      })
      .nullable(),
  })
  .openapi('MyOrder');

export const MyOrdersResponseSchema = z
  .object({ data: z.array(MyOrderSchema) })
  .openapi('MyOrdersResponse');

export const MyPendingOrderSchema = z
  .object({
    orderId: z.string().openapi({ example: 'ORD-20260721-001' }),
    status: z
      .enum(['pending', 'pending_confirm'])
      .openapi({ example: 'pending' }),
    amount: z.number().int().openapi({ example: 29000 }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: '2026-07-21T10:00:00.000Z' }),
    product: z
      .object({
        id: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
        name: z.string().openapi({ example: 'React 대시보드 스타터' }),
        thumbnailUrl: z
          .string()
          .nullable()
          .openapi({ example: 'https://example.com/thumbnail.jpg' }),
      })
      .nullable(),
  })
  .openapi('MyPendingOrder');

export const MyPendingOrdersResponseSchema = z
  .object({ data: z.array(MyPendingOrderSchema) })
  .openapi('MyPendingOrdersResponse');

export const DownloadUrlResponseSchema = z
  .object({
    url: z.string().openapi({
      example: 'https://xxxx.supabase.co/storage/v1/object/sign/product-files/...',
      description: '일정 시간만 유효한 서명된 다운로드 URL',
    }),
    expiresAt: z
      .string()
      .datetime()
      .openapi({ example: '2026-08-08T10:05:00.000Z' }),
  })
  .openapi('DownloadUrlResponse');

export const CreateBatchOrderRequestSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z
            .string()
            .uuid()
            .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
          amount: z.number().int().openapi({ example: 29000 }),
        }),
      )
      .min(1),
    agreedToWithdrawalNotice: z.boolean().openapi({
      example: true,
      description: '청약철회 제한 안내 동의 여부 (필수: true)',
    }),
  })
  .openapi('CreateBatchOrderRequest');

export const CreateBatchOrderResponseSchema = z
  .object({
    orderIds: z
      .array(z.string())
      .openapi({ example: ['b3f1c2e4-...', 'a1c2d3e4-...'] }),
  })
  .openapi('CreateBatchOrderResponse');

export const NotifyPaymentBatchRequestSchema = z
  .object({
    orderIds: z
      .array(z.string())
      .min(1)
      .openapi({ example: ['b3f1c2e4-...', 'a1c2d3e4-...'] }),
  })
  .openapi('NotifyPaymentBatchRequest');

export function registerOrderPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/orders',
    summary: '주문 목록 조회',
    description: '전체 주문 목록을 페이지네이션으로 반환합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        page: z
          .string()
          .optional()
          .openapi({ example: '1', description: '페이지 번호 (기본값: 1)' }),
        limit: z.string().optional().openapi({
          example: '10',
          description: '페이지당 건수 (기본값: 10)',
        }),
      }),
    },
    responses: {
      200: {
        description: '주문 목록',
        content: { 'application/json': { schema: OrderListResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/orders/{id}',
    summary: '주문 단건 조회',
    description: 'UUID로 주문 상세를 반환합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({
        id: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
      }),
    },
    responses: {
      200: {
        description: '주문 상세',
        content: { 'application/json': { schema: OrderDetailResponseSchema } },
      },
      400: {
        description: '유효하지 않은 UUID',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '주문을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/orders',
    summary: '주문 생성',
    description:
      'main 앱의 결제 위젯이 결제를 시작하기 전 주문 레코드를 pending 상태로 생성합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: CreateOrderRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '주문 생성 성공',
        content: { 'application/json': { schema: CreateOrderResponseSchema } },
      },
      400: {
        description:
          '필수 파라미터 누락, 결제 금액 불일치 또는 청약철회 안내 미동의',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '상품을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      409: {
        description: '이미 구매한 상품',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/orders/{orderId}/notify-payment',
    summary: '입금 알림 접수',
    description:
      '사용자가 입금했다는 알림을 전달해 주문 상태를 pending → pending_confirm으로 전환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      params: z.object({
        orderId: z.string().openapi({ example: 'ORD-20260721-001' }),
      }),
    },
    responses: {
      200: {
        description: '접수 성공(멱등)',
        content: {
          'application/json': { schema: NotifyPaymentResponseSchema },
        },
      },
      400: {
        description: '주문 ID 누락',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '주문을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      409: {
        description: '처리할 수 없는 주문 상태',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/orders/{orderId}/confirm-payment',
    summary: '카카오페이 결제 완료 콜백',
    description:
      'main 앱이 카카오페이 결제 승인 완료 후 호출해 주문 상태를 즉시 paid로 전환합니다(무통장입금과 달리 pending_confirm 단계를 거치지 않음).',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      params: z.object({
        orderId: z.string().openapi({ example: 'ORD-20260721-001' }),
      }),
      body: {
        content: {
          'application/json': { schema: ConfirmPaymentRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '결제 확정 성공(멱등)',
        content: {
          'application/json': { schema: NotifyPaymentResponseSchema },
        },
      },
      400: {
        description: '주문 ID 또는 paymentKey 누락',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '주문을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      409: {
        description: '처리할 수 없는 주문 상태(취소됨 등)',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/orders/me',
    summary: '내 구매 목록 조회',
    description:
      '로그인한 유저 본인의 결제 완료(paid) 주문 목록을 상품 정보와 함께 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: {
        description: '내 구매 목록',
        content: { 'application/json': { schema: MyOrdersResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/orders/me/pending',
    summary: '내 결제 대기 주문 목록 조회',
    description:
      '로그인한 유저 본인의 결제 대기(pending/pending_confirm) 주문 목록을 상품 정보와 함께 반환합니다. 무통장입금 안내(계좌번호/QR)를 마이페이지에서 다시 확인할 때 사용합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: {
        description: '내 결제 대기 주문 목록',
        content: {
          'application/json': { schema: MyPendingOrdersResponseSchema },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/downloads/{productId}',
    summary: '구매 상품 다운로드 URL 발급',
    description:
      '구매 완료(paid)한 상품의 zip 파일을 다운로드할 수 있는 서명된 URL을 발급합니다(5분 유효). 구매하지 않은 상품이거나 파일이 아직 준비되지 않은 상품은 각각 403/404를 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      params: z.object({
        productId: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
      }),
    },
    responses: {
      200: {
        description: '다운로드 URL 발급 성공',
        content: {
          'application/json': { schema: DownloadUrlResponseSchema },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      403: {
        description: '구매하지 않은 상품',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '다운로드 파일이 준비되지 않음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/orders/batch',
    summary: '배치 주문 생성',
    description:
      '장바구니에서 선택한 여러 상품을 한 번에 pending 주문으로 생성합니다. 하나라도 검증에 실패하면 아무 주문도 생성하지 않습니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: CreateBatchOrderRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '주문 생성 성공',
        content: {
          'application/json': { schema: CreateBatchOrderResponseSchema },
        },
      },
      400: {
        description:
          '필수 파라미터 누락, 결제 금액 불일치 또는 청약철회 안내 미동의',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '상품을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      409: {
        description: '이미 구매한 상품',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/orders/notify-payment-batch',
    summary: '배치 입금 알림 접수',
    description:
      '장바구니 배치 결제에서 선택한 여러 주문을 한 번에 pending → pending_confirm으로 전환합니다(멱등).',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: NotifyPaymentBatchRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '접수 성공(멱등)',
        content: {
          'application/json': { schema: NotifyPaymentResponseSchema },
        },
      },
      400: {
        description: '주문 ID 누락',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
      404: {
        description: '주문을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });
}
