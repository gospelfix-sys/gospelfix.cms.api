import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import type { PostCategory } from '@/types/post';

// 실제 운영 news 테이블의 category CHECK 제약과 동일한 고정값
export const VALID_CATEGORIES: PostCategory[] = [
  '신규 템플릿',
  '이벤트',
  'AI 활용',
  'UX/UI 디자인',
];

// RichEditor 툴바가 실제로 노출하는 서식(TipTap 기본 스키마의 부분집합)만 허용 — codeBlock/br 등은 의도적으로 제외
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1',
    'h2',
    'h3',
    'p',
    'ul',
    'ol',
    'li',
    'blockquote',
    'hr',
    'strong',
    'em',
    'u',
    's',
    'a',
  ],
  allowedAttributes: {
    // target은 허용하지 않는다 — reverse tabnabbing 방지(정상 에디터도 target을 만들지 않음)
    a: ['href', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeContent(content: string): string {
  return sanitizeHtml(content, SANITIZE_OPTIONS).trim();
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
let failedAttempts = 0;
let lockedUntil = 0;

function isLockedOut(): boolean {
  return Date.now() < lockedUntil;
}

function recordAuthFailure(): void {
  failedAttempts += 1;
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_MS;
    failedAttempts = 0;
  }
}

function recordAuthSuccess(): void {
  failedAttempts = 0;
  lockedUntil = 0;
}

// 길이 기반 조기 종료를 피하려고 고정 길이 해시로 변환한 뒤 비교한다
function safeCompare(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * 로컬 개발 서버 전용 내부 엔드포인트 공통 게이트.
 * 프로덕션에서는 무조건 404, 로컬에서도 INTERNAL_AGENT_TOKEN 헤더가 일치해야 통과한다.
 * 실패 시 응답을 그대로 반환하고, 통과 시 null을 반환한다.
 */
export function checkInternalAgentAuth(
  request: NextRequest,
): NextResponse | null {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  if (isLockedOut()) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const token = request.headers.get('x-internal-token');
  const expectedToken = process.env.INTERNAL_AGENT_TOKEN;
  if (!expectedToken || !token || !safeCompare(token, expectedToken)) {
    recordAuthFailure();
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  recordAuthSuccess();
  return null;
}
