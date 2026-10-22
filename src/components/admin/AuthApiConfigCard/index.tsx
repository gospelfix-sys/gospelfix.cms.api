'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toggleAuthApiConfigAction } from '@/app/(admin)/settings/actions';
import { Switch } from '@/components/ui/switch';
import type { AuthApiConfig } from '@/libs/supabase/queries/auth-api-configs';

const SLUG_META: Record<string, { method: string; path: string }> = {
  signup: { method: 'POST', path: '/api/v1/auth/signup' },
  login: { method: 'POST', path: '/api/v1/auth/login' },
  phone_send_code: { method: 'POST', path: '/api/v1/auth/phone/send-code' },
  phone_verify_code: { method: 'POST', path: '/api/v1/auth/phone/verify-code' },
  kakao: { method: 'POST', path: '/api/v1/auth/kakao' },
};

interface AuthApiConfigCardProps {
  config: AuthApiConfig;
}

export default function AuthApiConfigCard({ config }: AuthApiConfigCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  useEffect(() => {
    setOptimistic(null);
  }, [config.is_enabled]);

  const isEnabled = optimistic ?? config.is_enabled;
  const meta = SLUG_META[config.endpoint_slug] ?? {
    method: 'POST',
    path: `/api/v1/auth/${config.endpoint_slug}`,
  };

  const handleToggle = (next: boolean) => {
    setOptimistic(next);
    startTransition(async () => {
      await toggleAuthApiConfigAction(config.id, next);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {config.label}
          </p>
          <code className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {meta.method} {meta.path}
          </code>
        </div>
      </div>

      <Switch
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isPending}
        ariaLabel={`${config.label} ${isEnabled ? '비활성화' : '활성화'}`}
        label={isEnabled ? 'ON' : 'OFF'}
        className="ml-4 flex-shrink-0"
      />
    </div>
  );
}
