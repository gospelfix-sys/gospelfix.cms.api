# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

Next.js 14 (App Router) + Supabase 기반 **관리자 CMS이자 서버-투-서버 REST API 백엔드**. 자매 저장소(`gospelfix` 본 서비스, `/mall` 모다 마켓플레이스)가 별도 서버에서 `/api/v1/*`를 호출해 CRUD·인증·주문을 처리한다. 따라서 `/api/v1/*` 변경은 "외부 클라이언트에 공개하는 API 계약" 변경으로 취급한다. 문서·주석·커밋 메시지는 한국어.

## 명령어

**yarn만 사용 (npm 금지).** Node >= 22.

```bash
yarn dev      # http://localhost:3001
yarn build
yarn lint     # next lint
yarn pretty   # prettier --write 'src/**/*.{ts,js,tsx,jsx}'
yarn shadcn add <component>   # 추가 후 import 경로를 '@/libs/utils'로 확인 ('@/lib/utils' 아님)
```

테스트 러너는 없다(`package.json`에 `test` 스크립트 없음). `.husky/pre-commit`은 `lint-staged`를 호출하고, `pre-push`는 `master|dev|prod` 직접 push를 막는다. `.env*`는 `.claude/settings.json`의 `permissions.deny`로 읽기/쓰기가 차단된다 — 키 목록은 `.env.example` 참고.

## 아키텍처

### 라우팅과 인증 (4개 영역)

- `src/app/(admin)/*` — 관리자 화면(users, orders, quotes, blog, products, portfolio, category, product-categories, product-sub-categories, referral-banners, profile, settings). 페이지는 Server Component, 폼/테이블은 Client Component로 분리.
- `src/app/api/v1/*` — **공개 REST API** (server-to-server). `X-API-Key`(= `INTERNAL_API_KEY`) 검증이 보안 레이어이며 `validateApiKey()`(`src/libs/openapi/auth.ts`)를 라우트 첫 줄에서 호출. 사용자 호출은 추가로 `Authorization: Bearer` (같은 Supabase 프로젝트라 토큰이 그대로 유효).
- `src/app/api/internal/draft-post` — 블로그 서브에이전트가 초안을 저장하는 내부 엔드포인트 (`checkInternalAgentAuth`, 로컬 dev 전용 용도, 항상 미발행).
- `src/app/api-docs` + `/api/openapi.json` — 런타임에 생성되는 Swagger 문서.

`src/middleware.ts`가 라우팅의 단일 관문이다: `/api/v1/*`·`/api/openapi.json`은 세션 조회 없이 CORS 헤더만 주입해 통과, 나머지는 `updateSession()`(`src/libs/supabase/middleware.ts`)으로 세션 갱신 후 미인증이면 `/sign/in`으로 리다이렉트. **새 관리자 경로를 추가하면 `ADMIN_PATHS`와 `config.matcher` 두 곳 모두 수정해야 한다.** 미들웨어는 로그인 여부만 보고, `admin` 역할 검증은 `requireAdminPage()`/`requireAdminApi()`(`queries/auth.ts`)가 `profiles.role`로 한다.

### Supabase 클라이언트 4종 (`src/libs/supabase/`)

| 파일 | 키 | 용도 |
|---|---|---|
| `client.ts` | anon | `'use client'` 컴포넌트 |
| `server.ts` | anon | Server Component / 공개 읽기 (RLS 적용) |
| `admin.ts` | service_role | 관리자 쓰기·admin 패널 읽기 (RLS 우회) |
| `middleware.ts` | anon | `updateSession` 전용 |

`createAdminClient()`를 공개 API 읽기에 쓰면 RLS가 무력화된다 — 공개 읽기는 `server.ts`의 `createClient()`.

### 데이터 접근 규칙 (절대 규칙)

- 모든 Supabase 쿼리(`select/insert/update/delete`)는 `src/libs/supabase/queries/<도메인>[.admin|.server].ts`에만 작성. 컴포넌트·page에서 `createClient()`로 직접 쿼리 금지.
- `'use server'` 파일(`actions.ts`)에는 **뮤테이션만**. 읽기는 Server Component에서 queries 함수를 직접 import.
- **`(admin)/**/actions.ts`의 모든 export 액션은 첫 줄이 `await requireAdminPage();`** (예외: `sign/in/actions.ts`). layout/middleware는 Server Action POST를 막지 못하고 `*.admin.ts`는 service_role이라, 빠뜨리면 비로그인 사용자가 데이터를 지울 수 있다. 액션 추가 시 `grep -c '^export async function'`과 `grep -c 'await requireAdminPage'` 개수를 맞춰볼 것.
- cms.api 내부 페이지가 `/api/v1/*`를 클라이언트에서 재사용하지 않는다(`INTERNAL_API_KEY` 노출). `requireAdminPage()` + Server Action + queries 공용 함수로 별도 구현.
- sort_order 일괄 변경은 `Promise.all` + N개 UPDATE 대신 `upsert({ onConflict: 'id' })` 단일 쿼리. Supabase JS 반복 insert는 트랜잭션이 아니므로 배치 insert는 실패 시 직접 롤백 쿼리 필요.

### 제네릭 공개 API: `content_api_configs`

`GET /api/v1/[resource]` / `[resource]/[identifier]`는 테이블별 라우트가 아니라 DB의 `content_api_configs` 행(`resource_slug → table_name`, `select_columns`, 정렬/필터, `is_enabled`)을 읽어 동작한다 (`queries/content-api-configs.ts`). 결과:

