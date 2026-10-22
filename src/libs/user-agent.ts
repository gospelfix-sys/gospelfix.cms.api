// 관리자 화면에서 quote_submissions.user_agent / referer 원본 문자열을
// 사람이 읽기 쉬운 형태로 바꾸기 위한 경량 파서. 케이스가 한정적이라
// ua-parser-js 같은 별도 의존성 없이 정규식으로 처리한다.

export interface ParsedUserAgent {
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) return { browser: '알 수 없음', os: '알 수 없음' };

  let browser = '알 수 없음';
  if (/Edg\//.test(userAgent)) browser = 'Edge';
  else if (/OPR\//.test(userAgent)) browser = 'Opera';
  else if (/SamsungBrowser/.test(userAgent)) browser = '삼성 인터넷';
  else if (/CriOS/.test(userAgent)) browser = 'Chrome (iOS)';
  else if (/FxiOS/.test(userAgent)) browser = 'Firefox (iOS)';
  else if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent))
    browser = 'Chrome';
  else if (/Firefox\//.test(userAgent)) browser = 'Firefox';
  else if (/Version\/.+Safari\//.test(userAgent)) browser = 'Safari';
  else if (/MSIE|Trident/.test(userAgent)) browser = 'Internet Explorer';

  let os = '알 수 없음';
  if (/iPhone|iPad|iPod/.test(userAgent)) os = 'iOS';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (/Mac OS X/.test(userAgent)) os = 'macOS';
  else if (/Windows/.test(userAgent)) os = 'Windows';
  else if (/Linux/.test(userAgent)) os = 'Linux';

  return { browser, os };
}

export function formatTrafficSource(
  referer: string | null,
  utmParams: Record<string, string> | null,
): string {
  if (utmParams && utmParams.source) {
    return utmParams.medium
      ? `${utmParams.source} (${utmParams.medium})`
      : utmParams.source;
  }
  if (!referer) return '직접 방문';
  try {
    return new URL(referer).hostname;
  } catch {
    return referer;
  }
}
