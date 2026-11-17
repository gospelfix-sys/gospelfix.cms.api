-- 판매자 정산 계좌. 계좌번호는 개인정보라 profiles(공유 테이블)에 두지 않고 별도 테이블에
-- 앱 레벨 AES-256-GCM으로 암호화해 저장한다(키는 서버 환경변수 PAYOUT_ACCOUNT_ENCRYPTION_KEY).
-- RLS를 켜고 정책을 만들지 않아 service role(cms.api 서버)만 접근할 수 있다.
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   drop table if exists public.moda_seller_payout_accounts;

begin;

create table if not exists public.moda_seller_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text not null,
  account_holder text not null,
  account_number_encrypted text not null,
  account_last4 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.moda_seller_payout_accounts enable row level security;

comment on table public.moda_seller_payout_accounts is
  '판매자 정산 계좌(1인 1계좌). 번호는 암호화 저장, 화면에는 끝 4자리만 노출';
comment on column public.moda_seller_payout_accounts.account_number_encrypted is
  'AES-256-GCM 암호문(v1:iv:tag:data, base64). 평문 번호는 저장하지 않는다';

commit;
