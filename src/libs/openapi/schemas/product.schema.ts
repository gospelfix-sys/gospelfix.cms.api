import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry'; // ensures extendZodWithOpenApi(z) runs

// products.options(jsonb) 컬럼 원소 하나에 대응. select_columns의
// `purchase_options:options` 별칭으로 API에는 purchase_options 필드명으로 노출된다.
export const ProductPurchaseOptionSchema = z
  .object({
    id: z.string().openapi({ example: 'copy' }),
    label: z.string().openapi({ example: '단순복사' }),
    price: z.number().int().nullable().openapi({ example: 29000 }),
    description: z
      .string()
      .nullable()
      .openapi({ example: '디자인 수정작업 불포함' }),
    work_period_days: z.string().nullable().openapi({
      example: '7',
      description:
        '작업기간. 관리자 입력값이 그대로 저장되며 단위("일")는 포함되지 않는다. 숫자 문자열(예: "7") 또는 "협의" 같은 텍스트가 올 수 있다.',
    }),
    is_inquiry_only: z.boolean().openapi({
      example: false,
      description: '가격 대신 "별도 문의" 등으로 안내되는 항목인지 여부',
    }),
    detail: z
      .string()
      .nullable()
      .openapi({ example: '단순복사 + 커스터마이징' }),
  })
  .openapi('ProductPurchaseOption');

// products.code_preview(jsonb) 컬럼 원소 하나에 대응. label이 파일명 역할을 겸한다
// (예: "index.html", "data.json"). 개수 제한 없이 관리자가 자유롭게 추가/삭제한다.
export const ProductCodePreviewItemSchema = z
  .object({
    id: z.string().openapi({ example: 'a1b2c3d4-e5f6-4789-9abc-def012345678' }),
    label: z.string().openapi({ example: 'index.html' }),
    code: z
      .string()
      .openapi({ example: '<!DOCTYPE html>\n<html lang="ko">...' }),
  })
  .openapi('ProductCodePreviewItem');

export const ProductSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    slug: z.string().openapi({ example: 'react-dashboard-starter' }),
    name: z.string().openapi({ example: 'React 대시보드 스타터' }),
    description: z.string().nullable().openapi({
      example: '빠르게 시작할 수 있는 React 대시보드 템플릿입니다.',
    }),
    content_html: z.string().nullable().openapi({
      example: '<p>상세 설명 본문...</p>',
      description:
        '상품 상세페이지 본문 HTML(관리자 RichEditor/TipTap 출력). 프론트엔드에서 반드시 sanitize 후 렌더링해야 함.',
    }),
    discount_starts_at: z
      .string()
      .nullable()
      .openapi({
        example: '2026-08-10T00:00:00.000Z',
        description:
          '할인 시작 시각(ISO 8601). 이 기간 동안은 price가 판매가로 적용되고, ' +
          '기간이 끝나면 supply_price가 판매가로 전환된다(price=할인가, supply_price=정가). ' +
          'NULL이면 저장 즉시 할인이 시작된 것으로 취급',
      }),
    discount_ends_at: z.string().nullable().openapi({
      example: '2026-08-15T00:00:00.000Z',
      description:
        '할인 종료 시각(ISO 8601). 이 시각이 지나면 프론트에서 supply_price를 정가로 사용',
    }),
    category: z.string().nullable().openapi({ example: 'website' }),
    sub_categories: z
      .array(z.string())
      .openapi({ example: ['fashion_shopping'] }),
    thumbnail_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://example.com/thumbnail.jpg' }),
    images: z
      .array(z.string())
      .nullable()
      .openapi({
        example: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
      }),
    demo_url: z
      .string()
      .nullable()
      .openapi({ example: 'https://demo.example.com' }),
    price: z.number().int().nullable().openapi({ example: 19000 }),
    is_free: z
      .boolean()
      .openapi({ example: false, description: '무료 상품 여부 (price === 0)' }),
    price_display: z.string().nullable().openapi({
      example: '19,000원',
      description:
        '화면 표시용 가격 문자열. 무료 상품(price === 0)은 "FREE", price가 없으면 null, 그 외에는 "19,000원" 형식',
    }),
    supply_price: z
      .number()
      .nullable()
      .openapi({
        example: 58000,
        description:
          '공급원가(정가). 할인 기간(discount_starts_at/ends_at) 미설정 시 상세페이지에 취소선으로 ' +
          '표시되는 참고 가격이며, 할인 기간이 끝나면 이 값이 실제 판매가로 전환된다. NULL이면 취소선을 ' +
          '표시하지 않는다.',
      }),
    purchase_options: z
      .array(ProductPurchaseOptionSchema)
      .nullable()
      .openapi({
        description:
          'DB의 products.options(jsonb) 컬럼을 별칭 처리해 노출하는 구매항목 옵션 배열.',
        example: [
          {
            id: 'copy',
            label: '단순복사',
            price: 29000,
            description: '디자인 수정작업 불포함',
            work_period_days: '7',
            is_inquiry_only: false,
            detail: null,
          },
          {
            id: 'custom',
            label: '커스터마이징(구매 전 카카오 채널로 문의 주세요.)',
            price: null,
            description: null,
            is_inquiry_only: true,
            work_period_days: '협의',
            detail: '단순복사 + 커스터마이징',
          },
        ],
      }),
    production_solution: z.string().nullable().openapi({
      example: 'Supabase, Vercel',
      description:
        '상품 상세페이지 우측 구매 패널에 표시되는 제작솔루션 텍스트. NULL이면 프론트에서 기본값("Supabase, Vercel")으로 폴백한다.',
    }),
    product_code: z.string().nullable().openapi({
      example: 'PTMD856024',
      description:
        '상품 SKU 성격의 참조 코드. NULL이면 프론트에서 해당 항목을 표시하지 않는다.',
    }),
    design_type: z.string().nullable().openapi({
      example: '반응형',
      description:
        '템플릿 디자인 방식(반응형/고정형). NULL이면 프론트에서 해당 항목을 표시하지 않는다.',
    }),
    like_count: z.number().int().openapi({
      example: 6700,
      description:
        '상품 좋아요(하트) 누적 수. product_likes 테이블 행 수와 트리거로 동기화된다.',
    }),
    has_ai_starter_kit: z.boolean().openapi({
      example: false,
      description:
        'true면 상세페이지에 "AI 확장" 칩과 .claude 스타터 킷 다운로드 링크가 노출된다. ' +
        '템플릿별 맞춤 파일이 아니라 모든 상품이 공유하는 정적 자산이다.',
    }),
    code_preview: z
      .array(ProductCodePreviewItemSchema)
      .nullable()
      .openapi({
        description:
          '상품 상세페이지 "코드 미리보기" 섹션 탭 배열(FREE 옵션 실제 제공 파일 발췌본). 비어있으면 섹션 자체를 숨긴다.',
        example: [
          {
            id: 'a1b2c3d4-e5f6-4789-9abc-def012345678',
            label: 'index.html',
            code: '<!DOCTYPE html>...',
          },
          {
            id: 'b2c3d4e5-f6a7-4890-abcd-ef0123456789',
            label: 'style.css',
            code: '.hero { display: flex; }',
          },
        ],
      }),
    license: z
      .enum(['cc-by', 'cc-by-nc', 'cc-by-nc-nd', 'all-rights-reserved'])
      .openapi({
        example: 'all-rights-reserved',
        description:
          '저작권 및 라이선스. cc-by(저작권표시) / cc-by-nc(저작권표시-비영리) / ' +
          'cc-by-nc-nd(저작권표시-비영리-변경금지) / all-rights-reserved(판권소유, 기본값)',
      }),
    created_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-07-20T00:00:00.000Z' }),
    updated_at: z
      .string()
      .datetime()
      .openapi({ example: '2026-07-20T00:00:00.000Z' }),
  })
  .openapi('Product');

