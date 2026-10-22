// 관리자 "견적 신청" 목록 1건 — quote_submissions 요약 컬럼
export interface AdminQuoteListItem {
  id: string;
  contact_name: string;
  contact_value: string;
  contact_email: string;
  estimated_total: number | null;
  user_agent: string | null;
  referer: string | null;
  utm_params: Record<string, string> | null;
  created_at: string;
}

export interface QuoteSelectedItem {
  id: string;
  quantity: number;
  withCopywriting: boolean;
}

// 관리자 "견적 신청" 상세 — quote_submissions 전체 컬럼
export interface AdminQuoteDetail extends AdminQuoteListItem {
  selected_categories: string[] | null;
  selected_items: QuoteSelectedItem[] | null;
  schedule: string | null;
  style_preferences: string[] | null;
  target_age: string | null;
  business_number: string | null;
  project_summary: string | null;
  reference_urls: string[] | null;
  ip_address: string | null;
  is_authenticated: boolean | null;
  shop_industry: string | null;
  shop_status: string | null;
  production_scope: string | null;
  required_features: string[] | null;
  needs_system_dev: boolean | null;
}
