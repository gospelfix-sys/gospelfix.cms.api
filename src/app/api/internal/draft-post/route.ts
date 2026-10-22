import { NextRequest, NextResponse } from 'next/server';
import {
  createPost,
  getPostBySlugAdmin,
  searchPostsByTitleAdmin,
} from '@/libs/supabase/queries/posts.admin';
import {
  checkInternalAgentAuth,
  sanitizeContent,
  VALID_CATEGORIES,
} from '@/libs/internal-agent';
import type { PostFormInput } from '@/types/post';

export const runtime = 'nodejs';

/**
 * GET /api/internal/draft-post?slug=xxx | ?title=xxx
 * 서브에이전트가 PATCH를 호출하기 전에 게시물의 id를 알아내기 위한 조회 엔드포인트.
 * slug는 정확히 일치하는 1건, title은 부분 일치하는 최대 10건을 반환한다.
 */
export async function GET(request: NextRequest) {
  const authError = checkInternalAgentAuth(request);
  if (authError) return authError;

  const slug = request.nextUrl.searchParams.get('slug');
  const title = request.nextUrl.searchParams.get('title');

  if (!slug && !title) {
    return NextResponse.json(
      { error: 'slug 또는 title 쿼리 파라미터가 필요합니다.' },
      { status: 400 },
    );
  }

  try {
    if (slug) {
      const post = await getPostBySlugAdmin(slug);
      if (!post)
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
      return NextResponse.json({
        results: [
          {
            id: post.id,
            title: post.title,
            slug: post.slug,
            status: post.status,
            content: post.content,
          },
        ],
      });
    }

    const posts = await searchPostsByTitleAdmin(title!);
    return NextResponse.json({
      results: posts.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
      })),
    });
  } catch (error) {
    console.error('[GET /api/internal/draft-post] unexpected error:', error);
    return NextResponse.json(
      { error: '게시물 조회에 실패했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/internal/draft-post
 * 로컬 개발 서버 전용 내부 엔드포인트. 서브에이전트(blog-editorial-formatter 등)가
 * 브라우저 로그인 세션 없이 미발행(draft) 블로그 글을 생성할 수 있도록 한다.
 */
export async function POST(request: NextRequest) {
  const authError = checkInternalAgentAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { title, slug, content, category, cover_image_url } = body ?? {};

    if (!title || !slug || !content || !category) {
      return NextResponse.json(
        { error: 'title, slug, content, category는 필수입니다.' },
        { status: 400 },
      );
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          error: `category는 ${VALID_CATEGORIES.join(', ')} 중 하나여야 합니다.`,
        },
        { status: 400 },
      );
    }

    const sanitizedContent = sanitizeContent(content);
    if (!sanitizedContent) {
      return NextResponse.json(
        { error: '유효한 본문 콘텐츠가 없습니다.' },
        { status: 400 },
      );
    }

    const input: PostFormInput = {
      title,
      slug,
      content: sanitizedContent,
      cover_image_url: cover_image_url || '',
      portfolio_images: [],
      category,
      status: 'draft',
    };

    const post = await createPost(input, 'draft');
    return NextResponse.json({ id: post.id, slug: post.slug }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/internal/draft-post] unexpected error:', error);
    return NextResponse.json(
      { error: '초안 저장에 실패했습니다.' },
      { status: 500 },
    );
  }
}
