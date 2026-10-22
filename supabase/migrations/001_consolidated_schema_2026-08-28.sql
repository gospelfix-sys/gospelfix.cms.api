-- ============================================================
-- gospelfix.cms.api — 통합 스키마 골든 스냅샷 (001~063 squash)
-- 작성일: 2026-08-28
--
-- ⚠️ 경고 1 — 이 파일은 재실행용이 아니다.
--    이 파일은 기존 `001_initial_schema.sql` ~ `063_register_product_categories_
--    content_api_configs.sql` 63개 마이그레이션이 운영 Supabase 프로젝트에 누적
--    적용된 "최종 상태"를 하나의 DDL로 재현한 문서화용 스냅샷이다. 운영 DB에는
--    이미 전부 반영되어 있으므로 그대로 다시 실행하면 "already exists" 에러가 난다.
--    (기존 001_initial_schema.sql이 갖고 있던 "replay 전용 스냅샷" 성격을 그대로
--     계승한다.)
--
-- ⚠️ 경고 2 — 실행이 필요한 유일한 경우는 "완전히 비어 있는 신규 Supabase
--    프로젝트에 이 스키마를 처음부터 구축할 때"뿐이다. 그 경우 Supabase 대시보드
--    SQL Editor에 이 파일 전체를 붙여넣어 위에서 아래 순서 그대로 실행하면 된다
--    (아래 "실행 순서" 참고). 사전에 Storage 버킷 4개
--    (products-images / product-files / portfolio-images / blogs-images, 그리고
--     아바타용 avatars)를 대시보드 Storage 메뉴에서 먼저 생성해야
--    섹션 6의 storage.objects 정책이 의미를 갖는다.
--
-- 실행 순서:
--   1. 확장/공통 트리거 함수
--   2. 공용(라인업 무관) 테이블 — profiles / auth_api_configs /
--      content_api_configs / phone_verifications / referral_banners
--   3. 모다(MODA, "/mall") 라인업 테이블 — moda_products / moda_coupons /
--      moda_orders / moda_cart_items / moda_product_likes / moda_reviews /
--      moda_product_categories / moda_product_sub_categories
--   4. gospelfix 본 서비스("/") 라인업 테이블 — gospelfix_news /
--      gospelfix_portfolios / gospelfix_quote_submissions
--   5. 휴대폰 인증 RPC 함수 (phone_verifications 의존)
--   6. Storage RLS 정책
--   7. 시드 데이터 (content_api_configs / auth_api_configs / referral_banners /
--      moda_product_categories / moda_product_sub_categories)
--
-- 📌 통합 시 반영 원칙
--   - 중간에 추가됐다가 이후 마이그레이션에서 되돌려진 것은 **최종 상태만** 반영했다.
--     · 009: news.summary 삭제 → 컬럼 없음
--     · 017/031: products.includes 영구 삭제, file_path는 삭제 후 재추가 → file_path 있음
--     · 036/038: code_preview_html/css/js(flat text 3개) → code_preview(jsonb 1개)
--     · 041/042: referral_banner_config(싱글턴) → referral_banners(리스트형)
--     · 051~054: moda_products.banner_image_url 추가 후 같은 날 취소 → 컬럼 없음
--     · 055/056: moda_products에 검수용 status를 넣으려다 기존 status(active/inactive)와
--       충돌 → review_status로 분리. 레거시 status 컬럼은 그대로 유지
--   - 047/048 라인업 접두사 리네이밍이 이미 끝났으므로 **최종 테이블명**
--     (gospelfix_* / moda_*)만 사용한다. profiles / auth_api_configs /
--     content_api_configs / phone_verifications / referral_banners는 두 라인업이
--     공유하는 인프라 테이블이라 접두사가 없다(앞으로도 리네임 금지).
--   - 2026-08-16 전수 조사로 밝혀진 드리프트(마이그레이션 이력에 없이 대시보드에서
--     수동 반영돼 있던 NOT NULL/기본값/CHECK, moda_orders.withdrawal_notice_agreed,
--     moda_products.price_type/base_price/options/status)는 기존 001에 병합돼 있던
--     내용을 그대로 이어받았다. 아래 해당 컬럼에 인라인 주석으로 표시했다.
--   - 061은 moda_products/orders/reviews/product_likes/cart_items 전체 TRUNCATE
--     (카테고리 체계 전면 개편에 따른 데이터 초기화)였다. 스키마 변경이 아니고 신규
--     DB는 어차피 비어 있으므로 이 파일에는 포함하지 않는다.
--   - 040의 referral_code 백필 DO 블록, 004의 images 백필, 011/038의 데이터 이관
--     UPDATE 등 "기존 행 대상 백필"은 신규 DB에 대상 행이 없으므로 생략했다.
--
-- 📌 알려진 비대칭 (신규 DB에 이 파일을 실행했을 때 운영 DB와 달라지는 부분)
--   운영 DB의 자동 생성 제약 이름(PK/UNIQUE/FK)은 047/048 리네이밍 당시 cosmetic
--   이슈로 판단해 바꾸지 않아서 아직도 옛 이름을 쓴다(예: `products_pkey`,
--   `orders_product_id_fkey`, `news_slug_key`). 이 파일로 새로 만든 DB는
--   `moda_products_pkey` 처럼 새 이름으로 자동 생성된다. 기능에는 영향이 없다.
--   명시적으로 이름을 붙인 CHECK 제약/인덱스/트리거는 운영 DB와 동일한 이름을
--   그대로 유지했다(예: `products_options_is_array_check`).
--   RLS 정책 이름도 운영 DB 그대로 옛 이름을 유지한다(예: "products_public_read").
-- ============================================================


-- ============================================================
-- 1. 공통 트리거 함수
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 신규 가입 시 profiles 자동 생성 (005에서 phone/terms_agreed_at 복사 추가한 최종본)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone, terms_agreed_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    now()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. 공용 테이블 (라인업 접두사 없음 — 두 라인업이 공유, 리네임 금지)
-- ============================================================

