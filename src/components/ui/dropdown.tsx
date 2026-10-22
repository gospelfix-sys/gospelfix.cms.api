'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/libs/utils';

export interface DropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = '선택하세요',
  className,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const optionRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const listboxId = React.useId();

  React.useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (open && highlightedIndex >= 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [open, highlightedIndex]);

  const openList = () => {
    if (disabled) return;
    setHighlightedIndex(Math.max(options.indexOf(value), 0));
    setOpen(true);
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectOption = (option: string) => {
    onChange(option);
    closeAndFocusTrigger();
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openList();
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0) selectOption(options[highlightedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAndFocusTrigger();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={cn(!value && 'text-gray-400')}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          onKeyDown={handleListKeyDown}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1 text-sm"
        >
          {options.map((option, index) => (
            <li
              key={option}
              id={`${listboxId}-option-${index}`}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              role="option"
              aria-selected={option === value}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOption(option)}
              className={cn(
                'flex items-center justify-between px-3 py-2 cursor-pointer text-gray-900 dark:text-gray-100',
                index === highlightedIndex && 'bg-gray-100 dark:bg-gray-800',
              )}
            >
              {option}
              {option === value && <Check className="h-4 w-4" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
