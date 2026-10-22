import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const ProductSubCategorySchema = z
  .object({
    value: z.string().openapi({
      example: 'beauty_women',
      description: '상품 sub_categories(jsonb 배열) 원소로 그대로 저장되는 안정적인 키.',
    }),
    label: z.string().openapi({ example: '뷰티/여성' }),
    sort_order: z.number().int().openapi({
      example: 6,
      description: '노출 순서(오름차순).',
    }),
  })
  .openapi('ProductSubCategory');

export const ProductSubCategoryListResponseSchema = z
  .object({
    data: z.array(ProductSubCategorySchema),
    total: z.number().int().openapi({ example: 15 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 50 }),
  })
  .openapi('ProductSubCategoryListResponse');

export function registerProductSubCategoryPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/product-sub-categories',
    summary: '상품 소분류 목록 조회',
    description:
      '활성(is_active=true) 소분류를 노출 순서(sort_order 오름차순)로 반환합니다. ' +
      '대분류(product-categories)와 직교(orthogonal) 관계이며, 어떤 대분류를 골라도 ' +
      '동일한 소분류 목록이 노출됩니다. gospelfix 상품 업로드 화면이 이 목록을 ' +
      '최대 3개 다중선택 UI로 사용합니다.',
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
        description: '활성 소분류 목록',
        content: { 'application/json': { schema: ProductSubCategoryListResponseSchema } },
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
