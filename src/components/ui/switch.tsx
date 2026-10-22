'use client';

import { cn } from '@/libs/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  label?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
  label,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'min-h-11 flex items-center gap-2 disabled:opacity-50',
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            'text-xs font-medium',
            checked
              ? 'text-gray-900 dark:text-gray-100'
              : 'text-gray-400 dark:text-gray-500',
          )}
        >
          {label}
        </span>
      )}
      <div
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform dark:bg-black',
            checked ? 'translate-x-[23px]' : 'translate-x-[3px]',
          )}
        />
      </div>
    </button>
  );
}
