-- 개인 판매자 신원정보에 이름을 추가한다. 사업자는 대표자명(representative_name)이 있어 null로 둔다.
-- 기존 행은 이름이 없으므로 nullable로 추가하고, 신규 제출은 cms.api가 필수로 검증한다.
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   alter table public.moda_seller_identities drop column if exists contact_name;

begin;

alter table public.moda_seller_identities
  add column if not exists contact_name text;

comment on column public.moda_seller_identities.contact_name is
  '개인 판매자 이름. 구매자에게 공개하지 않는다(사업자는 representative_name 사용)';

commit;
