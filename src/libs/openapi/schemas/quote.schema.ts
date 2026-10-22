import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const QuoteSchema = z
  .object({
    id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    contact_name: z.string().openapi({ example: '홍길동' }),
    contact_value: z.string().openapi({ example: '010-1234-5678' }),
    contact_email: z.string().openapi({ example: 'contact@example.com' }),
    selected_categories: z.array(z.string()).nullable().openapi({ example: ['웹사이트', '쇼핑몰'] }),
    schedule: z.string().nullable().openapi({ example: '3개월 이내' }),
    style_preferences: z.array(z.string()).nullable().openapi({ example: ['모던', '미니멀'] }),
    target_age: z.string().nullable().openapi({ example: '20-30대' }),
    business_number: z.string().nullable().openapi({ example: '123-45-67890' }),
    project_summary: z.string().nullable().openapi({ example: '회사 소개 웹사이트 제작' }),
    estimated_total: z.number().int().nullable().openapi({ example: 5000000 }),
    shop_industry: z.string().nullable().openapi({ example: '의류' }),
    shop_status: z.string().nullable().openapi({ example: '운영 중' }),
    production_scope: z.string().nullable().openapi({ example: '신규 제작' }),
    required_features: z.array(z.string()).nullable().openapi({ example: ['게시판', '결제'] }),
    needs_system_dev: z.boolean().nullable().openapi({ example: false }),
    is_authenticated: z.boolean().nullable().openapi({ example: false }),
    created_at: z.string().datetime().openapi({ example: '2026-07-21T00:00:00.000Z' }),
  })
  .openapi('Quote');

export const QuoteListResponseSchema = z
  .object({
    data: z.array(QuoteSchema),
    total: z.number().int().openapi({ example: 30 }),
    page: z.number().int().openapi({ example: 1 }),
    limit: z.number().int().openapi({ example: 10 }),
  })
  .openapi('QuoteListResponse');

export const QuoteDetailResponseSchema = z
  .object({ data: QuoteSchema })
  .openapi('QuoteDetailResponse');

export const SubmitQuoteRequestSchema = z
  .object({
    selectedCategories: z.array(z.string()).nullable().openapi({ example: ['웹사이트', '쇼핑몰'] }),
    selectedItems: z
      .array(
        z.object({
          id: z.string().openapi({ example: 'shopping_cafe24' }),
          quantity: z.number().int().openapi({ example: 1 }),
          withCopywriting: z.boolean().openapi({ example: false }),
        }),
      )
      .nullable(),
    schedule: z.string().nullable().openapi({ example: 'within_1month' }),
    stylePreferences: z.array(z.string()).nullable().openapi({ example: ['modern', 'minimal'] }),
    targetAge: z.string().nullable().openapi({ example: '30s_40s' }),
    contactName: z.string().openapi({ example: '홍길동' }),
    contactValue: z.string().openapi({ example: '010-1234-5678' }),
    contactEmail: z.string().nullable().openapi({ example: 'contact@example.com' }),
    businessNumber: z.string().nullable().openapi({ example: '123-45-67890' }),
    projectSummary: z.string().nullable().openapi({ example: '회사 소개 웹사이트 제작' }),
    referenceUrls: z.array(z.string()).openapi({ example: ['https://example.com'] }),
    estimatedTotal: z.number().int().nullable().openapi({ example: 5000000 }),
    shopIndustry: z.string().nullable().openapi({ example: 'fashion' }),
    shopStatus: z.string().nullable().openapi({ example: 'new' }),
    productionScope: z.string().nullable().openapi({ example: 'basic' }),
    requiredFeatures: z.array(z.string()).nullable().openapi({ example: ['coupon_point'] }),
    needsSystemDev: z.boolean().nullable().openapi({ example: false }),
    utmParams: z.record(z.string()).nullable().openapi({ example: { utm_source: 'naver' } }),
    ipAddress: z.string().nullable().openapi({ example: '127.0.0.1' }),
    userAgent: z.string().nullable().openapi({ example: 'Mozilla/5.0' }),
    referer: z.string().nullable().openapi({ example: 'https://gospelfix.com/quote' }),
  })
  .openapi('SubmitQuoteRequest');

export const SubmitQuoteResponseSchema = z
  .object({ id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }) })
  .openapi('SubmitQuoteResponse');

export function registerQuotePaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/quotes',
    summary: '견적 신청 목록 조회',
    description: '전체 견적 신청 목록을 페이지네이션으로 반환합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      query: z.object({
        page: z.string().optional().openapi({ example: '1', description: '페이지 번호 (기본값: 1)' }),
        limit: z.string().optional().openapi({ example: '10', description: '페이지당 건수 (기본값: 10)' }),
      }),
    },
    responses: {
      200: { description: '견적 신청 목록', content: { 'application/json': { schema: QuoteListResponseSchema } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/quotes/{id}',
    summary: '견적 신청 단건 조회',
    description: 'UUID로 견적 신청 상세를 반환합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }) }),
    },
    responses: {
      200: { description: '견적 신청 상세', content: { 'application/json': { schema: QuoteDetailResponseSchema } } },
      400: { description: '유효하지 않은 UUID', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      404: { description: '견적 신청을 찾을 수 없음', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/quotes',
    summary: '견적 신청 제출',
    description:
      '견적 위저드에서 수집한 데이터를 저장합니다. 공개 엔드포인트입니다. main 서버가 최종 사용자의 IP/UA/Referer를 body로 전달합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: SubmitQuoteRequestSchema } } },
    },
    responses: {
      201: { description: '견적 신청 저장 완료', content: { 'application/json': { schema: SubmitQuoteResponseSchema } } },
      400: { description: '필수 파라미터 누락', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
      401: { description: '인증 실패', content: { 'application/json': { schema: z.object({ error: z.string() }) } } },
    },
  });
}
