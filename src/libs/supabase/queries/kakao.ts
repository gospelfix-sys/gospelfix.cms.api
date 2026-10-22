interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
}

interface KakaoUserMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    thumbnail_image?: string;
  };
}

export interface KakaoProfile {
  kakaoId: string;
  email: string | null;
  nickname: string | null;
  avatarUrl: string | null;
}

/** 카카오 인가 코드를 카카오 access_token으로 교환한다. */
export async function exchangeKakaoCode(
  code: string,
  redirectUri: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_CLIENT_ID!,
    client_secret: process.env.KAKAO_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`카카오 토큰 교환 실패 (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as KakaoTokenResponse;
  return data.access_token;
}

/** 카카오 access_token으로 사용자 프로필(이메일/닉네임/프로필 이미지)을 조회한다. */
export async function fetchKakaoProfile(
  kakaoAccessToken: string,
): Promise<KakaoProfile> {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`카카오 프로필 조회 실패 (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as KakaoUserMeResponse;
  return {
    kakaoId: String(data.id),
    email: data.kakao_account?.email ?? null,
    nickname:
      data.kakao_account?.profile?.nickname ??
      data.properties?.nickname ??
      null,
    avatarUrl:
      data.kakao_account?.profile?.profile_image_url ??
      data.properties?.thumbnail_image ??
      null,
  };
}
