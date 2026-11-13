'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { setPushOptedOut, subscribeAndSave } from '@/libs/push-client';

const ONBOARDED_KEY = 'push-onboarded';

function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // 저장소가 막힌 환경에서는 다음 실행에 팝업이 다시 뜰 수 있다.
  }
}

function alreadyOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** 푸시를 지원하는 기기에서 처음 열었을 때 새 견적 알림 사용 여부를 한 번 묻는다. */
export default function PushOnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [wantPush, setWantPush] = useState(true);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return;
    }
    if (alreadyOnboarded()) return;
    // 이미 허용/거부된 기기는 묻지 않는다. 허용된 기기는 설정 카드가 자동 구독한다.
    if (Notification.permission !== 'default') return;
    setOpen(true);
  }, []);

  const onConfirm = async () => {
    setIsPending(true);
    try {
      if (!wantPush) {
        setPushOptedOut(true);
        return;
      }
      // 클릭 핸들러 안에서 첫 await로 호출해야 iOS가 권한 요청을 허용한다.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('알림 권한이 허용되지 않았어요.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      await subscribeAndSave(reg);
      setPushOptedOut(false);
      toast.success('이 기기로 새 견적 알림을 받아요.');
    } catch (error) {
      console.error('[push] 첫 실행 알림 설정 실패', error);
      toast.error('알림 설정에 실패했어요. 설정 페이지에서 다시 켤 수 있어요.');
    } finally {
      markOnboarded();
      setIsPending(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        // 열릴 때 스위치에 자동 포커스가 가 파란 포커스 링이 보이는 걸 막는다.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>새 견적 알림을 받을까요?</DialogTitle>
          <DialogDescription>
            새 견적이 들어오면 이 기기로 알려드려요. 나중에 설정에서 언제든 바꿀
            수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-4">
          <span className="text-sm font-medium text-gray-900">푸시 알림</span>
          <Switch
            checked={wantPush}
            onCheckedChange={setWantPush}
            disabled={isPending}
            ariaLabel="새 견적 푸시 알림"
            label={wantPush ? '켜짐' : '꺼짐'}
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            확인
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
