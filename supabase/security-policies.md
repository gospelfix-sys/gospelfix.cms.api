# Supabase 보안 정책 기록 (Storage RLS · 함수 권한)

> **마이그레이션이 아니라 이력 문서다.** 이 저장소는 신규 마이그레이션 파일을 만들지 않고 DDL을 Supabase MCP로 직접 실행한다.
> 아래 SQL은 2026-10-26에 신규 프로젝트로 이전한 뒤 빠진 설정을 복구한 내용이며, 프로젝트를 다시 이전하거나 새로 만들 때 재적용용으로 쓴다. `001_consolidated_schema`(특히 `public.profiles`)를 적용한 뒤 실행하며, 대상 객체가 존재하면 멱등하다(아래 `rls_auto_enable`·`handle_updated_at`은 001에 정의가 없어 새 프로젝트에 없으면 해당 문장이 실패하므로 `to_regprocedure()`로 존재를 먼저 확인한다).
> **기준은 항상 실제 DB다.** 정책이나 권한을 바꾸면 이 문서도 같이 갱신한다.

## 배경

프로젝트 이전 후 `storage.objects` RLS 정책과 `public` 함수의 EXECUTE 권한이 이전되지 않았다.

- 증상: 관리자 화면 파일 업로드가 `new row violates row-level security policy`로 실패
- 원인: `storage.objects`에 정책이 0개 (public 버킷은 읽기만 열어줄 뿐 쓰기는 INSERT 정책이 필요)
- 부수 발견: advisor가 search_path 미고정, SECURITY DEFINER 함수 anon 실행 가능을 경고

## 1. Storage RLS (`restore_storage_objects_rls_policies`)

| 버킷 | 공개 | 쓰기 권한 |
|---|---|---|
| `portfolio-images`, `blogs-images`, `products-images` | public | `profiles.role = 'admin'` |
| `product-files` | private | `profiles.role = 'admin'` (SELECT 포함) |
| `avatars` | public | 본인 폴더 `<auth.uid()>/…` |

- 읽기는 public URL을 쓰므로 공개 SELECT 정책은 없다. UPDATE/DELETE가 행을 조회해야 해서 관리자 버킷에는 admin 전용 SELECT를 둔다.
- `uploadMyProductFile`, `uploadAvatar`, `createSignedUrl`은 service role이라 이 정책과 무관하다.
- 브라우저 업로드(`uploadFile.ts`, `RichEditor`, PortfolioForm, PostForm)는 이 정책이 있어야 동작한다.

```sql
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant usage on schema private to authenticated;

do $$
declare
  b text;
begin
  foreach b in array array['portfolio-images', 'blogs-images', 'products-images', 'product-files']
  loop
    execute format('drop policy if exists %I on storage.objects', 'admin_select_' || b);
    execute format('drop policy if exists %I on storage.objects', 'admin_insert_' || b);
    execute format('drop policy if exists %I on storage.objects', 'admin_update_' || b);
    execute format('drop policy if exists %I on storage.objects', 'admin_delete_' || b);

    execute format(
      'create policy %I on storage.objects for select to authenticated
         using (bucket_id = %L and (select private.is_admin()))',
      'admin_select_' || b, b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated
         with check (bucket_id = %L and (select private.is_admin()))',
      'admin_insert_' || b, b);
    execute format(
      'create policy %I on storage.objects for update to authenticated
         using (bucket_id = %L and (select private.is_admin()))
         with check (bucket_id = %L and (select private.is_admin()))',
      'admin_update_' || b, b, b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated
         using (bucket_id = %L and (select private.is_admin()))',
      'admin_delete_' || b, b);
  end loop;
end $$;

drop policy if exists owner_select_avatars on storage.objects;
drop policy if exists owner_insert_avatars on storage.objects;
drop policy if exists owner_update_avatars on storage.objects;
drop policy if exists owner_delete_avatars on storage.objects;

create policy owner_select_avatars on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy owner_insert_avatars on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy owner_update_avatars on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy owner_delete_avatars on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
```

> 2026-10-26 DB 실측 확인 완료: `authenticated`는 `private.is_admin()` 실행 가능·`private` 스키마 usage 있음, `anon`은 실행 불가, `storage.objects` 정책 20개.

## 2. public 함수 권한 (`harden_public_function_privileges`)

```sql
-- search_path 고정 (세 함수 본문은 테이블 참조가 없거나 public.profiles로 한정돼 있어 수정 불필요)
alter function public.handle_new_user() set search_path = '';
alter function public.handle_updated_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';

-- 트리거·이벤트 트리거 전용 함수: 트리거는 CREATE TRIGGER 시점에만 EXECUTE를 검사하므로 회수해도 동작한다
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sync_product_like_count() from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- 전화 인증 RPC: service_role 전용 (001 마이그레이션의 원래 설정)
revoke execute on function public.create_phone_verification_code(text, text, timestamptz, integer, integer) from public, anon, authenticated;
revoke execute on function public.verify_phone_verification_code(text, text, integer) from public, anon, authenticated;
grant execute on function public.create_phone_verification_code(text, text, timestamptz, integer, integer) to service_role;
grant execute on function public.verify_phone_verification_code(text, text, integer) to service_role;
```

- 전화 인증 RPC의 `revoke/grant`는 001에도 있는 원래 설정이라, 001이 그대로 적용된 프로젝트에서는 no-op이다.
- 호출처는 `src/libs/supabase/queries/phone-verification.ts`의 `createAdminClient()`(service_role)뿐이다.
- 자매 저장소(`gospelfix`, `/mall`)가 anon으로 이 RPC를 직접 호출하면 깨진다. 이 경우 RPC를 anon에 다시 열기보다 `/api/v1/auth/phone/*` 경유로 바꾼다.

## 3. 대시보드에서 직접 설정 (SQL 불가)

- Authentication → Sign In / Providers → Email(Password Security)에서 **Prevent use of leaked passwords** 켜기 (Pro 플랜 이상)

## 프로젝트 이전 시 점검 체크리스트

1. `pg_policies`의 `storage.objects` 정책 개수
2. `public` 함수의 EXECUTE grant (`information_schema.routine_privileges`)
3. `get_advisors(security)`
4. `profiles`에 `role='admin'` 사용자가 있는지
