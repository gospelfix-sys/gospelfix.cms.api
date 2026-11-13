# Development Guidelines (AI Agent 전용)

## 프로젝트 개요

- Next.js 14 App Router + Supabase. **관리자 CMS + server-to-server REST API(`/api/v1/*`)**.
- 자매 저장소(`gospelfix`, `/mall` 모다 마켓플레이스)가 `/api/v1/*`를 호출한다. **`/api/v1/*` 변경 = 외부 공개 API 계약 변경**으로 취급한다.
- 문서·주석·커밋 메시지는 **한국어**.
- 패키지 매니저는 **yarn 전용**. Node `24.x` 고정. 테스트 러너 없음 → 검증은 `yarn lint`, `yarn build`.

## 디렉터리 책임

| 경로 | 책임 |
|---|---|
| `src/app/(admin)/*` | 관리자 화면. page = Server Component, 폼/테이블 = Client Component |
| `src/app/(admin)/*/actions.ts` | `'use server'` 뮤테이션 전용 |
| `src/app/api/v1/**/route.ts` | 공개 REST API |
| `src/app/api/internal/draft-post` | 블로그 에이전트 초안 저장 (로컬 dev 전용, 항상 미발행) |
| `src/libs/supabase/queries/` | **모든** Supabase 쿼리 |
| `src/libs/openapi/` | `auth.ts`(API 키 검증), `dynamic-spec.ts`, `schemas/*.schema.ts` |
| `src/components/admin/` | 관리자 전용 컴포넌트 (`shared/`는 3회 반복된 것만) |
| `src/components/ui/` | shadcn/ui |
| `src/store/`, `src/hooks/` | Recoil atoms, `useAuth()`/`useUser()` |
| `src/types/` | 도메인 타입 |

## 데이터 접근 규칙

- Supabase 쿼리(`select/insert/update/delete`)는 `src/libs/supabase/queries/<도메인>[.admin|.server].ts`에만 작성한다.
- 컴포넌트·page에서 `createClient()`로 직접 쿼리하지 않는다.
- `actions.ts`에는 뮤테이션만 둔다. 읽기는 Server Component에서 queries 함수를 직접 import한다.
- **`(admin)/**/actions.ts`의 모든 `export async function` 첫 줄은 `await requireAdminPage();`**. 액션 추가 후 `grep -c '^export async function'` 와 `grep -c 'await requireAdminPage'` 개수를 일치시킨다.
- Supabase 클라이언트 선택:

| 상황 | 사용 |
|---|---|
| `'use client'` | `client.ts` |
| Server Component / **공개 API 읽기** (RLS 적용) | `server.ts` |
| 관리자 쓰기, admin 패널 읽기 | `admin.ts` (service_role) |
| 세션 갱신 | `middleware.ts` (`updateSession` 전용) |

- ❌ 공개 API 읽기에 `createAdminClient()` 사용 (RLS 무력화).
- sort_order 일괄 변경은 `upsert({ onConflict: 'id' })` 단일 쿼리로 처리한다. ❌ `Promise.all` + N개 UPDATE.
- 배치 insert는 트랜잭션이 아니므로 실패 시 직접 롤백 쿼리를 작성한다.
- 관리자 페이지에서 `/api/v1/*`를 호출하지 않는다 (`INTERNAL_API_KEY` 노출). `requireAdminPage()` + Server Action + queries 공용 함수로 구현한다.

## 다중 파일 연동 규칙 (동시 수정 필수)

| 변경 | 함께 수정할 곳 |
|---|---|
| 새 관리자 경로 추가 | `src/middleware.ts`의 `ADMIN_PATHS` **와** `config.matcher` 둘 다 + `components/admin/Sidebar` |
| 공개 테이블 컬럼 추가/삭제/이름변경 | DB의 `content_api_configs.select_columns` + `src/libs/openapi/schemas/*.schema.ts` + `src/types/*` + 해당 `queries/*` |
| 테이블 rename | `content_api_configs.table_name` UPDATE + 트리거 함수 본문의 옛 테이블명 grep 후 `CREATE OR REPLACE` + 쿼리 레이어 `.from()` |
| 새 REST 엔드포인트 | `route.ts` + `schemas/*.schema.ts`(Zod + `registerXxxPaths`) + `dynamic-spec.ts` `buildDynamicOpenApiSpec()` 연결 + 토글 설정 |
| 테이블 CRUD 리소스 노출 | `content_api_configs` 행 추가 + `dynamic-spec.ts`의 `TYPED_SLUGS` 등록 |
| 커스텀(auth 등) 엔드포인트 | `auth_api_configs` 행 + `AuthApiConfigCard` 패턴 |
| 에디터 툴바에 서식 추가 | `libs/internal-agent.ts`의 `sanitizeContent()` 허용 목록 |
| 에디터에 새 첨부 파일 형식 추가 | `ATTACHMENT_CONTENT_TYPES` + Storage `blogs-images` 버킷 `allowed_mime_types`(`supabase-db-architect`로 변경) |
| 블로그 카테고리 변경 | 고정 5종과 DB CHECK 제약 동시 수정 |

## REST 엔드포인트 규칙

