-- 판매자 정산 계좌를 구매자 입금 안내에 노출하기 위한 제3자 제공 동의 기록.
-- third_party_consent_at이 null인 계좌(기존 등록분 포함)는 "동의 전"으로 보고 구매자에게 보이지 않으며,
-- 판매자가 새 안내문에 동의하고 다시 저장해야 노출 대상이 된다.
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   alter table public.moda_seller_payout_accounts drop column if exists third_party_consent_at;

begin;

alter table public.moda_seller_payout_accounts
  add column if not exists third_party_consent_at timestamptz;

comment on column public.moda_seller_payout_accounts.third_party_consent_at is
  '구매자에게 계좌를 보여주는 것(개인정보 제3자 제공)에 동의한 시각. null이면 미동의라 노출하지 않는다';

commit;
