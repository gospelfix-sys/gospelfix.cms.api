import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 고유한 숫자 슬러그 생성.
 *
 * 제목에서 파생하면 한글이 URL에 섞이므로, 밀리초 타임스탬프를 슬러그로 쓴다.
 */
export function generateNumericSlug(): string {
  return String(Date.now());
}
