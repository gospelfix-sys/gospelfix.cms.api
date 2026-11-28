-- 주문에 공급가액·부가세를 분리해 저장한다. 기존 amount는 "구매자가 실제 입금하는 총액"으로 유지한다.
-- (moda_products.supply_price는 세법상 공급가액이 아니라 공급원가=정가라서 이름이 겹치지 않게 supply_amount로 지었다.)
--
-- 기존 행은 부가세가 없던 주문이므로 supply_amount = amount, vat_amount = 0으로 채운다.
-- supply_amount를 nullable로 두는 이유: 이 마이그레이션 적용 직후 구버전 cms.api가 잠시 값 없이 insert해도 깨지지 않게 하기 위해서다.
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   alter table public.moda_orders drop constraint if exists moda_orders_amount_split_check;
--   alter table public.moda_orders drop column if exists tax_type_snapshot;
--   alter table public.moda_orders drop column if exists vat_amount;
--   alter table public.moda_orders drop column if exists supply_amount;

begin;

alter table public.moda_orders
  add column if not exists supply_amount integer,
  add column if not exists vat_amount integer not null default 0,
  add column if not exists tax_type_snapshot text;

update public.moda_orders
   set supply_amount = amount
 where supply_amount is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'moda_orders_amount_split_check'
  ) then
    alter table public.moda_orders
      add constraint moda_orders_amount_split_check
      check (supply_amount is null or amount = supply_amount + vat_amount);
  end if;
end $$;

comment on column public.moda_orders.supply_amount is
  '공급가액(쿠폰 할인 후, 부가세 제외). amount = supply_amount + vat_amount';
comment on column public.moda_orders.vat_amount is
  '부가세. 일반과세자 상품이 아니면 0';
comment on column public.moda_orders.tax_type_snapshot is
  '주문 시점 판매자 과세유형(moda_seller_identities.tax_type 스냅샷). 가산 대상이 아니면 null';

commit;
