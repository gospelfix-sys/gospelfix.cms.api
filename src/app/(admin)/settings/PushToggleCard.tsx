'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  isPushOptedOut,
  setPushOptedOut,
  subscribeAndSave,
} from '@/libs/push-client';
import { unsubscribePushAction } from './actions';

export default function PushToggleCard() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEnabled(true);
          return;
        }
        // 권한이 이미 허용된 기기는 팝업 없이 기본값 켜짐으로 구독한다.
        if (Notification.permission === 'granted' && !isPushOptedOut()) {
          await subscribeAndSave(reg);
          setEnabled(true);
        }
      })
      .catch((error) => console.error('[push] 서비스워커 등록/자동 구독 실패', error));
  }, []);

  const enable = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast.error('알림 권한이 허용되지 않았어요.');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await subscribeAndSave(reg);
    setPushOptedOut(false);
    setEnabled(true);
    toast.success('이 기기로 새 견적 알림을 받아요.');
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setPushOptedOut(true);
    setEnabled(false);
    toast.success('알림을 껐어요.');
  };

  const onToggle = () =>
    startTransition(async () => {
      try {
        if (enabled) await disable();
        else await enable();
      } catch (error) {
        console.error('[push] 토글 실패', error);
        toast.error('알림 설정에 실패했어요.');
      }
    });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            새 견적 푸시 알림
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {supported
              ? '이 기기에서 새 견적이 들어오면 알림을 받아요. iPhone은 홈 화면에 추가한 앱에서만 켤 수 있어요.'
              : '이 브라우저는 푸시 알림을 지원하지 않아요. iPhone은 Safari에서 홈 화면에 추가한 뒤 앱으로 열어주세요.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={!supported || isPending}
          className="shrink-0 rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-medium text-white dark:text-gray-900 disabled:opacity-50"
        >
          {enabled ? '끄기' : '켜기'}
        </button>
      </div>
    </div>
  );
}
