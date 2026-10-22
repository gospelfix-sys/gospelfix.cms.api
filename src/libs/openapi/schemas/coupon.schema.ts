import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const CouponSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    code: z.string().openapi({ example: 'GF-AB12-CD34' }),
    discountRate: z.number().int().openapi({ example: 20 }),
    isUsed: z.boolean().openapi({ example: false }),
    isLocked: z.boolean().openapi({
      example: false,
      description:
        '할인 쿠폰 계정당 1회용 정책에 따라, 이 쿠폰으로 주문을 시도한 적이 한 번이라도 있으면(취소된 주문 포함) true. true면 더 이상 새 주문에 적용할 수 없다.',
    }),
    expiredAt: z
      .string()
      .datetime()
      .openapi({ example: '2026-09-09T00:00:00.000Z' }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: '2026-08-10T00:00:00.000Z' }),
    source: z
      .enum(['signup', 'referral', 'review'])
      .nullable()
      .openapi({
        example: 'signup',
        description:
          '쿠폰 발급 사유: signup(회원가입), referral(추천인 보상), review(리뷰 작성 보상). 컬럼 추가 이전에 발급된 쿠폰은 null(출처 미상).',
      }),
  })
  .openapi('Coupon');

export const MyCouponsResponseSchema = z
  .object({ data: z.array(CouponSchema) })
  .openapi('MyCouponsResponse');

export function registerCouponPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/coupons/me',
    summary: '내 쿠폰 목록 조회',
    description:
      '로그인한 유저 본인의 쿠폰 목록을 반환합니다. 회원가입 즉시(이메일 확인 불필요 케이스) 20% 할인 쿠폰이 자동 발급됩니다(발급 시각 + 30일 만료).',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: {
        description: '내 쿠폰 목록',
        content: { 'application/json': { schema: MyCouponsResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });
}