-- ------------------------------------------------------------
-- 2-1. profiles
--   001 기본 + 005(phone/terms_agreed_at) + 014(deleted_at)
--   + 040(referral_code/referred_by) + 055(role에 'seller' 허용)
--   + 057(seller_requested_at)
-- ------------------------------------------------------------

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  full_name           text,
  avatar_url          text,
  -- role: 055에서 'seller'가 추가됐다. 제약 이름은 001의 인라인 CHECK가 자동으로
  -- 부여받았던 이름(profiles_role_check)을 그대로 명시해 유지한다.
  role                text not null default 'user'
                        constraint profiles_role_check check (role in ('user', 'admin', 'seller')),
  phone               text unique,
  terms_agreed_at     timestamptz,
  deleted_at          timestamptz,
  referral_code       text,
  referred_by         uuid references public.profiles(id),
  seller_requested_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_referral_code_unique unique (referral_code)
);

comment on column public.profiles.deleted_at is
  '회원탈퇴(소프트 삭제) 시각. NULL이면 활성 회원. 하드 삭제 대신 PII만 마스킹하고
   moda_orders/moda_reviews의 user_id 연결은 유지한다.';
comment on column public.profiles.referral_code is
  '이 사용자가 공유할 수 있는 8자리 추천인 코드. unique. NOT NULL 아님(베스트에포트 발급) —
   handle_new_user() 트리거는 이 값을 채우지 않고, 가입 API가 별도 UPDATE로 채운다.';
comment on column public.profiles.referred_by is
  '이 사용자를 추천한 회원의 profiles.id. 회원가입 시 1회만 설정, 이후 변경 없음';
comment on column public.profiles.seller_requested_at is
  '일반 회원이 마이페이지에서 "판매자 신청" 버튼을 눌러 판매자 전환 의사를 표시한 시각.
   NULL이면 신청하지 않음. 자동 승인 로직 없음 — 관리자가 /users 페이지에서 이 값을 보고
   수동으로 role을 seller로 전환한다.';

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- role은 클라이언트가 직접 변경할 수 없도록 UPDATE 시점의 기존 role과 동일해야 함
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
  );

-- 신규 가입 시 role은 항상 'user'로만 insert 가능
-- (admin/seller는 handle_new_user 트리거나 서버 전용 경로로만 부여)
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id and role = 'user');


