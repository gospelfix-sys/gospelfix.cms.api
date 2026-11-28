-- 판매자 신원정보에 과세유형을 추가한다. 국세청 사업자 상태조회 결과를 저장하며,
-- 일반과세자 상품에만 부가세(10%)를 가산하는 판단 근거로 쓴다.
-- null = 미확인(개인 판매자, 또는 기존 사업자 판매자로서 아직 재조회하지 않은 경우).
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   alter table public.moda_seller_identities drop constraint if exists moda_seller_identities_tax_type_check;
--   alter table public.moda_seller_identities drop column if exists tax_type_checked_at;
--   alter table public.moda_seller_identities drop column if exists tax_type;

begin;

alter table public.moda_seller_identities
  add column if not exists tax_type text,
  add column if not exists tax_type_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'moda_seller_identities_tax_type_check'
  ) then
    alter table public.moda_seller_identities
      add constraint moda_seller_identities_tax_type_check
      check (tax_type is null or tax_type in ('general', 'simplified', 'exempt', 'other'));
  end if;
end $$;

comment on column public.moda_seller_identities.tax_type is
  '과세유형(국세청 상태조회): general=일반과세자, simplified=간이과세자, exempt=면세사업자, other=그 외(폐업·휴업 등). null=미확인';
comment on column public.moda_seller_identities.tax_type_checked_at is
  '과세유형을 마지막으로 국세청에서 조회한 시각';

commit;
