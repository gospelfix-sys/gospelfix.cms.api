# gospelfix.cms.api
gospelfix.cms.api

## service.supabase.v2

Next.js 14 + Supabase 기반 관리자 앱.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 전역 상태 | Recoil |
| 데이터 패칭 | @tanstack/react-query |
| HTTP 클라이언트 | Axios |
| UI 컴포넌트 | shadcn/ui |
| 폼 관리 | react-hook-form + Zod |
| 인증 | @supabase/ssr |
| 토스트 알림 | Sonner |
| 개발 포트 | 3001 |

---

## 프로젝트 구조

```
gospelfix.cms.api/
├── docs/                      # PRD, ROADMAP
├── middleware.ts              # 라우트 보호 (Supabase 세션 갱신)
├── next.config.mjs
├── package.json
├── src/
│   ├── app/
│   │   ├── auth/callback/     # OAuth 콜백
│   │   ├── sign/in/           # 로그인 (Google OAuth 전용)
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthProvider/  # 인증 상태 초기화 (onAuthStateChange)
│   │   ├── providers/
│   │   │   └── RecoilProvider.tsx
│   │   └── ui/                # shadcn/ui 컴포넌트
│   ├── hooks/
│   │   ├── useAuth.ts         # 인증 상태 + signOut
│   │   └── useUser.ts
│   ├── libs/
│   │   └── supabase/
│   │       ├── client.ts      # 클라이언트 컴포넌트용
│   │       ├── server.ts      # 서버 컴포넌트용
│   │       └── middleware.ts  # updateSession() 헬퍼
│   └── store/
│       ├── atoms/
│       │   ├── authAtom.ts    # session, user, loading
│       │   ├── userAtom.ts    # profiles 테이블 데이터
│       │   └── uiAtom.ts
│       └── selectors/
│           └── authSelector.ts  # isAuthenticated, isAdmin
└── vercel.json
```

---

## 환경변수 설정

프로젝트 루트에 `.env.local`을 생성합니다. (`.env.example` 참고)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...   # 서버 전용, 절대 클라이언트 노출 금지

# OAuth
# GOOGLE_OAUTH_*는 앱 코드가 읽지 않는다 — 관리자 로그인용 값은 Supabase 대시보드
# (Authentication → Providers → Google)에만 입력한다.
GOOGLE_OAUTH_ID=
GOOGLE_OAUTH_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
```

Supabase 프로젝트 대시보드 → **Settings → API Keys** 에서 값을 확인할 수 있습니다.

---

## 설치 및 실행

```bash
# 의존성 설치
yarn install

# 개발 서버 (포트 3001)
yarn dev

# 프로덕션 빌드
yarn build
yarn start

# 린트 / 포맷
yarn lint
yarn pretty
```

---

## Supabase 스키마 설정

Supabase 스키마는 **대시보드 SQL Editor에서 직접 실행**합니다 (로컬 CLI 마이그레이션 미사용).

### profiles 테이블

```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 회원가입 시 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### ⚠️ RLS (Row Level Security) 필수 활성화

`profiles` 테이블 생성 후 반드시 RLS를 활성화해야 합니다. **RLS 없이는 `anon` 키를 가진 모든 클라이언트가 전체 프로필을 조회·수정할 수 있으며, 일반 사용자가 본인의 `role`을 직접 변경할 수 있습니다.**

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필만 조회 가능
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 본인 프로필 수정 가능 (role 컬럼은 변경 불가)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
```

---

## 인증 흐름

- `/sign/in` — 공개. **Google 로그인 버튼만** 있다 (이메일/비밀번호 로그인·가입은 제거됨)
- `/auth/callback` — OAuth 콜백. 코드를 세션으로 교환한 뒤 `profiles.role='admin'`인지 확인하고, 아니면 세션을 지우고 `/sign/in?error=not_admin`으로 보낸다
- 그 외 모든 경로 — 보호 (비인증 시 `/sign/in` 리다이렉트)
- 로그인 상태에서 `/sign/in` 접근 시 `/users`로 리다이렉트

### 관리자 추가 절차

구글 로그인은 아무 계정이나 시도할 수 있고, 첫 로그인 시 `profiles`에 `role='user'`로 생성된다(거부 메시지가 뜨는 것이 정상). 관리자는 `/users`에서 해당 계정을 `admin`으로 승격한다. **최초 관리자**는 `/users`에 들어갈 수 없으므로 DB에서 직접 `profiles.role='admin'`으로 지정한다.

### 구글 로그인 설정 (코드 밖)

1. Google Cloud Console → OAuth 클라이언트(웹) → 승인된 리디렉션 URI에 `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google 활성화, Client ID/Secret 입력
3. Supabase → Authentication → URL Configuration → Redirect URLs에 `http://localhost:3001/auth/callback`와 운영 도메인 `/auth/callback` 추가

`middleware.ts` → `src/libs/supabase/middleware.ts`의 `updateSession()`이 모든 요청에서 세션을 갱신하고 라우트 접근을 결정합니다.

`AuthProvider`(`src/components/auth/AuthProvider/index.tsx`)는 클라이언트에서 `onAuthStateChange`를 구독하여 Recoil atoms(`sessionAtom`, `authUserAtom`, `userProfileAtom`)를 동기화합니다.