-- ------------------------------------------------------------
-- 2-2. auth_api_configs (006) — /api/v1/auth/* On/Off 토글
-- ------------------------------------------------------------

create table public.auth_api_configs (
  id            uuid primary key default gen_random_uuid(),
  endpoint_slug text not null unique,
  label         text not null,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger auth_api_configs_updated_at
  before update on public.auth_api_configs
  for each row execute procedure public.set_updated_at();

alter table public.auth_api_configs enable row level security;

create policy "admin full access"
  on public.auth_api_configs
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ------------------------------------------------------------
-- 2-3. content_api_configs (002) — 동적 REST API 토글 시스템
--   공개 REST API(/api/v1/[resource]/[identifier])는 이 테이블의 table_name과
--   select_columns(콤마 구분 화이트리스트)를 그대로 읽어 쿼리를 조립한다
--   (src/libs/supabase/queries/content-api-configs.ts).
--   ⚠️ 테이블에 컬럼을 추가/삭제해도 여기 select_columns를 갱신하지 않으면
--      API 응답에 반영되지 않는다 — 이 저장소의 대표적 함정.
-- ------------------------------------------------------------

create table public.content_api_configs (
  id                uuid        primary key default gen_random_uuid(),
  resource_slug     text        not null unique,
  label             text        not null,
  table_name        text        not null,
  is_enabled        boolean     not null default false,
  filter_column     text,
  filter_value      text,
  filter_is_bool    boolean     not null default false,
  identifier_column text        not null default 'id',
  identifier_type   text        not null default 'uuid' check (identifier_type in ('uuid', 'text')),
  order_column      text        not null default 'created_at',
  order_direction   text        not null default 'desc' check (order_direction in ('asc', 'desc')),
  select_columns    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger content_api_configs_updated_at
  before update on public.content_api_configs
  for each row execute procedure public.set_updated_at();

alter table public.content_api_configs enable row level security;

create policy "admin full access"
  on public.content_api_configs
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "service role full access"
  on public.content_api_configs
  for all to service_role
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- 2-4. phone_verifications (005 + 007의 attempts 컬럼)
-- ------------------------------------------------------------

create table public.phone_verifications (
  id                  uuid primary key default gen_random_uuid(),
  phone               text not null,
  code                text not null,
  verification_token  text,
  expires_at          timestamptz not null,
  verified_at         timestamptz,
  consumed_at         timestamptz,
  attempts            integer not null default 0,
  created_at          timestamptz not null default now()
);

create index phone_verifications_phone_idx on public.phone_verifications(phone);

alter table public.phone_verifications enable row level security;

-- 클라이언트는 anon/authenticated로 직접 접근하지 않고, 반드시
-- /api/v1/auth/phone/* Route Handler(admin.ts, service_role)를 거친다.
create policy "phone_verifications_service_role_all"
  on public.phone_verifications for all
  to service_role
  using (true);


-- ------------------------------------------------------------
-- 2-5. referral_banners (042 리스트형 재설계 + 043 show_referral_actions
--      + 045/046 banner_type)
--      ※ 041의 referral_banner_config(싱글턴)는 042에서 drop됐다 — 여기 없음.
-- ------------------------------------------------------------

create table public.referral_banners (
  id                    uuid primary key default gen_random_uuid(),
  message               text not null,
  discount_rate         integer not null default 50 check (discount_rate between 1 and 100),
  is_enabled            boolean not null default true,
  show_referral_actions boolean not null default true,
  banner_type           text not null default 'referral'
                          constraint referral_banners_banner_type_check
                          check (banner_type in ('referral', 'review', 'general', 'signup')),
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.referral_banners.discount_rate is
  '추천인 쿠폰 실제 발급 할인율(%, 1~100). sort_order가 가장 앞선 활성(is_enabled=true)
   배너의 값을 referrals.ts의 applyReferral()이 사용한다.';
comment on column public.referral_banners.sort_order is
  '관리자 화면의 드래그 정렬 순서이자, 프론트 배너 롤링 표시 순서 그 자체.';
comment on column public.referral_banners.show_referral_actions is
  'true면 배너 하단에 추천인 코드 배지 + 코드 복사/링크 공유 버튼을 표시한다. 코드 공유와
   무관한 일반 홍보 문구(예: 리뷰 작성 쿠폰 안내) 배너는 false로 설정한다.';
comment on column public.referral_banners.banner_type is
  '배너 목적: referral(추천인 코드 공유), review(리뷰 작성 보상), signup(회원가입 혜택),
   general(단순 홍보, 쿠폰 발급과 무관). 각 유형별로 노출 순서(sort_order)가 가장 앞선 활성
   배너의 discount_rate가 해당 유형의 실제 쿠폰 발급 할인율로 사용된다.';

create trigger referral_banners_updated_at
  before update on public.referral_banners
  for each row execute procedure public.set_updated_at();

alter table public.referral_banners enable row level security;

create policy "admin full access"
  on public.referral_banners
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ============================================================
-- 3. 모다(MODA, "/mall") 라인업 테이블 — moda_ 접두사
-- ============================================================

-- ------------------------------------------------------------
-- 3-1. moda_products (구 products)
--   001 기본 + 004(images) + 015(supply_price/options 정합화)
--   + 017(includes 삭제) + 019(production_solution) + 021(product_code/design_type)
--   + 023(like_count) + 027(content_html) + 029(할인 기간) + 031(file_path 재추가)
--   + 034(has_ai_starter_kit) + 038(code_preview jsonb) + 055(seller_id)
--   + 056(review_status) + 059(sub_categories)
-- ------------------------------------------------------------

create table public.moda_products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name               text not null,
  description        text,
  -- category/price: 2026-08-16 드리프트 보정분(001에 병합돼 있던 내용). 실제 운영 DB는
  -- 각각 NOT NULL, NOT NULL DEFAULT 0이다. 값 화이트리스트는 DB CHECK가 아니라
  -- moda_product_categories 테이블 + 앱 레벨(products.admin.ts)에서 관리한다.
  category           text not null,
  price              integer not null default 0,
  thumbnail_url      text,
  demo_url           text,
  images             text[],
  is_active          boolean not null default true,
  sort_order         integer not null default 0,
  -- ↓ price_type/base_price/options/status 4개는 마이그레이션 이력 없이 대시보드에서
  --   수동 추가돼 있던 드리프트 컬럼을 2026-08-16에 사후 문서화한 것이다.
  --   price_type/base_price/status는 "용도 불명확, 변경 금지"(2026-07-30 사용자 지시).
  --   status(active/inactive)는 판매자 검수 상태(review_status)와 전혀 무관한 별개 컬럼이다
  --   — 055가 이 이름으로 검수 상태를 넣으려다 충돌해 056에서 review_status로 분리했다.
  price_type         text not null default 'free'
                       constraint products_price_type_check check (price_type in ('free', 'paid')),
  base_price         numeric not null default 0,
  options            jsonb not null default '[]'::jsonb
                       constraint products_options_is_array_check check (jsonb_typeof(options) = 'array'),
  status             text not null default 'active'
                       constraint products_status_check check (status in ('active', 'inactive')),
  -- ↓ 015 이후 정식 마이그레이션으로 추가된 컬럼들
  supply_price       numeric
                       constraint products_supply_price_check
                       check (supply_price is null or supply_price >= 0),
  production_solution text,
  product_code       text,
  design_type        text,
  like_count         integer not null default 0,
  content_html       text,
  discount_starts_at timestamptz,
  discount_ends_at   timestamptz,
  file_path          text,
  has_ai_starter_kit boolean not null default false,
  code_preview       jsonb not null default '[]'::jsonb,
  seller_id          uuid references public.profiles(id) on delete set null,
  review_status      text not null default 'approved'
                       check (review_status in ('draft', 'pending', 'approved', 'rejected')),
  sub_categories     jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint products_discount_period_check check (
    discount_starts_at is null
    or discount_ends_at is null
    or discount_ends_at > discount_starts_at
  ),
  constraint products_code_preview_is_array check (jsonb_typeof(code_preview) = 'array'),
  constraint moda_products_sub_categories_is_array check (jsonb_typeof(sub_categories) = 'array'),
  constraint moda_products_sub_categories_max_three check (jsonb_array_length(sub_categories) <= 3)
);

comment on column public.moda_products.options is
  '구매항목 옵션 배열(purchase options). 각 원소 예시: '
  '{"id":"copy","label":"단순복사","price":29000,"description":"...","work_period_days":1,"is_inquiry_only":false}. '
  'price_type/base_price/status와는 무관하며 이 컬럼만 구매항목 UI 용도로 사용한다. '
  '공개 API(/api/v1/products)에는 content_api_configs.select_columns의 '
  '`purchase_options:options` 별칭으로 노출된다.';
comment on column public.moda_products.supply_price is
  '공급원가. 상세페이지에 취소선으로 표시되는 참고 가격. 할인 기간(discount_ends_at)이
   지나면 프론트가 이 값을 판매가(정가)로 자동 전환한다. NULL이면 프론트에서
   임시 계산값(price * 2)을 사용한다.';
comment on column public.moda_products.production_solution is
  '상품 상세페이지 우측 구매 패널에 표시되는 제작솔루션 텍스트. NULL이면 프론트에서 기본값으로 폴백';
comment on column public.moda_products.product_code is
  '상품 SKU 성격의 참조 코드 (예: PTMD856024). NULL이면 프론트에서 해당 항목을 표시하지 않음';
comment on column public.moda_products.design_type is
  '템플릿 디자인 방식 (반응형/고정형). NULL이면 프론트에서 해당 항목을 표시하지 않음';
comment on column public.moda_products.like_count is
  '상품에 대한 좋아요(하트) 총 개수. public.sync_product_like_count() 트리거가
   moda_product_likes 테이블 INSERT/DELETE 시 원자적으로 증감시키는 비정규화 캐시
   컬럼 — 직접 UPDATE하지 말 것';
comment on column public.moda_products.content_html is
  '상품 상세페이지 본문에 표시되는 리치 텍스트(HTML). 관리자 RichEditor(TipTap) 출력값이
   그대로 저장되며, 프론트엔드는 반드시 sanitize-html로 새니타이징 후 렌더링해야 함.
   NULL이면 프론트에서 해당 섹션을 렌더링하지 않음';
comment on column public.moda_products.discount_starts_at is
  '할인 시작 시각. NULL이면 저장 즉시(제약 없이) 할인이 시작된 것으로 취급. 이 기간 동안은
   price가 판매가로 적용됨';
comment on column public.moda_products.discount_ends_at is
  '할인 종료 시각. 이 시각이 지나면 프론트에서 supply_price를 판매가(정가)로 자동 전환.
   NULL이거나 둘 다 NULL이면 price가 항상 적용됨';
comment on column public.moda_products.file_path is
  '구매 후 다운로드용 zip 파일의 Storage 객체 경로(private 버킷 product-files 기준,
   예: files/1234567890.zip). NULL이면 아직 파일이 준비되지 않은 상품. 절대 공개 상품 API
   (PUBLIC_FIELDS, content_api_configs.select_columns)에 노출하지 말 것 — 구매 인증을 거친
   엔드포인트에서만 signed URL 발급용으로 조회한다';
comment on column public.moda_products.has_ai_starter_kit is
  'true면 메인 앱 상품 상세페이지에 "AI 확장" 칩과 .claude 스타터 킷 다운로드 링크가
   노출된다. 템플릿별 맞춤 파일이 아니라 모든 상품이 공유하는 정적 자산.';
comment on column public.moda_products.code_preview is
  '상품 상세페이지 "코드 미리보기" 섹션에 노출되는 탭 배열. 각 원소는 {id, label, code}
   형태(label이 파일명 역할, 예: "index.html")이며 관리자가 개수 제한 없이 자유롭게
   추가/삭제할 수 있다.';
comment on column public.moda_products.seller_id is
  '이 상품을 등록한 판매자(profiles.id). NULL이면 GospelFix 공식 소유(기존 admin 등록분
   전부 NULL) — 특정 seller 개인 소유가 아님.';
comment on column public.moda_products.review_status is
  '판매자 셀프서비스 검수 상태(055가 의도했던 것을 review_status로 재구현 — 기존 status
   컬럼은 001부터 있던 무관한 active/inactive 컬럼이라 충돌 방지 위해 이름을 분리함).
   draft=작성 중, pending=검수 대기, approved=승인(공개 가능), rejected=반려. 공개 카탈로그
   노출 여부는 기존 is_active 필터가 그대로 결정하며, review_status는 검수 이력/필터링용
   보조 컬럼이다. 앱/REST 계약에서는 `status:review_status` 별칭으로 노출한다.';
comment on column public.moda_products.sub_categories is
  '상품이 대상으로 하는 업종 태그 배열(최대 3개). 기존 category(대분류)와 직교하는 필드 —
   예: ["beauty_women", "cafe_food"]. 허용값 화이트리스트는 DB 제약이 아니라
   moda_product_sub_categories 테이블 + 앱 레벨(products.admin.ts의
   sanitizeSubCategories())에서 관리한다.';

create index moda_products_sort_order_idx on public.moda_products(sort_order);
create index idx_moda_products_seller_id on public.moda_products(seller_id);

create trigger moda_products_updated_at
  before update on public.moda_products
  for each row execute procedure public.set_updated_at();

alter table public.moda_products enable row level security;

-- 정책 이름은 047/048 리네이밍 시 cosmetic 이슈로 판단해 바꾸지 않았다 — 운영 DB와 동일하게 유지.
create policy "products_public_read"
  on public.moda_products for select
  using (is_active = true);

create policy "products_admin_all"
  on public.moda_products for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "products_service_role_all"
  on public.moda_products for all
  to service_role
  using (true);


-- ------------------------------------------------------------
-- 3-2. moda_coupons (구 coupons — 032 + 044의 source)
--      moda_orders.coupon_id가 참조하므로 orders보다 먼저 생성한다.
-- ------------------------------------------------------------

create table public.moda_coupons (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  code           text not null unique,
  discount_rate  integer not null default 20,
  is_used        boolean not null default false,
  source         text check (source in ('signup', 'referral', 'review')),
  expired_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

comment on column public.moda_coupons.code is
  'GF-XXXX-XXXX 형식의 랜덤 발급 코드';
comment on column public.moda_coupons.discount_rate is
  '할인율(%). 회원가입 발급 쿠폰은 기본 20 — 실제 값은 referral_banners의 유형별
   1순위 활성 배너 discount_rate를 따른다.';
comment on column public.moda_coupons.source is
  '쿠폰 발급 사유: signup(회원가입 즉시 발급), referral(추천인 코드 등록 보상),
   review(리뷰 작성 보상). 컬럼 추가(044) 이전에 발급된 쿠폰은 NULL(출처 미상).';
comment on column public.moda_coupons.expired_at is
  '만료 시각. 회원가입 발급 쿠폰은 발급 시각 + 30일';

alter table public.moda_coupons enable row level security;

-- 쓰기는 항상 admin.ts(service_role)를 통해서만 수행하므로 authenticated에는 select만 부여
create policy "users can read own coupons"
  on public.moda_coupons for select
  to authenticated
  using (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 3-3. moda_orders (구 orders — 001 + 032의 쿠폰 연동 + 033의 부분 유니크 인덱스)
--      ※ updated_at 컬럼은 있으나 updated_at 트리거는 001에서 만들어진 적이 없다
--        (원본 스키마의 갭 — 지금까지 그대로 유지 중).
-- ------------------------------------------------------------

create table public.moda_orders (
  id          uuid primary key default gen_random_uuid(),
  -- user_id/product_id: 2026-08-16 드리프트 보정분. 001 최초 문서화 시 FK만 걸고 nullable로
  -- 기록됐으나 실제 운영 DB는 둘 다 NOT NULL이다.
  user_id     uuid not null references public.profiles(id),
  product_id  uuid not null references public.moda_products(id),
  order_id    text not null unique,
  amount      integer not null,
  status      text not null default 'pending'
                check (status in ('pending', 'pending_confirm', 'paid', 'cancelled')),
  payment_key text,
  paid_at     timestamptz,
  -- withdrawal_notice_agreed: 2026-08-16 드리프트 보정분. 전자상거래법상 청약철회 제한
  -- 안내 고지 동의 여부. createPendingOrder가 주문 생성 시 항상 명시적으로 채워 넣는데,
  -- 어떤 마이그레이션도 생성 이력을 남긴 적이 없었다.
  withdrawal_notice_agreed boolean not null default false,
  coupon_id       uuid references public.moda_coupons(id),
  discount_amount integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.moda_orders.coupon_id is
  '이 주문에 적용된 쿠폰(있는 경우). 결제 완료(paid) 전환 시점에 moda_coupons.is_used를
   true로 갱신한다';
comment on column public.moda_orders.discount_amount is
  '쿠폰 적용으로 차감된 금액(원). 쿠폰 미적용 주문은 0';

-- 쿠폰 1회성 사용을 DB 레벨에서 강제 (033). 취소된 주문은 인덱스 대상에서 제외되므로
-- "취소 후 같은 쿠폰으로 재주문"은 정상 허용된다.
create unique index moda_orders_coupon_id_active_unique_idx
  on public.moda_orders (coupon_id)
  where coupon_id is not null
    and status in ('pending', 'pending_confirm', 'paid');

comment on index public.moda_orders_coupon_id_active_unique_idx is
  '쿠폰 1회성 사용 보장: 취소(cancelled)되지 않은 활성 주문 중 같은 coupon_id는 하나만 허용';

alter table public.moda_orders enable row level security;

create policy "users can read own orders"
  on public.moda_orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own orders"
  on public.moda_orders for insert
  to authenticated
  with check (auth.uid() = user_id);

-- pending 상태일 때만 pending_confirm으로 변경 허용 (결제 알림 단계)
create policy "users can update own orders"
  on public.moda_orders for update
  to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status in ('pending', 'pending_confirm'));


-- ------------------------------------------------------------
-- 3-4. moda_cart_items (구 cart_items — 025)
-- ------------------------------------------------------------

create table public.moda_cart_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  product_id   uuid not null references public.moda_products(id) on delete cascade,
  option_id    text not null,
  option_label text not null,
  price        integer not null check (price >= 0),
  created_at   timestamptz not null default now(),
  unique (user_id, product_id, option_id)
);

create index moda_cart_items_user_id_idx on public.moda_cart_items(user_id);

comment on table public.moda_cart_items is
  '사용자가 장바구니에 담은 상품+옵션. (user_id, product_id, option_id) 조합 unique —
   같은 옵션을 다시 담으면 신규 행 대신 기존 행을 그대로 둔다(idempotent).';
comment on column public.moda_cart_items.option_id is
  '담을 당시 선택된 구매 옵션 id. moda_products.purchase_options(JSONB) 원소를
   가리키는 문자열이며 FK 아님(프론트 하드코딩 기본 옵션도 존재하므로 강제 불가).';
comment on column public.moda_cart_items.price is
  '담을 당시 옵션 가격 스냅샷. 이후 상품 가격이 바뀌어도 장바구니 표시 금액은 유지된다.';

alter table public.moda_cart_items enable row level security;

create policy "cart_items_own_read"
  on public.moda_cart_items for select
  to authenticated
  using (auth.uid() = user_id);

create policy "cart_items_service_role_all"
  on public.moda_cart_items for all
  to service_role
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- 3-5. moda_product_likes (구 product_likes — 023)
--      + like_count 동기화 트리거 함수(049에서 moda_products 기준으로 재정의된 최종본)
-- ------------------------------------------------------------

create table public.moda_product_likes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.moda_products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create index moda_product_likes_product_id_idx on public.moda_product_likes(product_id);

comment on table public.moda_product_likes is
  '상품 좋아요(하트) 토글 기록. 사용자당 상품 1개에 1회만 좋아요 가능 (product_id, user_id 조합 unique)';
comment on column public.moda_product_likes.product_id is
  '좋아요 대상 상품. 상품 삭제 시 좋아요 기록도 함께 삭제(cascade)';
comment on column public.moda_product_likes.user_id is
  '좋아요를 누른 사용자. 회원 탈퇴(profiles 삭제) 시 좋아요 기록도 함께 삭제(cascade)';

create or replace function public.sync_product_like_count()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update public.moda_products
    set like_count = like_count + 1
    where id = new.product_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.moda_products
    set like_count = like_count - 1
    where id = old.product_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.sync_product_like_count() is
  'moda_product_likes에 좋아요 INSERT/DELETE 시 moda_products.like_count를 원자적으로
   +1/-1 증감시킨다 (race condition 방지를 위해 select 후 update가 아닌
   like_count = like_count ± 1 형태의 단일 UPDATE 사용)';

create trigger moda_product_likes_sync_count
  after insert or delete on public.moda_product_likes
  for each row execute procedure public.sync_product_like_count();

alter table public.moda_product_likes enable row level security;

create policy "product_likes_public_read"
  on public.moda_product_likes for select
  using (true);

-- 좋아요 토글(추가/삭제)은 서버(cms.api)가 로그인 여부를 검증한 뒤 service_role로
-- 처리하므로 authenticated 역할에는 별도 insert/delete 정책을 부여하지 않는다.
create policy "product_likes_service_role_all"
  on public.moda_product_likes for all
  to service_role
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- 3-6. moda_reviews (구 reviews — 002)
-- ------------------------------------------------------------

create table public.moda_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.moda_products(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create index moda_reviews_product_id_idx on public.moda_reviews(product_id);

create trigger moda_reviews_updated_at
  before update on public.moda_reviews
  for each row execute procedure public.set_updated_at();

alter table public.moda_reviews enable row level security;

create policy "reviews_public_read"
  on public.moda_reviews for select
  using (true);

-- 작성/수정은 서버(cms.api)가 구매 여부를 검증한 뒤 service_role로 처리하므로
-- authenticated 역할에는 별도 insert/update 정책을 부여하지 않는다.
create policy "reviews_service_role_all"
  on public.moda_reviews for all
  to service_role
  using (true)
  with check (true);


-- ------------------------------------------------------------
-- 3-7. moda_product_categories / moda_product_sub_categories (062)
--   대분류/소분류는 프로젝트 방침상 직교(orthogonal) 관계 — FK 없이 독립된 두 테이블.
--   moda_products.category(text) / sub_categories(jsonb)는 여기 value 문자열을 그대로
--   저장하며 FK로 묶여 있지 않다(값 검증은 앱 레벨).
-- ------------------------------------------------------------

create table public.moda_product_categories (
  id          uuid        primary key default gen_random_uuid(),
  value       text        not null unique,
  label       text        not null,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.moda_product_categories is
  '상품 대분류(예: website/ux_ui/branding). moda_products.category는 이 테이블의 value를
   그대로 저장하는 자유 문자열이며 FK로 묶여 있지 않다 — 값 검증은 앱 레벨
   (products.admin.ts의 sanitizeCategory())에서 is_active=true 행만 허용한다.';

create trigger moda_product_categories_updated_at
  before update on public.moda_product_categories
  for each row execute procedure public.set_updated_at();

alter table public.moda_product_categories enable row level security;

create policy "admin full access"
  on public.moda_product_categories
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "service role full access"
  on public.moda_product_categories
  for all to service_role
  using (true)
  with check (true);


create table public.moda_product_sub_categories (
  id          uuid        primary key default gen_random_uuid(),
  value       text        not null unique,
  label       text        not null,
  sort_order  integer     not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.moda_product_sub_categories is
  '상품 소분류(업종 태그, 최대 3개 다중선택). moda_products.sub_categories(jsonb 배열)는
   이 테이블의 value들을 담으며 FK로 묶여 있지 않다 — 값 검증은 앱 레벨
   (products.admin.ts의 sanitizeSubCategories())에서 is_active=true 행만 허용한다.
   대분류(moda_product_categories)와 직교 관계 — 계층/FK 없음.';

create trigger moda_product_sub_categories_updated_at
  before update on public.moda_product_sub_categories
  for each row execute procedure public.set_updated_at();

alter table public.moda_product_sub_categories enable row level security;

create policy "admin full access"
  on public.moda_product_sub_categories
  for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "service role full access"
  on public.moda_product_sub_categories
  for all to service_role
  using (true)
  with check (true);


-- ============================================================
-- 4. gospelfix 본 서비스("/") 라인업 테이블 — gospelfix_ 접두사
-- ============================================================

-- ------------------------------------------------------------
-- 4-1. gospelfix_news (구 news)
--   001 기본 + 009(summary 삭제) + 011(category 허용값 교체)
--   + 012(portfolio_images) + 026(content NOT NULL 해제)
-- ------------------------------------------------------------

create table public.gospelfix_news (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  -- content: 실제 운영 DB 기본값은 ''(빈 문자열)이며 nullable(026에서 NOT NULL 해제).
  -- 관리자가 본문 없이 초안을 저장하는 워크플로우 때문에 nullable이어야 한다.
  content          text default ''::text,
  -- category: 실제 운영 DB는 NOT NULL + DEFAULT '업데이트'인데, 011이 CHECK 허용값에서
  -- '업데이트'를 제외해서 이 기본값은 자기모순 상태다(앱이 항상 category를 명시해서
  -- insert하므로 지금까지 드러나지 않음). 운영 DB 상태를 있는 그대로 재현한다.
  category         text not null default '업데이트'
                     constraint news_category_check
                     check (category in ('신규 템플릿', '이벤트', 'AI 활용', 'UX/UI 디자인')),
  thumbnail_url    text,
  portfolio_images text[] not null default '{}',
  is_published     boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.gospelfix_news.portfolio_images is
  '블로그 글 본문 하단 "포폴 사진" 갤러리. 대표 썸네일(thumbnail_url)과는 별개 필드.';

create index gospelfix_news_sort_order_idx on public.gospelfix_news(sort_order);

create trigger gospelfix_news_updated_at
  before update on public.gospelfix_news
  for each row execute procedure public.set_updated_at();

alter table public.gospelfix_news enable row level security;

create policy "published news readable by all"
  on public.gospelfix_news for select
  using (is_published = true);

create policy "admin can manage news"
  on public.gospelfix_news for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ------------------------------------------------------------
-- 4-2. gospelfix_portfolios (구 portfolios)
-- ------------------------------------------------------------

create table public.gospelfix_portfolios (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  -- category/description/site_url/tags: 2026-08-16 드리프트 보정분. 001 최초 문서화 시
  -- nullable(또는 기본값만 있고 NOT NULL 없음)로 기록됐으나 실제 운영 DB는 전부 NOT NULL
  -- (+문자열류는 DEFAULT '')이다.
  category      text not null default '',
  description   text not null default '',
  tags          text[] not null default '{}',
  thumbnail_url text,
  site_url      text not null default '',
  images        text[] default '{}',
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger gospelfix_portfolios_updated_at
  before update on public.gospelfix_portfolios
  for each row execute procedure public.set_updated_at();

alter table public.gospelfix_portfolios enable row level security;

create policy "공개 포트폴리오 조회 허용"
  on public.gospelfix_portfolios for select
  using (is_published = true);

create policy "admin can manage portfolios"
  on public.gospelfix_portfolios for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));


-- ------------------------------------------------------------
-- 4-3. gospelfix_quote_submissions (구 quote_submissions)
--   insert-only 로그성 테이블 — updated_at 컬럼/트리거, 명시적 인덱스 없음.
-- ------------------------------------------------------------

create table public.gospelfix_quote_submissions (
  id                  uuid primary key default gen_random_uuid(),
  -- 아래 NOT NULL 표시된 컬럼들은 2026-08-16 드리프트 보정분: 001 최초 문서화 당시
  -- nullable/기본값 없음으로 기록됐으나 실제 운영 DB는 NOT NULL(+일부는 DEFAULT '{}')이다.
  -- 반대로 contact_email은 001이 NOT NULL로 더 엄격하게 기록했으나 실제로는 nullable이다
  -- (역방향 드리프트).
  selected_categories text[] not null,
  selected_items      jsonb not null,
  schedule            text,
  style_preferences   text[] not null default '{}',
  target_age          text,
  contact_name        text not null,
  contact_value       text not null,
  contact_email       text,
  business_number     text,
  project_summary     text,
  reference_urls      text[] not null default '{}',
  estimated_total     integer not null,
  ip_address          text,
  user_agent          text,
  referer             text,
  is_authenticated    boolean default false,
  utm_params          jsonb default '{}'::jsonb,
  shop_industry       text,
  shop_status         text,
  production_scope    text,
  required_features   text[] not null default '{}',
  needs_system_dev    boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.gospelfix_quote_submissions enable row level security;

create policy "Anyone can insert quote_submissions"
  on public.gospelfix_quote_submissions for insert
  with check (true);

-- profiles.role 기반 admin 판별 (JWT role 클레임 사용 불가 — Supabase는 항상 'authenticated' 반환)
create policy "Admin can read quote_submissions"
  on public.gospelfix_quote_submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ============================================================
-- 5. 휴대폰 인증 RPC 함수 (007) — phone_verifications 의존
--   애플리케이션(JS) 레벨의 "SELECT 후 INSERT" rate limit은 TOCTOU 레이스로
--   우회 가능하므로, pg_advisory_xact_lock으로 전화번호별 임계구역을 직렬화한다.
-- ============================================================

-- 재전송 쿨다운 / 시간당 발송 한도를 원자적으로 검사한 뒤 insert.
-- 반환값: 'ok' | 'cooldown' | 'limit_exceeded'
create or replace function public.create_phone_verification_code(
  p_phone text,
  p_code text,
  p_expires_at timestamptz,
  p_cooldown_seconds integer,
  p_max_per_hour integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_sent timestamptz;
  v_count_last_hour integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_phone));

  select created_at into v_last_sent
  from public.phone_verifications
  where phone = p_phone
  order by created_at desc
  limit 1;

  if v_last_sent is not null and now() < v_last_sent + make_interval(secs => p_cooldown_seconds) then
    return 'cooldown';
  end if;

  select count(*) into v_count_last_hour
  from public.phone_verifications
  where phone = p_phone and created_at > now() - interval '1 hour';

  if v_count_last_hour >= p_max_per_hour then
    return 'limit_exceeded';
  end if;

  insert into public.phone_verifications (phone, code, expires_at)
  values (p_phone, p_code, p_expires_at);

  return 'ok';
end;
$$;

-- 활성 코드(미소비, 미만료) 1건을 advisory lock + row lock으로 잠근 뒤 시도 횟수를
-- 원자적으로 증가시키고, 한도 초과 시 코드를 즉시 폐기(consumed)한다.
create or replace function public.verify_phone_verification_code(
  p_phone text,
  p_code text,
  p_max_attempts integer
) returns table(verified boolean, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_stored_code text;
  v_attempts integer;
  v_token text;
begin
  perform pg_advisory_xact_lock(hashtext(p_phone));

  select id, code, attempts into v_id, v_stored_code, v_attempts
  from public.phone_verifications
  where phone = p_phone
    and consumed_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if v_id is null then
    return query select false, null::text;
    return;
  end if;

  if v_attempts >= p_max_attempts then
    update public.phone_verifications set consumed_at = now() where id = v_id;
    return query select false, null::text;
    return;
  end if;

  update public.phone_verifications set attempts = attempts + 1 where id = v_id;

  if v_stored_code <> p_code then
    return query select false, null::text;
    return;
  end if;

  v_token := gen_random_uuid()::text;
  update public.phone_verifications
  set verified_at = now(), verification_token = v_token
  where id = v_id;

  return query select true, v_token;
end;
$$;

revoke all on function public.create_phone_verification_code from public, anon, authenticated;
revoke all on function public.verify_phone_verification_code from public, anon, authenticated;
grant execute on function public.create_phone_verification_code to service_role;
grant execute on function public.verify_phone_verification_code to service_role;


-- ============================================================
-- 6. Storage RLS 정책 (003 + 008)
--   버킷(products-images / product-files / portfolio-images / blogs-images)은
--   Supabase 대시보드 Storage 메뉴에서 수동 생성해야 한다. 이 정책이 없으면
--   anon-key(브라우저) 클라이언트의 업로드가 기본적으로 거부된다.
-- ============================================================

create policy "admin can upload product thumbnails"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'products-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin can upload product files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-files'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin can upload portfolio images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "admin can upload blog images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'blogs-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ============================================================
-- 7. 시드 데이터
-- ============================================================

-- ------------------------------------------------------------
-- 7-1. content_api_configs
--   table_name은 050 이후의 최종 테이블명, select_columns는 010~060 누적 결과다.
--   resource_slug는 URL 경로 세그먼트라 리네이밍 대상이 아니다(products/blog 그대로).
-- ------------------------------------------------------------

insert into public.content_api_configs
  (resource_slug, label, table_name, is_enabled,
   filter_column, filter_value, filter_is_bool,
   identifier_column, identifier_type,
   order_column, order_direction, select_columns)
values
  -- 002 최초 6개 (blog/products/portfolio/orders/quotes/users)
  ('blog', '블로그', 'gospelfix_news', true,
   'is_published', 'true', true,
   'slug', 'text', 'sort_order', 'asc',
   'id,title,slug,content,category,thumbnail_url,portfolio_images,is_published,sort_order,created_at'),

  -- products의 select_columns 누적 경로:
  --   002 초기값 → 016(+supply_price,+purchase_options:options) → 018(-includes)
  --   → 020(+production_solution) → 022(+product_code,+design_type) → 024(+like_count)
  --   → 028(+content_html) → 030(+discount_starts_at,+discount_ends_at)
  --   → 035(+has_ai_starter_kit) → 037/039(flat 3개 → code_preview)
  --   → 052/053(banner_image_url 추가 후 제거) → 060(+sub_categories)
  -- ※ file_path는 의도적으로 제외한다(비구매자 노출 금지 필드, 031 참고).
  ('products', '상품', 'moda_products', true,
   'is_active', 'true', true,
   'slug', 'text', 'sort_order', 'asc',
   'id,slug,name,description,category,price,thumbnail_url,demo_url,is_active,created_at,updated_at,supply_price,purchase_options:options,production_solution,product_code,design_type,like_count,content_html,discount_starts_at,discount_ends_at,has_ai_starter_kit,code_preview,sub_categories'),

  ('portfolio', '포트폴리오', 'gospelfix_portfolios', false,
   'is_published', 'true', true,
   'id', 'uuid', 'sort_order', 'asc',
   'id,title,category,description,tags,thumbnail_url,site_url,images,sort_order,created_at'),

  ('orders', '주문', 'moda_orders', false,
   null, null, false, 'id', 'uuid', 'created_at', 'desc', null),

  ('quotes', '견적 신청', 'gospelfix_quote_submissions', false,
   null, null, false, 'id', 'uuid', 'created_at', 'desc', null),

  ('users', '유저', 'profiles', false,
   null, null, false, 'id', 'uuid', 'created_at', 'desc', null),

  -- 025
  ('cart', '장바구니', 'moda_cart_items', false,
   null, null, false,
   'id', 'uuid', 'created_at', 'desc',
   'id,user_id,product_id,option_id,option_label,price,created_at'),

  -- 042 + 043(select_columns에 show_referral_actions 추가)
  ('referral-banners', '추천인 배너', 'referral_banners', true,
   'is_enabled', 'true', true,
   'id', 'uuid', 'sort_order', 'asc',
   'id,message,discount_rate,show_referral_actions,sort_order,created_at,updated_at'),

  -- 055 + 056(status → review_status 정정) + 058(is_enabled true) + 060(+sub_categories)
  -- ※ 실제 /api/v1/my-products* 라우트는 전용 route.ts라 이 설정으로 쿼리하지 않는다.
  --   /settings 토글 노출과 /api-docs 문서화 목적의 행이다.
  ('my-products', '판매자 셀프서비스 상품', 'moda_products', true,
   null, null, false,
   'id', 'uuid', 'created_at', 'desc',
   'id,slug,name,category,price,review_status,seller_id,is_active,created_at,updated_at,sub_categories'),

  -- 063
  ('product-categories', '상품 대분류', 'moda_product_categories', true,
   'is_active', 'true', true,
   'value', 'text', 'sort_order', 'asc',
   'value,label,sort_order'),

  ('product-sub-categories', '상품 소분류', 'moda_product_sub_categories', true,
   'is_active', 'true', true,
   'value', 'text', 'sort_order', 'asc',
   'value,label,sort_order')
on conflict (resource_slug) do nothing;


-- ------------------------------------------------------------
-- 7-2. auth_api_configs (006 + 014 + 057)
-- ------------------------------------------------------------

insert into public.auth_api_configs (endpoint_slug, label, is_enabled) values
  ('signup',            '회원가입 API',             true),
  ('login',             '로그인 API',               true),
  ('phone_send_code',   '휴대폰 인증번호 발송 API', true),
  ('phone_verify_code', '휴대폰 인증번호 확인 API', true),
  ('account_update',    '프로필 수정 API',          true),
  ('account_password',  '비밀번호 변경 API',        true),
  ('account_avatar',    '아바타 업로드 API',        true),
  ('account_delete',    '회원탈퇴 API',             true),
  ('seller_request',    '판매자 신청 API',          true)
on conflict (endpoint_slug) do nothing;


-- ------------------------------------------------------------
-- 7-3. referral_banners (042 시드 1건)
--   ※ 043/045/046에서 추가된 show_referral_actions/banner_type은 기본값
--     (true / 'referral')을 그대로 사용한다.
-- ------------------------------------------------------------

insert into public.referral_banners (message, discount_rate, is_enabled, sort_order) values
  ('추천인 코드를 공유하면 나와 친구 모두 50% 할인 쿠폰을 받아요', 50, true, 1);


-- ------------------------------------------------------------
-- 7-4. moda_product_categories / moda_product_sub_categories (062)
--   2026-08-27 확정된 taxonomy
-- ------------------------------------------------------------

insert into public.moda_product_categories (value, label, sort_order) values
  ('website',  '웹사이트', 1),
  ('ux_ui',    'UX/UI',    2),
  ('branding', '브랜딩',   3)
on conflict (value) do nothing;

insert into public.moda_product_sub_categories (value, label, sort_order) values
  ('etc',                   '기타분류',            1),
  ('leisure_sports',        '레저/스포츠',         2),
  ('appliance_electronics', '가전/전자',           3),
  ('lifestyle',             '생활/라이프',         4),
  ('entertainment_media',   '엔터테인먼트/미디어', 5),
  ('beauty_women',          '뷰티/여성',           6),
  ('corporate_group',       '기업/그룹',           7),
  ('fashion_shopping',      '패션/쇼핑',           8),
  ('travel_stay',           '여행/숙소',           9),
  ('culture_art',           '문화/예술',           10),
  ('education_academy',     '교육/학원',           11),
  ('furniture_interior',    '가구/인테리어',       12),
  ('kids_children',         '유아/아동',           13),
  ('event_promotion',       '이벤트/프로모션',     14),
  ('occasion_campaign',     '행사/캠페인',         15)
on conflict (value) do nothing;


-- ============================================================
-- ROLLBACK (DOWN)
-- 이 파일은 63개 마이그레이션을 통합한 전체 스키마 스냅샷이므로 "되돌리기"는
-- 사실상 데이터베이스 전체 삭제와 같다. 개별 변경의 롤백 SQL이 필요하면
-- git 히스토리에서 해당 마이그레이션 파일(001~063)을 찾아 그 파일 하단의
-- `-- ROLLBACK (DOWN)` 섹션을 참고할 것.
--
-- 신규 프로젝트에서 이 파일 전체를 되돌려야 한다면(개발 환경 한정):
-- ============================================================
-- drop table if exists
--   public.moda_reviews,
--   public.moda_product_likes,
--   public.moda_cart_items,
--   public.moda_orders,
--   public.moda_coupons,
--   public.moda_products,
--   public.moda_product_sub_categories,
--   public.moda_product_categories,
--   public.gospelfix_quote_submissions,
--   public.gospelfix_portfolios,
--   public.gospelfix_news,
--   public.referral_banners,
--   public.phone_verifications,
--   public.content_api_configs,
--   public.auth_api_configs,
--   public.profiles
--   cascade;
--
-- drop function if exists public.sync_product_like_count();
-- drop function if exists public.verify_phone_verification_code(text, text, integer);
-- drop function if exists public.create_phone_verification_code(text, text, timestamptz, integer, integer);
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop function if exists public.set_updated_at();
--
-- drop policy if exists "admin can upload blog images" on storage.objects;
-- drop policy if exists "admin can upload portfolio images" on storage.objects;
-- drop policy if exists "admin can upload product files" on storage.objects;
-- drop policy if exists "admin can upload product thumbnails" on storage.objects;
