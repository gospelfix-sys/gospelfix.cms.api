import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import '@/libs/openapi/registry';

export const SignupRequestSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(6).openapi({ example: 'password123' }),
    fullName: z.string().optional().openapi({ example: '홍길동' }),
    emailVerificationToken: z.string().openapi({
      example: '550e8400-e29b-41d4-a716-446655440000',
      description: '/api/v1/auth/email/verify-code로 발급받은 1회용 토큰.',
    }),
    referralCode: z.string().optional().openapi({
      example: 'AB23CD45',
      description:
        '추천인의 8자리 추천인 코드(선택). 유효하면 추천인+피추천인 모두에게 50% 할인 쿠폰이 지급된다.',
    }),
  })
  .openapi('SignupRequest');

export const SendPhoneCodeRequestSchema = z
  .object({
    phone: z.string().openapi({ example: '01012345678' }),
  })
  .openapi('SendPhoneCodeRequest');

export const SendPhoneCodeResponseSchema = z
  .object({
    success: z.literal(true),
    expiresIn: z.number().int().openapi({ example: 180 }),
  })
  .openapi('SendPhoneCodeResponse');

export const VerifyPhoneCodeRequestSchema = z
  .object({
    phone: z.string().openapi({ example: '01012345678' }),
    code: z.string().openapi({ example: '123456' }),
  })
  .openapi('VerifyPhoneCodeRequest');

export const VerifyPhoneCodeResponseSchema = z
  .object({
    success: z.literal(true),
    phoneVerificationToken: z
      .string()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  })
  .openapi('VerifyPhoneCodeResponse');

export const SendEmailCodeRequestSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
  })
  .openapi('SendEmailCodeRequest');

export const VerifyEmailCodeRequestSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    code: z.string().openapi({ example: '123456' }),
  })
  .openapi('VerifyEmailCodeRequest');

export const VerifyEmailCodeResponseSchema = z
  .object({
    success: z.literal(true),
    emailVerificationToken: z
      .string()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
  })
  .openapi('VerifyEmailCodeResponse');

export const LoginRequestSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().openapi({ example: 'password123' }),
  })
  .openapi('LoginRequest');

export const KakaoLoginRequestSchema = z
  .object({
    code: z.string().openapi({
      example: '4/0AY0e-g7...',
      description:
        '카카오 인가 코드. main이 카카오 인가 URL로 리다이렉트를 받은 뒤 state 검증까지 마친 ' +
        'code만 전달해야 한다 — state 자체는 main이 검증하고 cms.api는 검증하지 않는다.',
    }),
    redirectUri: z.string().openapi({
      example: 'https://example.com/auth/kakao/callback',
      description:
        '카카오 인가 요청 시 사용한 redirect_uri와 정확히 일치해야 한다.',
    }),
    referralCode: z.string().optional().openapi({
      example: 'AB23CD45',
      description:
        '추천인의 8자리 추천인 코드(선택). 신규 가입자에게만 적용된다.',
    }),
  })
  .openapi('KakaoLoginRequest');

export const GoogleLoginRequestSchema = z
  .object({
    code: z.string().openapi({
      example: '4/0AY0e-g7...',
      description:
        '구글 인가 코드. main이 구글 인가 URL로 리다이렉트를 받은 뒤 state 검증까지 마친 ' +
        'code만 전달해야 한다 — state 자체는 main이 검증하고 cms.api는 검증하지 않는다.',
    }),
    redirectUri: z.string().openapi({
      example: 'https://example.com/api/auth/google/callback',
      description:
        '구글 인가 요청 시 사용한 redirect_uri와 정확히 일치해야 한다.',
    }),
    referralCode: z.string().optional().openapi({
      example: 'AB23CD45',
      description:
        '추천인의 8자리 추천인 코드(선택). 신규 가입자에게만 적용된다.',
    }),
  })
  .openapi('GoogleLoginRequest');

export const RefreshRequestSchema = z
  .object({
    refreshToken: z.string().openapi({ example: 'v1.MRefreshTokenExample...' }),
  })
  .openapi('RefreshRequest');

export const SessionSchema = z
  .object({
    access_token: z
      .string()
      .openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    refresh_token: z
      .string()
      .openapi({ example: 'v1.MRefreshTokenExample...' }),
    expires_in: z.number().int().openapi({ example: 3600 }),
    expires_at: z.number().int().optional().openapi({ example: 1753257600 }),
  })
  .openapi('Session');