export const ProductListResponseSchema = z
  .object({
    data: z.array(ProductSchema),
    total: z.number().int().openapi({ example: 12 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 10 }),
  })
  .openapi('ProductListResponse');

export const ProductDetailResponseSchema = z
  .object({
    data: ProductSchema,
  })
  .openapi('ProductDetailResponse');

export const ProductLikeStatusResponseSchema = z
  .object({
    like_count: z.number().int().openapi({ example: 6700 }),
    liked_by_me: z.boolean().openapi({
      example: false,
      description: 'Bearer 토큰이 없거나 미로그인이면 항상 false',
    }),
  })
  .openapi('ProductLikeStatusResponse');

export const ProductLikeToggleResponseSchema = z
  .object({
    like_count: z.number().int().openapi({ example: 6701 }),
    liked: z.boolean().openapi({ example: true }),
  })
  .openapi('ProductLikeToggleResponse');

export function registerProductPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/products',
    summary: '활성 상품 목록 조회',
    description:
      '활성(active) 상태인 상품을 페이지네이션으로 반환합니다. `file_path` 등 내부 필드는 포함되지 않습니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        page: z
          .string()
          .optional()
          .openapi({ example: '1', description: '페이지 번호 (기본값: 1)' }),
        limit: z.string().optional().openapi({
          example: '10',
          description: '페이지당 건수 (기본값: 10, 최대: 50)',
        }),
        sort_by: z.enum(['created_at', 'like_count']).optional().openapi({
          example: 'like_count',
          description:
            '정렬 기준 컬럼. 미지정 시 관리자 설정(content_api_configs.order_column) 기본 정렬(추천순) 사용. `like_count`=인기순, `created_at`=최근순, 둘 다 내림차순.',
        }),
        price_type: z.enum(['free', 'premium']).optional().openapi({
          example: 'free',
          description:
            '가격 필터. `free`=무료(price=0)만, `premium`=유료 상품만. 미지정 시 전체.',
        }),
      }),
    },
    responses: {
      200: {
        description: '상품 목록',
        content: { 'application/json': { schema: ProductListResponseSchema } },
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
    path: '/api/v1/products/{id}',
    summary: '상품 단건 조회',
    description: 'UUID로 활성 상품 상세를 반환합니다.',
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
        description: '상품 상세',
        content: {
          'application/json': { schema: ProductDetailResponseSchema },
        },
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
        description: '상품을 찾을 수 없음',
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/products/{id}/like',
    summary: '상품 좋아요 수 · 내 좋아요 여부 조회',
    description:
      '공개 엔드포인트. Bearer 토큰이 있으면 liked_by_me를 함께 반환하고, 없으면 liked_by_me는 항상 false.',
    security: [{ ApiKeyAuth: [] }, { ApiKeyAuth: [], BearerAuth: [] }],
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
        description: '좋아요 상태',
        content: {
          'application/json': { schema: ProductLikeStatusResponseSchema },
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
    method: 'post',
    path: '/api/v1/products/{id}/like',
    summary: '상품 좋아요 토글',
    description:
      '로그인한 사용자 기준으로 좋아요를 추가하거나(없었으면) 취소한다(있었으면). 사용자당 상품 1개당 1회로 제한된다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
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
        description: '토글 성공',
        content: {
          'application/json': { schema: ProductLikeToggleResponseSchema },
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
    },
  });
}
