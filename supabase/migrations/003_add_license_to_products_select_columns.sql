-- ============================================================
-- 003_add_license_to_products_select_columns.sql
-- 작성일: 2026-08-29
--
-- 배경: 002_add_products_license.sql에서 public.moda_products에 license
-- 컬럼을 추가했다. 이 프로젝트의 공개 REST API(/api/v1/[resource]/[identifier])는
-- 테이블을 직접 select하지 않고 content_api_configs.select_columns(콤마 구분
-- 화이트리스트)를 그대로 사용한다(src/libs/supabase/queries/content-api-configs.ts).
-- 이 화이트리스트를 갱신하지 않으면 컬럼을 추가해도 API 응답에는 자동 반영되지
-- 않는다(2026-07-28 blog.portfolio_images 누락 사례와 동일한 함정) — 002와 반드시
-- 같은 작업 단위로 실행해야 한다.
--
-- 대상 행 2개:
--   - resource_slug = 'products' (공개 카탈로그, GET /api/v1/products)
--     001_consolidated_schema_2026-08-28.sql:1115-1118
--   - resource_slug = 'my-products' (판매자 셀프서비스 문서화용 row.
--     실제 /api/v1/my-products* 라우트는 전용 route.ts라 이 설정으로 쿼리하지
--     않지만, /settings 토글 노출 + /api-docs 문서화 목적으로 select_columns를
--     최신 상태로 유지한다 — 001_consolidated_schema_2026-08-28.sql:1146-1152 주석 참고)
--     001_consolidated_schema_2026-08-28.sql:1149-1152
--
-- products 테이블은 과거 대시보드 수동 드리프트 이력이 있어(자세한 내용은
-- .claude/agent-memory/supabase-db-architect/products_table_drift.md) 이
-- 프로젝트 컨벤션상 select_columns 전체 값을 하드코딩해서 덮어쓰지 않는다.
-- 대신 'license'가 아직 없는 경우에만 concat으로 이어붙이는 멱등 UPDATE로 작성한다
-- (재실행해도 중복 추가되지 않음).
--
-- ⚠️ 이 파일은 작성만 하고 실행하지 않는다. Supabase 대시보드 SQL Editor에서
--    002_add_products_license.sql 실행 후 이어서 직접 실행해달라.
-- ============================================================

begin;

update public.content_api_configs
set select_columns = concat(select_columns, ',license')
where resource_slug in ('products', 'my-products')
  and select_columns is not null
  and select_columns !~ '(^|,)license(,|$)';

commit;

-- ============================================================
-- ROLLBACK (DOWN) — 필요 시 아래를 그대로 복사해 대시보드 SQL Editor에서 실행
-- ============================================================
-- begin;
-- update public.content_api_configs
-- set select_columns = regexp_replace(
--       regexp_replace(select_columns, ',license$', ''),
--       '^license,', ''
--     )
-- where resource_slug in ('products', 'my-products');
-- commit;
