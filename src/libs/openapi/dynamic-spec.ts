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

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'GospelFix CMS API',
      version: '1.0.0',
      description: 'GospelFix 관리자 CMS의 REST API 문서입니다.',
    },
    servers: [{ url: baseUrl, description: 'API Server' }],
  });
}
