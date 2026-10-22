-- ============================================================
-- 002_add_products_license.sql
-- 작성일: 2026-08-29
--
-- 배경: 자매 프론트엔드 저장소(gospelfix)의 "저작권 및 라이선스" UI가 판매자
-- 상품 편집 화면에서 라이선스 옵션 4개(cc-by / cc-by-nc / cc-by-nc-nd /
-- all-rights-reserved) 중 하나를 선택하게 하고, 이미 `license` 필드로
-- POST /api/v1/my-products, PATCH /api/v1/my-products/[id] 요청 본문에
-- 실어 보내고 있다. 그런데 이 저장소(cms.api)의 public.moda_products
-- 테이블에는 이를 받을 컬럼이 없어 값이 조용히 버려지고 있었다(2026-08-29
-- 발견). 상품 상세페이지(공개, GET /api/v1/products)에서도 이 값을 읽어
-- 표시하므로 공개 API 응답에도 노출돼야 한다.
--
-- 001_consolidated_schema_2026-08-28.sql:332-387의 public.moda_products
-- CREATE TABLE에 license 컬럼을 추가한다. 001 squash(2026-08-28) 이후 첫
-- 신규 마이그레이션이라 번호는 002.
--
-- 기본값은 프론트엔드 기본값(DEFAULT_LICENSE)과 동일한 'all-rights-reserved'
-- (판권소유)로 맞춘다. 값 화이트리스트는 앱 레벨 sanitize뿐 아니라 DB CHECK
-- 제약으로도 강제한다.
--
-- 후속 마이그레이션: 003_add_license_to_products_select_columns.sql
--   (content_api_configs.select_columns 화이트리스트 갱신 — 이걸 하지 않으면
--   컬럼을 추가해도 공개/문서 API 응답에 반영되지 않는다)
--
-- ⚠️ 이 파일은 작성만 하고 실행하지 않는다. Supabase 대시보드 SQL Editor에서
--    직접 실행해달라.
-- ============================================================

begin;

alter table public.moda_products
  add column if not exists license text;

-- 컬럼 추가와 값 채우기를 분리한다(대용량 테이블에서도 안전한 패턴).
-- 기존 행 전체를 프론트엔드 기본값과 동일하게 채운다.
update public.moda_products
  set license = 'all-rights-reserved'
  where license is null;

alter table public.moda_products
  alter column license set default 'all-rights-reserved';

alter table public.moda_products
  alter column license set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'moda_products_license_check'
  ) then
    alter table public.moda_products
      add constraint moda_products_license_check
      check (license in ('cc-by', 'cc-by-nc', 'cc-by-nc-nd', 'all-rights-reserved'));
  end if;
end $$;

comment on column public.moda_products.license is
  '저작권 및 라이선스. cc-by(저작권표시) / cc-by-nc(저작권표시-비영리) / '
  'cc-by-nc-nd(저작권표시-비영리-변경금지) / all-rights-reserved(판권소유, '
  '프론트엔드 기본값) 중 하나. 판매자가 /mall 상품 편집 화면(gospelfix 프론트엔드)에서 '
  '선택하며, 공개 상품 상세페이지(GET /api/v1/products)에도 그대로 노출된다.';

commit;

-- ============================================================
-- ROLLBACK (DOWN) — 필요 시 아래를 그대로 복사해 대시보드 SQL Editor에서 실행
-- ============================================================
-- begin;
-- alter table public.moda_products drop constraint if exists moda_products_license_check;
-- alter table public.moda_products drop column if exists license;
-- commit;
