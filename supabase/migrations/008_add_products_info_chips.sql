-- ============================================================
-- 008_add_products_info_chips.sql
-- 작성일: 2026-11-27
--
-- 배경: 상품 상세의 정보 칩(진행방식·결제수단·제공형태 등)이 gospelfix 프론트엔드에
-- 하드코딩돼 있어 카테고리가 늘어나면 대응할 수 없다. 판매자가 상품 등록 시 `라벨 + 값`
-- 행을 직접 추가·수정·삭제·정렬하고, 그 값을 상품별로 저장한다.
--
-- 변경:
--   1) public.moda_products.info_chips jsonb not null default '[]' 추가.
--      형태: [{ "id": string, "label": string, "value": string }, ...]
--      기존 상품은 빈 배열로 시작한다 — 프론트엔드가 빈 배열이면 기본 6칩으로 폴백한다.
--   2) jsonb_typeof = 'array' CHECK 제약 (code_preview 선례).
--   3) content_api_configs.select_columns 화이트리스트에 info_chips 추가
--      (003/005와 같은 사유 — 하지 않으면 공개 GET /api/v1/products/:slug 응답에 안 나온다).
--      'info_chips'가 없을 때만 이어붙이는 멱등 UPDATE.
--
-- 서버 강제: 개수(10)·길이(label 20 / value 60) 상한은 cms.api의 sanitizeInfoChips가
-- 저장 시점에 적용한다(클라이언트 maxLength는 직접 API 호출로 우회되므로).
--
-- ⚠️ 코드 배포보다 먼저 실행해야 한다. 컬럼이 없는 상태에서 cms.api를 배포하면
--    ADMIN/MY_SELECT_COLUMNS의 select가 PostgREST 에러로 실패한다.
--    배포 순서: SQL 실행 → cms.api 배포 → gospelfix 배포.
-- ============================================================

begin;

alter table public.moda_products
  add column if not exists info_chips jsonb not null default '[]'::jsonb;

alter table public.moda_products
  drop constraint if exists moda_products_info_chips_array_check;
alter table public.moda_products
  add constraint moda_products_info_chips_array_check
  check (jsonb_typeof(info_chips) = 'array');

comment on column public.moda_products.info_chips is
  '상품 상세 정보 칩. [{id,label,value}] 배열(최대 10개, label 20자·value 60자). 판매자가 상품 '
  '등록 화면에서 직접 추가·수정·삭제·정렬한다. 빈 배열이면 프론트엔드가 기본 칩으로 폴백한다.';

update public.content_api_configs
set select_columns = concat(select_columns, ',info_chips')
where resource_slug in ('products', 'my-products')
  and select_columns is not null
  and select_columns !~ '(^|,)info_chips(,|$)';

commit;

-- ============================================================
-- ROLLBACK (DOWN) — 필요 시 아래를 그대로 복사해 대시보드 SQL Editor에서 실행
-- ============================================================
-- begin;
-- update public.content_api_configs
-- set select_columns = regexp_replace(
--       regexp_replace(select_columns, ',info_chips$', ''),
--       '^info_chips,', ''
--     )
-- where resource_slug in ('products', 'my-products');
-- alter table public.moda_products drop constraint if exists moda_products_info_chips_array_check;
-- alter table public.moda_products drop column if exists info_chips;
-- commit;
