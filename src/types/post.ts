export type PostStatus = 'draft' | 'published';

// 실제 운영 news 테이블의 category CHECK 제약과 동일한 고정값
export type PostCategory =
  '신규 템플릿' | '이벤트' | 'AI 활용' | 'UX/UI 디자인';

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  cover_image_url: string | null;
  portfolio_images: string[];
  category: PostCategory | null;
  status: PostStatus;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface PostFormInput {
  title: string;
  slug: string;
  content: string;
  cover_image_url: string;
  portfolio_images: string[];
  category: PostCategory;
  status: PostStatus;
}
