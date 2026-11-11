'use client';

import { useEffect } from 'react';
import { markQuoteViewedAction } from '../actions';

/** 상세 화면이 브라우저에 열렸을 때 읽음 처리한다(서버 렌더/프리페치로는 처리하지 않음). */
export default function MarkQuoteViewed({
  id,
  viewed,
}: {
  id: string;
  viewed: boolean;
}) {
  useEffect(() => {
    if (viewed) return;
    markQuoteViewedAction(id).catch((error) =>
      console.error('[quotes] 읽음 처리 실패', error),
    );
  }, [id, viewed]);

  return null;
}
