import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const ReviewSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    product_id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    user_id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440001' }),
    rating: z.number().int().min(1).max(5).openapi({ example: 5 }),
    content: z.string().nullable().openapi({ example: '정말 유용한 상품이었습니다.' }),
    created_at: z.string().datetime().openapi({ example: '2026-07-21T00:00:00.000Z' }),
    profiles: z
      .object({
        full_name: z.string().nullable().openapi({ example: '홍길동' }),
        avatar_url: z.string().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
        email: z.string().openapi({ example: 'user@example.com' }),
      })
      .nullable(),
  })
  .openapi('Review');

export const ReviewListResponseSchema = z
  .object({ data: z.array(ReviewSchema) })
  .openapi('ReviewListResponse');

export const CreateReviewRequestSchema = z
  .object({
    productId: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    rating: z.number().int().min(1).max(5).openapi({ example: 5 }),
    content: z.string().openapi({ example: '정말 유용한 상품이었습니다.' }),
  })
  .openapi('CreateReviewRequest');

export const MyReviewSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    product_id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
    rating: z.number().int().min(1).max(5).openapi({ example: 5 }),
    content: z.string().nullable().openapi({ example: '정말 유용한 상품이었습니다.' }),
    created_at: z.string().datetime().openapi({ example: '2026-07-21T00:00:00.000Z' }),
    product: z
      .object({
        name: z.string().openapi({ example: '랜딩페이지 템플릿 A' }),
        thumbnail_url: z.string().nullable().openapi({ example: 'https://example.com/thumb.jpg' }),
        slug: z.string().openapi({ example: 'landing-a' }),
      })
      .nullable(),
  })
  .openapi('MyReview');

export const MyReviewListResponseSchema = z
  .object({ data: z.array(MyReviewSchema) })
  .openapi('MyReviewListResponse');

export function registerReviewPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/reviews',
    summary: '상품 리뷰 목록 조회',
    description: '특정 상품(product_id)의 리뷰 목록을 반환합니다. 공개 엔드포인트입니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        product_id: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440002' }),
      }),
    },
    responses: {
      200: { description: '리뷰 목록', content: { 'application/json': { schema: ReviewListResponseSchema } } },
      400: { description: 'product_id 누락', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/reviews',
    summary: '리뷰 작성/수정',
    description: '구매한 상품에 한해 리뷰를 작성하거나 기존 리뷰를 수정합니다(upsert). 서버에서 구매 여부를 재검증합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: CreateReviewRequestSchema } } },
    },
    responses: {
      200: {
        description: '작성/수정 성공',
        content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
      },
      400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      403: { description: '구매하지 않은 상품', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/reviews/me',
    summary: '내가 작성한 리뷰 목록 조회',
    description: '본인이 작성한 리뷰 전체를 상품 정보(name/thumbnail_url/slug)와 함께 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: { description: '내 리뷰 목록', content: { 'application/json': { schema: MyReviewListResponseSchema } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });
}
