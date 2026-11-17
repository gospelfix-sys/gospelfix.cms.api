-- ============================================================
-- 004_add_service_delivery_license.sql
-- 작성일: 2026-11-17
--
-- 배경: 자매 프론트엔드 저장소(gospelfix)의 "저작권 및 라이선스" 선택지에
-- 유료 상품 전용 구분 'service-delivery'(제작·납품 서비스)를 추가한다.
-- 공개 소스(MIT 등)로 만든 결과물을 파는 상품은 상용 라이선스
-- (all-rights-reserved, 이용 제한)를 걸면 원 라이선스와 충돌하므로, 파일·코드
-- 판매가 아니라 "구매자 자료로 만들어 납품하는 용역"으로 구분해 판다
-- (사용자 결정, 2026-11-17).
--
-- 002_add_products_license.sql에서 만든 moda_products_license_check 제약은
-- 4개 값만 허용하므로, 새 값을 저장하려면 제약을 5개 값으로 교체해야 한다.
-- CHECK 제약은 내용을 바꾸는 ALTER가 없어 drop 후 재생성한다(재실행 안전).
-- 기존 행은 모두 4개 값 중 하나라 새 제약 검증을 그대로 통과한다 — 이 마이그레이션은
-- 기존 상품의 license 값을 바꾸지 않는다(기본값 all-rights-reserved도 유지).
--
-- 함께 처리: 라이선스 동의 이력 테이블(moda_product_license_agreements)은
-- 파일 마이그레이션 없이 대시보드/MCP로 만들어져 license 컬럼에 같은 4개 값
-- CHECK가 걸려 있는지 이 저장소에서 확인할 수 없다. 걸려 있다면 새 값의 동의
-- 기록 insert가 실패해 상품 저장 전체가 500이 되므로, 'all-rights-reserved'를
-- 포함한 CHECK가 있을 때만 찾아서 5개 값으로 교체한다(없으면 아무것도 하지 않음).
--
-- select_columns(content_api_configs)는 컬럼 추가가 아니라 허용 값 변경이라
-- 갱신할 필요가 없다(003에서 이미 license 포함).
--
-- 관련 코드 변경(같은 작업 단위):
--   - cms.api: src/types/product.ts, src/libs/openapi/schemas/product.schema.ts,
--     src/libs/openapi/schemas/my-products.schema.ts,
--     src/libs/supabase/queries/products.my.ts (LICENSE_VALUES)
--   - gospelfix: src/types/product.types.ts (LICENSE_OPTIONS 등)
--   배포 순서: 이 SQL 실행 → cms.api 배포 → gospelfix 배포. 순서가 바뀌면
--   새 값 저장 시 cms.api 400(zod enum) 또는 DB 23514(check violation)가 난다.
--
-- ⚠️ 이 파일은 작성만 하고 실행하지 않는다. Supabase 대시보드 SQL Editor에서
--    직접 실행해달라.
-- ============================================================

begin;

alter table public.moda_products
  drop constraint if exists moda_products_license_check;

alter table public.moda_products
  add constraint moda_products_license_check
  check (license in (
    'cc-by',
    'cc-by-nc',
    'cc-by-nc-nd',
    'all-rights-reserved',
    'service-delivery'
  ));

comment on column public.moda_products.license is
  '저작권 및 라이선스. cc-by(저작권표시) / cc-by-nc(저작권표시-비영리) / '
  'cc-by-nc-nd(저작권표시-비영리-변경금지) / all-rights-reserved(GospelFix 상용 '
  '라이선스, 판권소유, 기본값) / service-delivery(제작·납품 서비스 — 파일 판매가 '
  '아닌 용역 상품, 유료 전용) 중 하나. 판매자가 상품 편집 화면(gospelfix 프론트엔드)에서 '
  '선택하며, 공개 상품 상세페이지(GET /api/v1/products)에도 그대로 노출된다.';

-- 동의 이력 테이블의 license CHECK(있을 때만) 교체. 이름을 모르므로 정의 내용으로 찾는다.
do $$
declare
  r record;
begin
  if to_regclass('public.moda_product_license_agreements') is null then
    return;
  end if;

  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.moda_product_license_agreements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%all-rights-reserved%'
  loop
    execute format(
      'alter table public.moda_product_license_agreements drop constraint %I',
      r.conname
    );
    execute format(
      'alter table public.moda_product_license_agreements add constraint %I '
      'check (license in (''cc-by'', ''cc-by-nc'', ''cc-by-nc-nd'', '
      '''all-rights-reserved'', ''service-delivery''))',
      r.conname
    );
  end loop;
end $$;

commit;

-- ============================================================
-- ROLLBACK (DOWN) — 필요 시 아래를 그대로 복사해 대시보드 SQL Editor에서 실행
-- ⚠️ 먼저 service-delivery로 저장된 상품이 없는지 확인해야 한다. 남아 있으면
--    4개 값 제약 재생성이 실패한다(check violation). 그런 상품을 어떤 값으로
--    되돌릴지는 판매자·구매자 고지 문제라 사용자가 정해야 하며, 일괄 UPDATE로
--    임의 변경하지 않는다.
--      select id, slug, name from public.moda_products where license = 'service-delivery';
--    동의 이력 테이블도 같은 이유로 service-delivery 행이 있으면 실패한다
--    (이력은 증빙이라 삭제하지 말 것 — 그 경우 이력 테이블 제약은 그대로 둔다).
-- ============================================================
-- begin;
-- alter table public.moda_products drop constraint if exists moda_products_license_check;
-- alter table public.moda_products
--   add constraint moda_products_license_check
--   check (license in ('cc-by', 'cc-by-nc', 'cc-by-nc-nd', 'all-rights-reserved'));
-- comment on column public.moda_products.license is
--   '저작권 및 라이선스. cc-by(저작권표시) / cc-by-nc(저작권표시-비영리) / '
--   'cc-by-nc-nd(저작권표시-비영리-변경금지) / all-rights-reserved(판권소유, '
--   '프론트엔드 기본값) 중 하나. 판매자가 /mall 상품 편집 화면(gospelfix 프론트엔드)에서 '
--   '선택하며, 공개 상품 상세페이지(GET /api/v1/products)에도 그대로 노출된다.';
-- commit;
