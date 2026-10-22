import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const ReferralBannerSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    message: z
      .string()
      .openapi({ example: '추천인 코드를 공유하면 나와 친구 모두 50% 할인 쿠폰을 받아요' }),
    discount_rate: z.number().int().openapi({
      example: 50,
      description:
        '노출 순서가 가장 앞선 활성 배너의 값이 실제 발급되는 추천 쿠폰 할인율로 사용됩니다.',
    }),
    show_referral_actions: z.boolean().openapi({
      example: true,
      description:
        'true면 프론트에서 배너 하단에 추천인 코드 배지 + 코드 복사/링크 공유 버튼을 함께 표시한다. false면 문구만 표시된다.',
    }),
    sort_order: z.number().int().openapi({
      example: 1,
      description: '롤링 노출 순서(오름차순).',
    }),
    created_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-08-12T00:00:00.000Z' }),
    updated_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-08-12T00:00:00.000Z' }),
  })
  .openapi('ReferralBanner');

export const ReferralBannerListResponseSchema = z
  .object({
    data: z.array(ReferralBannerSchema),
    total: z.number().int().openapi({ example: 3 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 50 }),
  })
  .openapi('ReferralBannerListResponse');

export function registerReferralBannerPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/referral-banners',
    summary: '활성 롤링 배너 목록 조회',
    description:
      '노출 순서(sort_order 오름차순)로 활성(is_enabled=true) 배너를 반환합니다. ' +
      '마이페이지/몰 페이지 하단 배너가 이 순서대로 롤링 표시됩니다. 추천인 코드 공유 ' +
      '외에 코드/버튼이 필요 없는 일반 홍보 문구도 포함될 수 있습니다(show_referral_actions 참고).',
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        page: z
          .string()
          .optional()
          .openapi({ example: '1', description: '페이지 번호 (기본값: 1)' }),
        limit: z.string().optional().openapi({
          example: '50',
          description: '페이지당 건수 (기본값: 10, 최대: 50)',
        }),
      }),
    },
    responses: {
      200: {
        description: '활성 배너 목록',
        content: { 'application/json': { schema: ReferralBannerListResponseSchema } },
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
