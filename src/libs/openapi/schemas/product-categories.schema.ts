import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const ProductCategorySchema = z
  .object({
    value: z.string().openapi({
      example: 'website',
      description: '상품 category 컬럼에 그대로 저장되는 안정적인 키.',
    }),
    label: z.string().openapi({ example: '웹사이트' }),
    sort_order: z.number().int().openapi({
      example: 1,
      description: '노출 순서(오름차순).',
    }),
  })
  .openapi('ProductCategory');

export const ProductCategoryListResponseSchema = z
  .object({
    data: z.array(ProductCategorySchema),
    total: z.number().int().openapi({ example: 3 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 50 }),
  })
  .openapi('ProductCategoryListResponse');

export function registerProductCategoryPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/product-categories',
    summary: '상품 대분류 목록 조회',
    description:
      '활성(is_active=true) 대분류를 노출 순서(sort_order 오름차순)로 반환합니다. ' +
      'gospelfix 상품 업로드 화면·카테고리 필터 탭이 이 목록을 그대로 사용합니다.',
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
        description: '활성 대분류 목록',
        content: { 'application/json': { schema: ProductCategoryListResponseSchema } },
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