export const UserResponseSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.string().optional().openapi({ example: 'user@example.com' }),
  })
  .passthrough()
  .openapi('AuthUser');

export const SignupResponseSchema = z
  .union([
    z
      .object({
        status: z.literal('confirmation_required'),
        user: UserResponseSchema.nullable(),
      })
      .openapi('SignupConfirmationRequiredResponse'),
    z
      .object({
        user: UserResponseSchema.nullable(),
        session: SessionSchema,
      })
      .openapi('SignupSessionResponse'),
  ])
  .openapi('SignupResponse');

export const LoginResponseSchema = z
  .object({
    user: UserResponseSchema.nullable(),
    session: SessionSchema,
  })
  .openapi('LoginResponse');

export const KakaoLoginResponseSchema = z
  .object({
    user: UserResponseSchema.nullable(),
    session: SessionSchema,
    isNewUser: z.boolean().openapi({
      example: true,
      description:
        '이번 요청으로 신규 가입 처리되었는지 여부. true면 가입 쿠폰/추천인 코드가 함께 발급됨.',
    }),
  })
  .openapi('KakaoLoginResponse');

export const GoogleLoginResponseSchema = z
  .object({
    user: UserResponseSchema.nullable(),
    session: SessionSchema,
    isNewUser: z.boolean().openapi({
      example: true,
      description:
        '이번 요청으로 신규 가입 처리되었는지 여부. true면 가입 쿠폰/추천인 코드가 함께 발급됨.',
    }),
  })
  .openapi('GoogleLoginResponse');

export const RefreshResponseSchema = z
  .object({
    session: SessionSchema,
  })
  .openapi('RefreshResponse');

export const LogoutResponseSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
  })
  .openapi('LogoutResponse');

export const MeResponseSchema = z
  .object({
    user: UserResponseSchema,
    profile: z
      .object({
        id: z
          .string()
          .uuid()
          .openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
        email: z.string().openapi({ example: 'user@example.com' }),
        full_name: z.string().nullable().openapi({ example: '홍길동' }),
        avatar_url: z
          .string()
          .nullable()
          .openapi({ example: 'https://example.com/avatar.jpg' }),
        role: z.enum(['user', 'admin', 'seller']).openapi({ example: 'user' }),
        created_at: z
          .string()
          .datetime()
          .openapi({ example: '2026-07-01T00:00:00.000Z' }),
        referral_code: z.string().nullable().openapi({
          example: 'AB23CD45',
          description:
            '이 사용자가 공유할 수 있는 8자리 추천인 코드. 극히 드물게 발급 실패 시 null',
        }),
        seller_requested_at: z.string().datetime().nullable().openapi({
          example: null,
          description:
            '판매자 전환 신청 시각. NULL이면 신청하지 않음 — 관리자가 /users에서 수동으로 승인해야 role이 seller로 바뀐다(자동 승인 없음).',
        }),
      })
      .openapi('MeProfile'),
  })
  .openapi('MeResponse');

const ErrorResponseSchema = z.object({ error: z.string() });

export const SuccessResponseSchema = z
  .object({ success: z.literal(true) })
  .openapi('SuccessResponse');

export const UpdateMeRequestSchema = z
  .object({
    fullName: z.string().optional().openapi({ example: '홍길동' }),
    avatarUrl: z
      .string()
      .url()
      .optional()
      .openapi({ example: 'https://example.com/avatar.jpg' }),
  })
  .openapi('UpdateMeRequest');

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().openapi({ example: 'oldPassword123' }),
    newPassword: z.string().min(6).openapi({ example: 'newPassword456' }),
  })
  .openapi('ChangePasswordRequest');

export const DeleteMeRequestSchema = z
  .object({
    currentPassword: z.string().openapi({ example: 'oldPassword123' }),
  })
  .openapi('DeleteMeRequest');

export const AvatarUploadResponseSchema = z
  .object({
    avatarUrl: z
      .string()
      .url()
      .openapi({ example: 'https://example.com/avatars/user.jpg' }),
  })
  .openapi('AvatarUploadResponse');

