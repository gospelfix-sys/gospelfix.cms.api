-- 판매자 신원정보(전자상거래법 제20조②: 통신판매중개자의 판매자 신원정보 확인·표시).
-- 개인은 휴대폰·이메일 소유 확인, 사업자는 상호·대표자·주소·전화·사업자등록번호·통신판매업 신고번호를 받는다.
-- profiles(공유 테이블)는 건드리지 않고 별도 테이블로 둔다. 행이 없는 기존 판매자는 "미확인"으로 본다.
-- RLS를 켜고 정책을 만들지 않아 service role(cms.api 서버)만 접근할 수 있다.
--
-- 멱등: 여러 번 실행해도 안전하다.
--
-- ROLLBACK (필요 시):
--   drop table if exists public.moda_seller_identities;

begin;

create table if not exists public.moda_seller_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seller_type text not null check (seller_type in ('individual', 'business')),
  -- 휴대폰·이메일은 인증번호로 소유를 확인한 시각이 있어야 승인 대상이 된다
  contact_phone text not null,
  phone_verified_at timestamptz,
  contact_email text not null,
  email_verified_at timestamptz,
  -- 사업자 판매자 전용(개인은 null). 구매자에게 주문 전 공개되는 항목이다
  business_name text,
  representative_name text,
  business_address text,
  business_phone text,
  business_number text,
  mail_order_report_number text,
  business_verified_at timestamptz,
  -- 신청 상태. 승인은 관리자가 신청 내용을 확인한 뒤 수동으로 한다
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.moda_seller_identities enable row level security;

comment on table public.moda_seller_identities is
  '판매자 신원정보(1인 1행). 행이 없거나 status가 approved가 아니면 신원 미확인 판매자로 취급한다';
comment on column public.moda_seller_identities.contact_phone is
  '본인 확인용 휴대폰(하이픈 없음). 구매자에게 공개하지 않는다';
comment on column public.moda_seller_identities.business_verified_at is
  '국세청 사업자등록정보 진위확인을 통과한 시각. null이면 미검증';

commit;
