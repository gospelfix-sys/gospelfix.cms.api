interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

/** 구글 인가 코드를 구글 access_token으로 교환한다. */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`구글 토큰 교환 실패 (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as GoogleTokenResponse;
  return data.access_token;
}

/** 구글 access_token으로 사용자 프로필(이메일/이름/프로필 이미지)을 조회한다. */
export async function fetchGoogleProfile(
  googleAccessToken: string,
): Promise<GoogleProfile> {
  const response = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    { headers: { Authorization: `Bearer ${googleAccessToken}` } },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`구글 프로필 조회 실패 (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as GoogleUserInfoResponse;
  return {
    googleId: data.sub,
    email: data.email ?? null,
    emailVerified: data.email_verified === true,
    name: data.name ?? null,
    avatarUrl: data.picture ?? null,
  };
}
