'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const SHOW_AFTER_SCROLL_PX = 120;

/** 스크롤을 내렸을 때만 오른쪽 하단에 나타나는 "목록으로" 플로팅 버튼. */
export default function BackToListButton({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_SCROLL_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Link
      href={href}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-12 items-center gap-2 rounded-full border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 shadow-lg transition-[opacity,transform,visibility] duration-200 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none invisible translate-y-4 opacity-0'
      }`}
    >
      <ArrowLeft size={16} />
      목록으로
    </Link>
  );
}