export function registerAuthPaths(reg: OpenAPIRegistry) {
  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/signup',
    summary: '회원가입',
    description:
      '이메일/비밀번호로 회원가입합니다. emailVerificationToken은 ' +
      '/api/v1/auth/email/verify-code로 사전에 발급받아야 합니다. ' +
      '이메일 확인이 켜져 있으면 confirmation_required 상태를, 꺼져 있으면 즉시 세션을 반환합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: SignupRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '회원가입 성공',
        content: { 'application/json': { schema: SignupResponseSchema } },
      },
      400: {
        description:
          '잘못된 요청, 이메일 인증 미완료/만료, 또는 Supabase 에러(이미 가입된 이메일 등)',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/phone/send-code',
    summary: '휴대폰 인증번호 발송',
    description:
      '회원가입 전 휴대폰 본인확인용 6자리 인증번호를 발송합니다(3분 유효). ' +
      '현재는 개발용 목업으로 서버 콘솔 로그에만 출력됩니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: SendPhoneCodeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '발송 성공',
        content: {
          'application/json': { schema: SendPhoneCodeResponseSchema },
        },
      },
      400: {
        description: '휴대폰 번호 형식 오류',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/phone/verify-code',
    summary: '휴대폰 인증번호 확인',
    description:
      '발송된 인증번호를 검증하고, 성공 시 회원가입에 사용할 phoneVerificationToken을 ' +
      '발급합니다(30분 이내 1회 사용 가능).',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: VerifyPhoneCodeRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '인증 성공',
        content: {
          'application/json': { schema: VerifyPhoneCodeResponseSchema },
        },
      },
      400: {
        description: '인증번호 불일치 또는 만료',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/email/send-code',
    summary: '이메일 인증번호 발송',
    description:
      '회원가입 전 이메일 본인확인용 6자리 인증번호를 메일로 발송합니다(3분 유효, ' +
      '재전송 60초 쿨다운, 시간당 5회 제한).',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: SendEmailCodeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '발송 성공',
        content: {
          'application/json': { schema: SendPhoneCodeResponseSchema },
        },
      },
      400: {
        description: '이메일 형식 오류',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      429: {
        description: '재전송 쿨다운 또는 시간당 발송 한도 초과',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/email/verify-code',
    summary: '이메일 인증번호 확인',
    description:
      '발송된 인증번호를 검증하고, 성공 시 회원가입에 사용할 emailVerificationToken을 ' +
      '발급합니다(30분 이내 1회 사용 가능).',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: VerifyEmailCodeRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '인증 성공',
        content: {
          'application/json': { schema: VerifyEmailCodeResponseSchema },
        },
      },
      400: {
        description: '인증번호 불일치 또는 만료',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: '로그인',
    description: '이메일/비밀번호로 로그인하고 세션을 발급합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: LoginRequestSchema } } },
    },
    responses: {
      200: {
        description: '로그인 성공',
        content: { 'application/json': { schema: LoginResponseSchema } },
      },
      401: {
        description: '이메일 또는 비밀번호가 올바르지 않음',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/kakao',
    summary: '카카오 로그인',
    description:
      '카카오 인가 코드를 받아 카카오 토큰/프로필을 서버에서 직접 조회하고, 해당 이메일로 ' +
      '가입된 계정이 없으면 신규 가입(가입 쿠폰/추천인 코드 발급 포함) 후, 있으면 재로그인 ' +
      '처리해 Supabase 세션을 발급합니다. 카카오 계정 이메일 제공 동의가 필수입니다. ' +
      'main이 카카오 인가 URL 생성과 state 검증을 담당하며, 이 API는 이미 검증된 code만 받습니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: KakaoLoginRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '로그인/가입 성공',
        content: { 'application/json': { schema: KakaoLoginResponseSchema } },
      },
      400: {
        description:
          'code/redirectUri 누락, 카카오 토큰 교환 실패, 또는 카카오 계정 이메일 동의 누락',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/google',
    summary: '구글 로그인',
    description:
      '구글 인가 코드를 받아 구글 토큰/프로필을 서버에서 직접 조회하고, 해당 이메일로 ' +
      '가입된 계정이 없으면 신규 가입(가입 쿠폰/추천인 코드 발급 포함) 후, 있으면 재로그인 ' +
      '처리해 Supabase 세션을 발급합니다. 구글이 이메일 소유를 확인한(email_verified) 계정만 ' +
      '허용합니다. main이 구글 인가 URL 생성과 state 검증을 담당하며, 이 API는 이미 검증된 ' +
      'code만 받습니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: GoogleLoginRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '로그인/가입 성공',
        content: { 'application/json': { schema: GoogleLoginResponseSchema } },
      },
      400: {
        description:
          'code/redirectUri 누락, 구글 토큰 교환 실패, 또는 이메일 미인증 구글 계정',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/refresh',
    summary: '세션 갱신',
    description: 'refreshToken으로 새 access_token/refresh_token을 발급합니다.',
    security: [{ ApiKeyAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: RefreshRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '세션 갱신 성공',
        content: { 'application/json': { schema: RefreshResponseSchema } },
      },
      400: {
        description: '잘못된 요청',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '유효하지 않은 refresh token',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    summary: '로그아웃',
    description:
      'Authorization: Bearer <access_token> 헤더로 사용자를 식별해 세션을 폐기합니다.',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: '로그아웃 성공',
        content: { 'application/json': { schema: LogoutResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    summary: '내 정보 조회',
    description:
      'Authorization: Bearer <access_token> 헤더로 사용자를 식별해 auth user와 profiles 정보를 반환합니다.',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: '조회 성공',
        content: { 'application/json': { schema: MeResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      404: {
        description: '프로필을 찾을 수 없음',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'patch',
    path: '/api/v1/auth/me',
    summary: '프로필 수정',
    description:
      '이름(fullName)/아바타 URL(avatarUrl)을 수정합니다. /settings에서 끌 수 있습니다.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: UpdateMeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '수정 성공',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'delete',
    path: '/api/v1/auth/me',
    summary: '회원탈퇴 (소프트 삭제)',
    description:
      '현재 비밀번호를 재검증한 뒤 Auth 계정을 사실상 영구 정지하고 profiles/auth.users의 ' +
      'PII를 마스킹합니다. 주문/리뷰 등 결제·활동 기록은 그대로 보존됩니다(하드 삭제 아님). ' +
      '/settings에서 끌 수 있습니다.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: DeleteMeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: '탈퇴 처리 성공',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      400: {
        description: 'currentPassword 누락',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패 또는 현재 비밀번호 불일치',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/password',
    summary: '비밀번호 변경',
    description:
      '현재 비밀번호를 재검증한 뒤 새 비밀번호로 변경합니다. /settings에서 끌 수 있습니다.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': { schema: ChangePasswordRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: '변경 성공',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      400: {
        description: '필수 파라미터 누락 또는 새 비밀번호 형식 오류',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패 또는 현재 비밀번호 불일치',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/avatar',
    summary: '아바타 업로드',
    description:
      '아바타 이미지 파일(jpg/png/webp, 5MB 이하)을 avatars 버킷에 업로드하고 public URL만 반환합니다. ' +
      'profiles.avatar_url 저장은 이 URL로 뒤이어 PATCH /api/v1/auth/me를 호출해야 반영됩니다. ' +
      '/settings에서 끌 수 있습니다.',
    security: [{ BearerAuth: [] }],
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.string().openapi({ format: 'binary' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: '업로드 성공',
        content: { 'application/json': { schema: AvatarUploadResponseSchema } },
      },
      400: {
        description: '파일 누락, 허용되지 않는 형식, 또는 용량 초과',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });

  reg.registerPath({
    method: 'post',
    path: '/api/v1/auth/seller-request',
    summary: '판매자 전환 신청',
    description:
      '일반 회원이 판매자로 전환하고 싶다는 의사만 표시합니다(profiles.seller_requested_at 기록). ' +
      '자동으로 role을 바꾸지 않으며, 관리자가 /users 페이지에서 이 신호를 보고 수동으로 seller로 ' +
      '전환해야 합니다. 이미 seller/admin인 계정은 400을 반환합니다. /settings에서 끌 수 있습니다.',
    security: [{ BearerAuth: [] }],
    responses: {
      200: {
        description: '신청 성공',
        content: { 'application/json': { schema: SuccessResponseSchema } },
      },
      400: {
        description: '이미 판매자이거나 신청할 수 없는 상태',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      401: {
        description: '인증 실패',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
      403: {
        description: '관리자가 /settings에서 이 API를 비활성화함',
        content: { 'application/json': { schema: ErrorResponseSchema } },
      },
    },
  });
}
