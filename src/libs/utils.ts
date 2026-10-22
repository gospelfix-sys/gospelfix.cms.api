import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 제목 → URL 슬러그 변환.
 *
 * ProductForm/PostForm이 각자 갖고 있던 구현을 합친 것으로,
 * 라틴 확장(À-ɏ)까지 허용하는 더 포용적인 PostForm 버전을 정본으로 삼는다.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\wÀ-ɏ가-힣-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
