import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

const ErrorSchema = z.object({ error: z.string() });
// 409(slug 충돌) 응답 전용 — field는 프론트가 어떤 입력 필드 옆에 에러를 표시할지 판단하는 데 쓰인다.
const ConflictErrorSchema = z.object({
  error: z.string(),
  field: z.string().optional(),
});

const PurchaseOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  price: z.number().nullable(),
  description: z.string().nullable(),
  workPeriodDays: z.string().nullable(),
  isInquiryOnly: z.boolean(),
  detail: z.string().nullable(),
});

const CodePreviewItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  code: z.string(),
});

const LicenseSchema = z
  .enum(['cc-by', 'cc-by-nc', 'cc-by-nc-nd', 'all-rights-reserved'])
  .openapi({
    example: 'all-rights-reserved',
    description:
      '저작권 및 라이선스. cc-by(저작권표시) / cc-by-nc(저작권표시-비영리) / ' +
      'cc-by-nc-nd(저작권표시-비영리-변경금지) / all-rights-reserved(판권소유, 기본값)',
  });

export const MyProductSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    slug: z.string().openapi({ example: 'my-first-template' }),
    name: z.string().openapi({ example: '나의 첫 템플릿' }),
    description: z.string().nullable(),
    contentHtml: z.string().nullable(),
    discountStartsAt: z.string().datetime().nullable(),
    discountEndsAt: z.string().datetime().nullable(),
    category: z.string().openapi({ example: 'website' }),
    subCategories: z
      .array(z.string())
      .openapi({ example: ['fashion_shopping', 'lifestyle'] }),
    images: z.array(z.string()).nullable(),
    thumbnailUrl: z.string().nullable(),
    demoUrl: z.string().nullable(),
    price: z.number().int().openapi({ example: 98000 }),
    supplyPrice: z.number().int().nullable(),
    purchaseOptions: z.array(PurchaseOptionSchema).nullable(),
    productionSolution: z.string().nullable(),
    productCode: z.string().nullable(),
    designType: z.string().nullable(),
    hasAiStarterKit: z.boolean(),
    filePath: z.string().nullable(),
    codePreview: z.array(CodePreviewItemSchema).nullable(),
    license: LicenseSchema,
    status: z.enum(['draft', 'pending', 'approved', 'rejected']),
    sellerId: z.string().uuid().nullable(),
    isActive: z.boolean(),
    likeCount: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('MyProduct');

const MyProductListResponseSchema = z
  .object({ data: z.array(MyProductSchema) })
  .openapi('MyProductListResponse');
const MyProductResponseSchema = z
  .object({ data: MyProductSchema })
  .openapi('MyProductResponse');

const MyProductInputSchema = z
  .object({
    status: z.enum(['draft', 'pending']),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    contentHtml: z.string(),
    discountStartsAt: z.string().datetime().nullable(),
    discountEndsAt: z.string().datetime().nullable(),
    category: z.string(),
    subCategories: z.array(z.string()).max(3),
    images: z.array(z.string()),
    demoUrl: z.string(),
    price: z.number().int(),
    supplyPrice: z.number().int().nullable(),
    purchaseOptions: z.array(PurchaseOptionSchema),
    productionSolution: z.string(),
    productCode: z.string(),
    designType: z.string(),
    hasAiStarterKit: z.boolean(),
    filePath: z.string().nullable(),
    codePreview: z.array(CodePreviewItemSchema),
    license: LicenseSchema,
  })
  .openapi('MyProductInput');

const UploadImageResponseSchema = z
  .object({ url: z.string().nullable() })
  .openapi('MyProductUploadImageResponse');
const UploadFileResponseSchema = z
  .object({ path: z.string() })
  .openapi('MyProductUploadFileResponse');
const DeleteResponseSchema = z
  .object({ success: z.boolean() })
  .openapi('MyProductDeleteResponse');

export function registerMyProductsPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'get',
    path: '/api/v1/my-products/me',
    summary: '내 상품 목록 조회',
    description: '로그인한 seller/admin 본인이 등록한 상품 목록을 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    responses: {
      200: {
        description: '내 상품 목록',
        content: {
          'application/json': { schema: MyProductListResponseSchema },
        },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/my-products',
    summary: '상품 등록',
    description:
      '로그인한 seller/admin 본인 명의로 상품을 등록합니다. is_active는 항상 false로 시작하며 관리자 승인 후 공개됩니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: MyProductInputSchema } },
      },
    },
    responses: {
      200: {
        description: '등록 성공',
        content: { 'application/json': { schema: MyProductResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      409: {
        description: '이미 사용 중인 slug(작품명 기반 자동 생성)와 충돌',
        content: { 'application/json': { schema: ConflictErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/my-products/{id}',
    summary: '내 상품 단건 조회',
    description: '본인 소유 상품만 조회할 수 있습니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: '상품 정보',
        content: { 'application/json': { schema: MyProductResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      404: {
        description: '상품을 찾을 수 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'patch',
    path: '/api/v1/my-products/{id}',
    summary: '내 상품 수정',
    description:
      '본인 소유 상품만 수정할 수 있습니다. 저장 시 재검수 대상이 되어 is_active가 false로 내려갑니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: MyProductInputSchema } },
      },
    },
    responses: {
      200: {
        description: '수정 성공',
        content: { 'application/json': { schema: MyProductResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      409: {
        description: '이미 사용 중인 slug(작품명 기반 자동 생성)와 충돌',
        content: { 'application/json': { schema: ConflictErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'delete',
    path: '/api/v1/my-products/{id}',
    summary: '내 상품 삭제',
    description: '본인 소유 상품만 삭제할 수 있습니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: '삭제 성공',
        content: { 'application/json': { schema: DeleteResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/my-products/images',
    summary: '상품 이미지 업로드',
    description:
      '썸네일/본문 이미지를 multipart/form-data(file 필드)로 업로드합니다. 서버가 Storage에 직접 저장 후 공개 URL을 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.instanceof(File) }),
          },
        },
      },
    },
    responses: {
      200: {
        description: '업로드 성공',
        content: { 'application/json': { schema: UploadImageResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/my-products/files',
    summary: '상품 다운로드 zip 업로드',
    description:
      'private 버킷에 zip을 업로드하고 Storage 객체 경로(path)를 반환합니다.',
    security: [{ ApiKeyAuth: [], BearerAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.instanceof(File) }),
          },
        },
      },
    },
    responses: {
      200: {
        description: '업로드 성공',
        content: { 'application/json': { schema: UploadFileResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      403: {
        description: '판매자 권한 없음',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  });
}
