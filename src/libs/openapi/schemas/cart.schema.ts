import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const CartItemSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    optionId: z.string().openapi({ example: 'simple' }),
    optionLabel: z.string().openapi({ example: '단순복사' }),
    price: z.number().int().openapi({ example: 29000 }),
    createdAt: z.string().datetime().openapi({ example: '2026-08-03T00:00:00.000Z' }),
    product: z
      .object({
        id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
        name: z.string().openapi({ example: '디어틴트산타 쇼핑몰 기획전 랜딩페이지' }),
        slug: z.string().openapi({ example: 'fashion-sale-landing' }),
        thumbnailUrl: z.string().nullable().openapi({ example: 'https://example.com/thumbnail.jpg' }),
      })
      .nullable(),
  })
  .openapi('CartItem');

export const CartListResponseSchema = z
  .object({ data: z.array(CartItemSchema) })
  .openapi('CartListResponse');

export const AddCartItemRequestSchema = z
  .object({
    productId: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    optionId: z.string().openapi({ example: 'simple' }),
    optionLabel: z.string().openapi({ example: '단순복사' }),
    price: z.number().int().openapi({ example: 29000 }),
  })
  .openapi('AddCartItemRequest');

export const AddCartItemResponseSchema = z
  .object({ success: z.boolean().openapi({ example: true }) })
  .openapi('AddCartItemResponse');

export const RemoveCartItemResponseSchema = z
  .object({ success: z.boolean().openapi({ example: true }) })
  .openapi('RemoveCartItemResponse');

export function registerCartPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'post',
    path: '/api/v1/cart',
    summary: '장바구니 담기',
    description: '로그인한 유저가 상품+옵션을 장바구니에 담습니다. 동일 옵션을 다시 담으면 멱등하게 처리됩니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: AddCartItemRequestSchema } } },
    },
    responses: {
      200: { description: '담기 성공', content: { 'application/json': { schema: AddCartItemResponseSchema } } },
      400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      404: { description: '상품을 찾을 수 없음', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/cart/me',
    summary: '내 장바구니 목록 조회',
    description: '로그인한 유저 본인의 장바구니 목록을 상품 정보와 함께 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: { description: '내 장바구니 목록', content: { 'application/json': { schema: CartListResponseSchema } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'delete',
    path: '/api/v1/cart/{cartItemId}',
    summary: '장바구니 항목 삭제',
    description: '로그인한 유저 본인의 장바구니 항목을 삭제합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      params: z.object({ cartItemId: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }) }),
    },
    responses: {
      200: { description: '삭제 성공', content: { 'application/json': { schema: RemoveCartItemResponseSchema } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      404: { description: '장바구니 항목을 찾을 수 없음', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });
}
