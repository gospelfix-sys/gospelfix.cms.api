-- ============================================================
-- 005_add_products_allow_coupon.sql
-- 작성일: 2026-11-17
--
-- 배경: 상세페이지의 "N% 할인 쿠폰 적용" 체크박스가 구매자가 쿠폰을 가지고 있기만
-- 하면 모든 유료 상품에 기본으로 노출됐다. 판매자가 가격·제작 조건을 정한 상품에
-- 플랫폼 쿠폰이 자동으로 붙는 것은 의도와 다르므로, 판매자가 상품 등록 시 쿠폰
-- 적용을 허용한 상품에만 쿠폰을 쓸 수 있게 한다.
--
-- 변경:
--   1) public.moda_products.allow_coupon boolean not null default false 추가.
--      기존 상품은 모두 false(쿠폰 미적용)로 시작한다 — 판매자가 켠 상품만 적용.
--   2) content_api_configs.select_columns 화이트리스트에 allow_coupon 추가
--      (003과 같은 사유 — 하지 않으면 공개 GET /api/v1/products 응답에 안 나온다).
--      'allow_coupon'이 없을 때만 이어붙이는 멱등 UPDATE.
--
-- 서버 강제: POST /api/v1/orders가 allow_coupon=false 상품의 couponCode를 400으로
-- 거부한다. 화면에서 숨기는 것만으로는 직접 API 호출로 우회되기 때문이다.
--
-- ⚠️ 이 파일은 작성만 하고 실행하지 않는다. Supabase 대시보드 SQL Editor에서
--    직접 실행해달라. 실행 전에 cms.api/gospelfix 배포 순서를 확인한다:
--    SQL 실행 → cms.api 배포 → gospelfix 배포.
-- ============================================================

begin;

alter table public.moda_products
  add column if not exists allow_coupon boolean not null default false;

comment on column public.moda_products.allow_coupon is
  '판매자가 쿠폰(가입 쿠폰 등) 적용을 허용한 상품 여부. 기본 false. false면 구매자가 쿠폰을 '
  '보유해도 이 상품 주문에는 쓸 수 없다(POST /api/v1/orders가 서버에서 거부). 판매자가 상품 '
  '등록 화면(gospelfix 프론트엔드)에서 선택한다.';

update public.content_api_configs
set select_columns = concat(select_columns, ',allow_coupon')
where resource_slug in ('products', 'my-products')
  and select_columns is not null
  and select_columns !~ '(^|,)allow_coupon(,|$)';

commit;

-- ============================================================
-- ROLLBACK (DOWN) — 필요 시 아래를 그대로 복사해 대시보드 SQL Editor에서 실행
-- ============================================================
-- begin;
-- update public.content_api_configs
-- set select_columns = regexp_replace(
--       regexp_replace(select_columns, ',allow_coupon$', ''),
--       '^allow_coupon,', ''
--     )
-- where resource_slug in ('products', 'my-products');
-- alter table public.moda_products drop column if exists allow_coupon;
-- commit;
