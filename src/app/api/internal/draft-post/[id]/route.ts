import { NextRequest, NextResponse } from 'next/server';
import {
  getPostByIdAdmin,
  updatePost,
} from '@/libs/supabase/queries/posts.admin';
import {
  checkInternalAgentAuth,
  sanitizeContent,
  VALID_CATEGORIES,
} from '@/libs/internal-agent';
import type { PostFormInput } from '@/types/post';

export const runtime = 'nodejs';

/**
 * PATCH /api/internal/draft-post/[id]
 * 로컬 개발 서버 전용 내부 엔드포인트. 서브에이전트가 이미 만들어둔 게시물의
 * title/slug/content/category/cover_image_url을 부분 수정할 수 있도록 한다.
 * is_published 상태는 이 엔드포인트로 바꿀 수 없다 — 기존 상태를 그대로 유지한다.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = checkInternalAgentAuth(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const existing = await getPostByIdAdmin(id);
    if (!existing) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, slug, content, category, cover_image_url } = body ?? {};

    if (title !== undefined && !title) {
      return NextResponse.json(
        { error: 'title은 빈 값일 수 없습니다.' },
        { status: 400 },
      );
    }
    if (slug !== undefined && !slug) {
      return NextResponse.json(
        { error: 'slug는 빈 값일 수 없습니다.' },
        { status: 400 },
      );
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `category는 ${VALID_CATEGORIES.join(', ')} 중 하나여야 합니다.`,
        },
        { status: 400 },
      );
    }

    let sanitizedContent = existing.content ?? '';
    if (content !== undefined) {
      sanitizedContent = sanitizeContent(content);
      if (!sanitizedContent) {
        return NextResponse.json(
          { error: '유효한 본문 콘텐츠가 없습니다.' },
          { status: 400 },
        );
      }
    }

    const input: PostFormInput = {
      title: title ?? existing.title,
      slug: slug ?? existing.slug,
      content: sanitizedContent,
      cover_image_url: cover_image_url ?? existing.cover_image_url ?? '',
      portfolio_images: existing.portfolio_images,
      category: (category ?? existing.category) as PostFormInput['category'],
      status: existing.status,
    };

    const post = await updatePost(id, input, existing.status);
    return NextResponse.json({
      id: post.id,
      title: post.title,
      slug: post.slug,
    });
  } catch (error) {
    console.error(
      '[PATCH /api/internal/draft-post/[id]] unexpected error:',
      error,
    );
    return NextResponse.json(
      { error: '게시물 수정에 실패했습니다.' },
      { status: 500 },
    );
  }
}
