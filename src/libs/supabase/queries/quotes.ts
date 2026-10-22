import { createAdminClient } from '@/libs/supabase/admin';

export interface QuoteSelectedItem {
  id: string;
  quantity: number;
  withCopywriting: boolean;
}

export interface SubmitQuoteInput {
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
  isAuthenticated: boolean;
}

/**
 * 견적 신청을 gospelfix_quote_submissions 테이블에 저장한다.
 * (원본: main/src/app/actions/submitQuoteAction.ts)
 *
 * main 서버는 최종 사용자의 IP/UA/Referer를 자신의 headers()로 캡처해 body로 넘겨주므로,
 * 이 함수는 그 값을 그대로 컬럼에 기록하기만 한다(이 서버 자체의 request.headers가 아님).
 */
export async function submitQuote(input: SubmitQuoteInput): Promise<string> {
  const supabase = createAdminClient();
  const id = crypto.randomUUID();

  const { error } = await supabase.from('gospelfix_quote_submissions').insert({
    id,
    selected_categories: input.selectedCategories,
    selected_items: input.selectedItems,
    schedule: input.schedule,
    style_preferences: input.stylePreferences,
    target_age: input.targetAge,
    contact_name: input.contactName,
    contact_value: input.contactValue,
    contact_email: input.contactEmail,
    business_number: input.businessNumber,
    project_summary: input.projectSummary,
    reference_urls: input.referenceUrls,
    estimated_total: input.estimatedTotal,
    shop_industry: input.shopIndustry,
    shop_status: input.shopStatus,
    production_scope: input.productionScope,
    required_features: input.requiredFeatures,
    needs_system_dev: input.needsSystemDev,
    ip_address: input.ipAddress,
    user_agent: input.userAgent,
    referer: input.referer,
    is_authenticated: input.isAuthenticated,
    utm_params: input.utmParams,
  });

  if (error) throw new Error(error.message);
  return id;
}
