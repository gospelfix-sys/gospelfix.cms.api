import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { getAllApiConfigs } from '@/libs/supabase/queries/content-api-configs';
import { registerHealthPaths } from '@/libs/openapi/schemas/health.schema';
import { registerAuthPaths } from '@/libs/openapi/schemas/auth.schema';
import { registerBlogPaths } from '@/libs/openapi/schemas/blog.schema';
import { registerProductPaths } from '@/libs/openapi/schemas/product.schema';
import { registerUserPaths } from '@/libs/openapi/schemas/user.schema';
import { registerOrderPaths } from '@/libs/openapi/schemas/order.schema';
import { registerQuotePaths } from '@/libs/openapi/schemas/quote.schema';
import { registerPortfolioPaths } from '@/libs/openapi/schemas/portfolio.schema';
import { registerReviewPaths } from '@/libs/openapi/schemas/review.schema';
import { registerCartPaths } from '@/libs/openapi/schemas/cart.schema';
import { registerCouponPaths } from '@/libs/openapi/schemas/coupon.schema';
import { registerReferralBannerPaths } from '@/libs/openapi/schemas/referral-banner.schema';
import { registerMyProductsPaths } from '@/libs/openapi/schemas/my-products.schema';
import { registerProductCategoryPaths } from '@/libs/openapi/schemas/product-categories.schema';
import { registerProductSubCategoryPaths } from '@/libs/openapi/schemas/product-sub-categories.schema';

const TYPED_SLUGS: Record<string, (reg: OpenAPIRegistry) => void> = {
  blog: registerBlogPaths,
  products: registerProductPaths,
  users: registerUserPaths,
  orders: registerOrderPaths,
  quotes: registerQuotePaths,
  portfolio: registerPortfolioPaths,
  cart: registerCartPaths,
  'referral-banners': registerReferralBannerPaths,
  'my-products': registerMyProductsPaths,
  'product-categories': registerProductCategoryPaths,
  'product-sub-categories': registerProductSubCategoryPaths,
};

// Swagger UI 섹션 구분. registerPath마다 tags를 달지 않고 경로 접두사로 한 곳에서 분류한다.
// 위에서부터 먼저 일치하는 규칙이 적용되므로 더 구체적인 접두사를 앞에 둔다.
const TAG_RULES: { prefix: string; tag: string }[] = [
  { prefix: '/api/v1/health', tag: '상태 확인' },
  { prefix: '/api/v1/auth/email', tag: '인증 - 이메일 인증' },
  { prefix: '/api/v1/auth/phone', tag: '인증 - 휴대폰 인증' },
  { prefix: '/api/v1/auth/me', tag: '내 계정' },
  { prefix: '/api/v1/auth/password', tag: '내 계정' },
  { prefix: '/api/v1/auth/avatar', tag: '내 계정' },
  { prefix: '/api/v1/auth/seller-request', tag: '내 계정' },
  { prefix: '/api/v1/auth', tag: '인증 - 가입/로그인' },
  { prefix: '/api/v1/my-products', tag: '내 상품 (판매자)' },
  { prefix: '/api/v1/product-categories', tag: '상품 카테고리' },
  { prefix: '/api/v1/product-sub-categories', tag: '상품 카테고리' },
  { prefix: '/api/v1/products', tag: '상품' },
  { prefix: '/api/v1/cart', tag: '장바구니' },
  { prefix: '/api/v1/orders', tag: '주문/결제' },
  { prefix: '/api/v1/downloads', tag: '주문/결제' },
  { prefix: '/api/v1/coupons', tag: '쿠폰' },
  { prefix: '/api/v1/reviews', tag: '리뷰' },
  { prefix: '/api/v1/blog', tag: '블로그' },
  { prefix: '/api/v1/portfolio', tag: '포트폴리오' },
  { prefix: '/api/v1/quotes', tag: '견적 문의' },
  { prefix: '/api/v1/users', tag: '사용자' },
  { prefix: '/api/v1/referral-banners', tag: '추천인 배너' },
];

// 섹션 노출 순서. 실제로 쓰인 태그만 문서에 포함된다.
const TAG_ORDER = [
  '상태 확인',
  '인증 - 가입/로그인',
  '인증 - 이메일 인증',
  '인증 - 휴대폰 인증',
  '내 계정',
  '상품',
  '상품 카테고리',
  '내 상품 (판매자)',
  '장바구니',
  '주문/결제',
  '쿠폰',
  '리뷰',
  '블로그',
  '포트폴리오',
  '견적 문의',
  '사용자',
  '추천인 배너',
];

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function applyTags(doc: ReturnType<OpenApiGeneratorV31['generateDocument']>) {
  const used = new Set<string>();
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const rule = TAG_RULES.find((r) => path.startsWith(r.prefix));
    if (!rule) continue;
    for (const method of HTTP_METHODS) {
      const operation = (item as Record<string, { tags?: string[] }>)[method];
      if (operation && !operation.tags) {
        operation.tags = [rule.tag];
        used.add(rule.tag);
      }
    }
  }
  doc.tags = TAG_ORDER.filter((name) => used.has(name)).map((name) => ({
    name,
  }));
  return doc;
}

export async function buildDynamicOpenApiSpec(
  baseUrl = 'http://localhost:3001',
) {
  const reg = new OpenAPIRegistry();

  reg.registerComponent('securitySchemes', 'ApiKeyAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: '.env.local의 INTERNAL_API_KEY 값',
  });
  reg.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'Supabase Auth access_token',
  });

  registerHealthPaths(reg);
  registerAuthPaths(reg);
  // reviews/coupons는 content_api_configs에 등록된 동적 리소스가 아니므로 여기서 무조건 등록한다.
  // (orders/quotes 쓰기 API는 이미 TYPED_SLUGS 대상인 registerOrderPaths/registerQuotePaths 안에서 추가함)
  registerReviewPaths(reg);
  registerCouponPaths(reg);

  const configs = await getAllApiConfigs();
  for (const config of configs) {
    if (!config.is_enabled) continue;
    const registerFn = TYPED_SLUGS[config.resource_slug];
    if (registerFn) {
      registerFn(reg);
    }
  }

  const generator = new OpenApiGeneratorV31(reg.definitions);

  const doc = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'GospelFix CMS API',
      version: '1.0.0',
      description: 'GospelFix 관리자 CMS의 REST API 문서입니다.',
    },
    servers: [{ url: baseUrl, description: 'API Server' }],
  });

  return applyTags(doc);
}