- 테이블을 **rename**하면 `content_api_configs.table_name`도 UPDATE해야 한다(문자열이라 자동 추종 안 됨). 트리거 함수 본문에 하드코딩된 옛 테이블명도 grep해서 `CREATE OR REPLACE` 해야 한다.
- 공개 테이블의 컬럼을 **추가/삭제/이름변경**하면 같은 작업 단위로 `select_columns`와 `src/libs/openapi/schemas/*.schema.ts`를 동기화한다. 안 하면 응답에 누락되거나 PostgREST 에러.
- 신규 테이블은 라인업 접두사 필수: `gospelfix_`(본 서비스: news/portfolios/quote_submissions) 또는 `moda_`(마켓플레이스: products/orders/cart_items/coupons/product_likes/reviews). 공용 인프라(`profiles`, `auth_api_configs`, `content_api_configs`, `phone_verifications`, `referral_banners`)는 접두사 없이 두고 rename 금지.

### 신규 REST 엔드포인트 추가 시 한 세트로 처리

1. `src/app/api/v1/**/route.ts` — 첫 줄 `validateApiKey()`, 커스텀 로직이면 `requireAuthApiEnabled(slug)`도 호출.
2. `/settings`의 On/Off 토글 — 테이블 CRUD 리소스는 `content_api_configs` 행 추가만으로 자동 노출. 커스텀 엔드포인트(auth 등)는 `auth_api_configs` + `AuthApiConfigCard` 패턴 재사용(필수 플로우는 fail-open, 선택 콘텐츠 API는 fail-closed).
3. `/api-docs` 노출 — `libs/openapi/schemas/*.schema.ts`에 Zod 스키마 + `registerXxxPaths`를 쓰고 `dynamic-spec.ts`의 `buildDynamicOpenApiSpec()`에 연결(테이블 리소스는 `TYPED_SLUGS` 등록). `api-docs/page.tsx`는 직접 수정하지 않는다.

### 클라이언트 상태

Recoil atoms(`src/store/`)는 `AuthProvider`의 `onAuthStateChange`가 동기화한다. 컴포넌트는 atom/selector를 직접 구독하지 말고 `useAuth()`/`useUser()` 훅을 쓴다. 데이터 패칭은 Server Component 우선, 클라이언트는 `@tanstack/react-query`.

### 블로그 에디터

`RichEditor`(TipTap)가 지원하는 서식은 h1~h3, 문단, 목록, 인용구, 구분선, 링크뿐. 저장 시 `sanitizeContent()`(`libs/internal-agent.ts`)의 sanitize-html 허용 목록과 일치해야 하므로 에디터 툴바를 늘리면 허용 태그도 함께 수정. 게시글 카테고리는 고정 4종(신규 템플릿/이벤트/AI 활용/UX/UI 디자인, DB CHECK 제약과 동일).

## DB 스키마 작업 방식

`supabase/migrations/`의 001~003만 과거 기록이며 **신규 마이그레이션 파일은 작성하지 않는다.** DDL/DML은 `supabase-db-architect` 서브에이전트가 Supabase MCP(`apply_migration` / `execute_sql`)로 직접 실행하고, 결과 확인 후 쿼리 레이어 `.from()` 호출을 동기화한다. SQL 작업은 이 에이전트에 위임한다. `profiles` + `handle_new_user()` 트리거 + RLS는 README.md의 SQL 참고(최초 가입자의 `role`은 `user`이므로 관리자는 수동으로 `admin` 지정).

## 개발 철학 (`.claude/GOSPELFIX.md`)

코드를 쓰기 전 NEED → EXIST → NEXT(내장 기능) → SUPA(Supabase가 처리?) → PKG → PATTERN → INLINE → SHARED → BUILD 순서로 검토하고, 해결되는 첫 단계에서 멈춘다. `any` 금지, 에러 삼키기 금지, 추상화는 세 번째 반복에서만. `yarn add` 직전·새 파일 3개 이상 직전에 사다리로 돌아간다. 스킬 `gfix-craft/review/audit/debt/gain`과 `/gfix-help` 참고.

## Claude Code 워크플로우

- 사용자가 "커밋/commit/푸시/push"를 언급하면 **`code-reviewer` 에이전트를 먼저** 실행하고 APPROVED일 때만 `git-commit-pusher`를 실행한다. BLOCKED면 지적 사항부터 수정.
- 블로그 글 작성 요청은 `blog-writer` → `blog-editorial-formatter` 체인으로 관리자에 **미발행 초안**까지 저장하며 발행은 하지 않는다(CMS category만 사용자에게 확인).
- 커밋 메시지는 이모지 + 컨벤셔널 형식의 한국어 (`📝 docs: ...`, `✨ feat: ...`, `🗃️ db: ...`).
- `.claude/memory/`, `.claude/plans/`, `.claude/agent-memory/`, `/docs/`(PRD·로드맵), `.serena/`는 gitignore된 **로컬 전용**이라 다른 PC에는 없다. 로컬에 있다면 `.claude/memory/MEMORY.md`에 정책 결정 히스토리(쿠폰 주문당 1장 의도된 정책, 승인된 상품 수정은 재검수 없음 등)가 정리되어 있으니 비직관적인 동작을 "버그"로 고치기 전에 확인한다.
- README.md의 프로젝트 구조 일부는 오래됨(예: `middleware.ts`는 루트가 아니라 `src/middleware.ts`).
