// 상품 상세페이지 "코드 미리보기" 섹션 탭 1개. label이 파일명 역할을 겸한다
// (예: "index.html", "data.json"). 개수 제한 없이 관리자가 자유롭게 추가/삭제한다.
export interface ProductCodePreviewItem {
  id: string;
  label: string;
  code: string;
}

// 상품 상세페이지 우측 "구매항목" 옵션 카드 1개
export interface ProductPurchaseOption {
  id: string;
  label: string;
  // 별도 문의 옵션은 가격이 없을 수 있다
  price: number | null;
  description: string | null;
  // 숫자(예: "7") 또는 "협의" 같은 자유 텍스트를 허용한다
  work_period_days: string | null;
  // true면 가격 대신 "별도 문의" + 카카오 채널 문의 버튼으로 전환
  is_inquiry_only: boolean;
  detail: string | null;
}

// 실제 gospelfix 운영 Supabase `products` 테이블과 1:1로 대응하는 타입
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  // 상품 상세페이지 본문에 표시되는 리치 텍스트(HTML). description(SEO 메타)과는 별개
  content_html: string | null;
  // 할인 기간. 설정 시 이 기간 동안은 price가 적용되고, 기간이 끝나면 supply_price가 실제
  // 판매가로 전환된다(즉 price=할인가, supply_price=정가). 둘 다 NULL이면 기간 제한 없이
  // price가 항상 적용됨(기존 동작과 동일)
  discount_starts_at: string | null;
  discount_ends_at: string | null;
  category: string | null;
  // 상품이 대상으로 하는 업종 태그(최대 3개). category(페이지 유형)와 직교하는 필드.
  // 허용값 화이트리스트는 DB가 아니라 products.admin.ts의 sanitizeSubCategories()에서
  // 관리한다. 059_add_moda_products_sub_categories
  sub_categories: string[];
  price: number;
  // 하위 호환용 파생 필드 — 저장 시 항상 images[0]과 동기화된다 (products.admin.ts 참고)
  thumbnail_url: string | null;
  images: string[] | null;
  demo_url: string | null;
  is_active: boolean;
  sort_order: number;
  // 취소선으로 표시되는 공급원가 (미입력 시 상세페이지에서 숨김)
  supply_price: number | null;
  // 상품 상세 우측 구매항목 목록 (비어있으면 기존처럼 단일 price로만 표시)
  purchase_options: ProductPurchaseOption[] | null;
  // 상품 상세 우측 구매 패널에 표시되는 제작솔루션 텍스트 (미입력 시 프론트 기본값으로 폴백)
  production_solution: string | null;
  // 상품 SKU 성격의 참조 코드 (미입력 시 프론트에서 항목 자체를 숨김)
  product_code: string | null;
  // 템플릿 디자인 방식 (반응형/고정형, 미입력 시 프론트에서 항목 자체를 숨김)
  design_type: string | null;
  // 좋아요(하트) 누적 수. product_likes 테이블과 트리거로 동기화되는 읽기 전용 파생 값
  like_count: number;
  // true면 상세페이지에 "AI 확장" 칩이 노출되고, 프론트가 범용 .claude/ 스타터 킷 다운로드
  // 링크를 함께 보여준다. 템플릿별 맞춤 파일이 아니라 모든 상품이 공유하는 정적 자산이다.
  has_ai_starter_kit: boolean;
  // 구매 후 다운로드용 zip 파일의 Storage 객체 경로(private 버킷 product-files 기준).
  // 절대 공개 상품 API에 노출하지 말 것 — 구매 인증을 거친 엔드포인트에서만 조회
  file_path: string | null;
  // 상품 상세페이지 "코드 미리보기" 섹션 탭 배열 (비어있으면 섹션 자체를 숨김)
  code_preview: ProductCodePreviewItem[] | null;
  // 저작권 및 라이선스 구분. DB CHECK 제약으로 4개 값만 허용(002_add_products_license)
  license: 'cc-by' | 'cc-by-nc' | 'cc-by-nc-nd' | 'all-rights-reserved';
  created_at: string;
  updated_at: string;
  // 이 상품을 등록한 판매자(profiles.id). NULL이면 GospelFix 공식 소유(기존 admin
  // 등록분 전부 NULL) — 특정 seller 개인 소유가 아님. 055_add_seller_marketplace_columns
  seller_id: string | null;
  // 판매자 셀프서비스 검수 상태. 공개 카탈로그 노출 여부는 is_active가 그대로 결정하며
  // status는 검수 이력/필터링용 보조 컬럼이다. 055_add_seller_marketplace_columns
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}

// 판매자 셀프서비스 폼(gospelfix `/growth/upload`) 입력값. gospelfix가
// `toCmsProductInput()`으로 camelCase 변환해 보내므로 이 타입은 camelCase다.
export interface MyProductInput {
  status: 'draft' | 'pending';
  slug: string;
  name: string;
  description: string;
  contentHtml: string;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  category: string;
  subCategories: string[];
  images: string[];
  demoUrl: string;
  price: number;
  supplyPrice: number | null;
  purchaseOptions: {
    id: string;
    label: string;
    price: number | null;
    description: string | null;
    workPeriodDays: string | null;
    isInquiryOnly: boolean;
    detail: string | null;
  }[];
  productionSolution: string;
  productCode: string;
  designType: string;
  hasAiStarterKit: boolean;
  filePath: string | null;
  codePreview: ProductCodePreviewItem[];
  license: 'cc-by' | 'cc-by-nc' | 'cc-by-nc-nd' | 'all-rights-reserved';
}