- `route.ts` **첫 줄**에서 `validateApiKey(request)` 호출. null이 아니면 즉시 반환한다.
- 커스텀 로직이면 그 다음 `requireAuthApiEnabled(slug)` 호출.
- 사용자 호출은 추가로 `Authorization: Bearer` 검증.
- 필수 플로우(auth)는 fail-open, 선택 콘텐츠 API는 fail-closed.
- `/api/v1/*`, `/api/openapi.json`은 미들웨어가 세션 조회 없이 CORS만 주입하고 통과시킨다. 이 경로에서 쿠키 세션에 의존하지 않는다.
- `src/app/api-docs/page.tsx`는 직접 수정하지 않는다.

## 라우팅/인증

- 미들웨어는 로그인 여부만 확인한다. `admin` 역할 검증은 `requireAdminPage()` / `requireAdminApi()`(`queries/auth.ts`)가 `profiles.role`로 수행한다.
- 관리자 로그인은 Google OAuth 전용. `/auth/callback`에서 `role='admin'`이 아니면 **반드시 `signOut` 후** `/sign/in?error=not_admin`으로 보낸다 (세션이 남으면 무한 리다이렉트).
- 신규 가입자는 `role='user'`. 승격은 `/users`에서 수동.

## DB 작업

- ❌ `supabase/migrations/`에 신규 파일 작성 (001~003은 과거 기록).
- ✅ DDL/DML은 `supabase-db-architect` 서브에이전트에 위임 → Supabase MCP(`apply_migration`/`execute_sql`) → 결과 확인 후 쿼리 레이어 `.from()` 동기화.
- 신규 테이블 접두사: `gospelfix_`(news/portfolios/quote_submissions) 또는 `moda_`(products/orders/cart_items/coupons/product_likes/reviews).
- ❌ rename 금지: `profiles`, `auth_api_configs`, `content_api_configs`, `phone_verifications`, `referral_banners`.

## 코드 규칙

- `any` 금지. 에러 삼키기 금지(처리하거나 전파).
- import 경로: `@/libs/utils` (❌ `@/lib/utils`). `yarn shadcn add` 후 확인한다.
- Prettier: `singleQuote: true`, `semi: true`.
- 컴포넌트는 Recoil atom/selector를 직접 구독하지 않고 `useAuth()`/`useUser()` 사용.
- 데이터 패칭은 Server Component 우선, 클라이언트는 `@tanstack/react-query`.
- 추상화는 세 번째 반복에서만. `yarn add` 직전·새 파일 3개 이상 직전에 결정 사다리(NEED → EXIST → NEXT → SUPA → PKG → PATTERN → INLINE → SHARED → BUILD)로 돌아가 첫 해결 단계에서 멈춘다 (`.claude/GOSPELFIX.md`).

## 블로그 에디터

- `RichEditor`(TipTap) 지원: h1~h3, 문단, 목록, 인용구, 구분선, 링크, 표(`TableKit`), 이미지, `.md`/`.zip` 첨부. 표 셀 병합 UI 없음.
- 초안 API(`/api/internal/draft-post`)만 `sanitizeContent()`를 거치며 `img`, `colspan`/`rowspan`/`colgroup`은 제거된다.
- 이미지/첨부는 브라우저에서 `blogs-images` 버킷에 직접 업로드한다 (20MB 제한, 허용 MIME: jpeg/png/webp/gif/avif/markdown/zip).

## Claude Code 워크플로우

- 사용자가 "커밋/commit/푸시/push"를 언급하면 **`code-reviewer`를 먼저 실행**하고 APPROVED일 때만 `git-commit-pusher`를 실행한다. BLOCKED면 지적 사항부터 수정한다.
- 블로그 글 작성 요청: `blog-writer` → `blog-editorial-formatter`로 **미발행 초안**까지 저장. 발행 금지. CMS category만 사용자에게 확인.
- 커밋 메시지: 이모지 + 컨벤셔널 한국어 (`✨ feat:`, `📝 docs:`, `🗃️ db:`, `💄 style:`).
- 특별한 사유가 없으면 브랜치를 만들지 않고 `main`에서 작업·커밋한다. `master|dev|prod` 직접 push는 pre-push 훅이 막는다.
- 비직관적 동작을 "버그"로 고치기 전에 `.claude/memory/MEMORY.md`(로컬 전용, 있을 때만)의 정책 결정을 확인한다 (예: 쿠폰 주문당 1장, 승인된 상품 수정은 재검수 없음).

## AI 의사결정

| 상황 | 결정 |
|---|---|
| SQL/스키마 변경 필요 | `supabase-db-architect`에 위임 |
| 관리자 UI 일관성/반응형 점검 | `nextjs-style-auditor` |
| 쿼리를 어디에 둘지 모호 | `queries/<도메인>.ts`. 관리자 쓰기/읽기는 `.admin.ts`, 서버 공개 읽기는 `.server.ts` |
| 공개 vs 관리자 클라이언트 모호 | 공개 데이터 = `server.ts`, 그 외 = `admin.ts` + `requireAdminPage()` |
| 새 파일 3개 이상 필요 | 결정 사다리 재검토 후 진행 |

## 금지 사항

- ❌ npm 사용
- ❌ `.env*` 읽기/쓰기 (키 목록은 `.env.example` 참고)
- ❌ `requireAdminPage()` 없는 `(admin)` 서버 액션
- ❌ 컴포넌트/page에서 직접 Supabase 쿼리
- ❌ 컬럼 변경 시 `select_columns`·OpenAPI 스키마 미동기화
- ❌ `README.md`의 구조 설명을 근거로 경로 추정 (일부 오래됨, 예: `middleware.ts`는 `src/middleware.ts`)
- ❌ 블로그 글 자동 발행
