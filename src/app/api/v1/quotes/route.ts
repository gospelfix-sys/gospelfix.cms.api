import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/libs/openapi/auth';
import { getBearerUser } from '@/libs/supabase/queries/auth';
import { getApiConfigBySlug, queryConfigList } from '@/libs/supabase/queries/content-api-configs';
import { submitQuote, type QuoteSelectedItem } from '@/libs/supabase/queries/quotes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SubmitQuoteBody {
  selectedCategories: string[] | null;
  selectedItems: QuoteSelectedItem[] | null;
  schedule: string | null;
  stylePreferences: string[] | null;
  targetAge: string | null;
  contactName: string;
  contactValue: string;
  contactEmail: string | null;
  businessNumber: string | null;
  projectSummary: string | null;
  referenceUrls: string[];
  estimatedTotal: number | null;
  shopIndustry: string | null;
  shopStatus: string | null;
  productionScope: string | null;
  requiredFeatures: string[] | null;
  needsSystemDev: boolean | null;
  utmParams: Record<string, string> | null;
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
}

/**
 * GET /api/v1/quotes
 * 정적 `quotes/` 디렉토리가 생기면서 제네릭 `/api/v1/[resource]/route.ts`가
 * 더 이상 이 경로를 처리하지 못하므로, 기존 목록 조회 동작을 동일하게 재현한다.
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const config = await getApiConfigBySlug('quotes');
  if (!config || !config.is_enabled) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

  try {
    const { data, total } = await queryConfigList(config, page, limit);
    return NextResponse.json({ data, total, page, limit });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/quotes
 * 견적 위저드에서 수집한 데이터를 저장한다. 공개 엔드포인트(Bearer 불필요) —
 * 로그인 여부는 `is_authenticated` 필드 기록용으로만 선택적으로 확인한다.
 * (원본: main/src/app/actions/submitQuoteAction.ts)
 *
 * main 서버가 최종 사용자의 IP/UA/Referer를 자신의 headers()로 캡처해 body에 실어 보낸다
 * (이 서버는 main의 서버 사이드 호출을 받으므로 이 요청의 헤더는 최종 사용자 정보가 아니다).
 */
export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body: SubmitQuoteBody = await request.json();

    if (!body.contactName || !body.contactValue) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const user = await getBearerUser(request);

    const id = await submitQuote({
      selectedCategories: body.selectedCategories,
      selectedItems: body.selectedItems,
      schedule: body.schedule,
      stylePreferences: body.stylePreferences,
      targetAge: body.targetAge,
      contactName: body.contactName,
      contactValue: body.contactValue,
      contactEmail: body.contactEmail,
      businessNumber: body.businessNumber,
      projectSummary: body.projectSummary,
      referenceUrls: body.referenceUrls,
      estimatedTotal: body.estimatedTotal,
      shopIndustry: body.shopIndustry,
      shopStatus: body.shopStatus,
      productionScope: body.productionScope,
      requiredFeatures: body.requiredFeatures,
      needsSystemDev: body.needsSystemDev,
      utmParams: body.utmParams,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      referer: body.referer,
      isAuthenticated: user !== null,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/v1/quotes] unexpected error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
