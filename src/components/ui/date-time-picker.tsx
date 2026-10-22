'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/libs/utils';

interface DateTimePickerProps {
  /** ISO 8601 문자열. 미선택 시 null. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

type Period = '오전' | '오후';

const PERIOD_OPTIONS: Period[] = ['오전', '오후'];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

const TIME_SELECT_CLASS =
  'rounded-md border border-input bg-background px-2 py-2 text-center text-sm font-semibold disabled:opacity-50';

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function to12Hour(hour24: number): { period: Period; hour12: number } {
  const period: Period = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { period, hour12 };
}

function to24Hour(period: Period, hour12: number): number {
  if (period === '오전') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

/**
 * shadcn Calendar + Popover 조합의 날짜/시간 선택기. 관리자 폼 전반에서 재사용하기 위해
 * 도메인 지식 없이 순수 ISO 문자열 value/onChange로만 제어된다. 오전·오후/시/분은 네이티브
 * select로 구현한다 — Calendar의 월/년 드롭다운과 동일하게 열었을 때 브라우저(Safari)가
 * 그리는 네이티브 목록(체크마크 스타일)을 그대로 활용하기 위함.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = '날짜 및 시간 선택',
  className,
}: DateTimePickerProps) {
  const date = value ? new Date(value) : undefined;
  const timeValue = date ? formatTime(date) : '00:00';
  const [hour24, minute] = timeValue.split(':').map(Number);
  const { period, hour12 } = to12Hour(hour24);

  function handleDateSelect(selected: Date | undefined) {
    if (!selected) {
      onChange(null);
      return;
    }
    const next = new Date(selected);
    next.setHours(hour24, minute, 0, 0);
    onChange(next.toISOString());
  }

  function commitTime(
    nextPeriod: Period,
    nextHour12: number,
    nextMinute: number,
  ) {
    if (!date) return;
    const next = new Date(date);
    next.setHours(to24Hour(nextPeriod, nextHour12), nextMinute, 0, 0);
    onChange(next.toISOString());
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          {date
            ? `${date.toLocaleDateString('ko-KR')} ${timeValue}`
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-auto min-w-[272px] max-w-[calc(100vw-24px)] p-0 sm:min-w-[320px]"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          locale={ko}
          captionLayout="dropdown"
          className="[--cell-size:2.25rem] sm:[--cell-size:2.75rem]"
        />
        <div className="flex justify-center gap-2 border-t border-border p-3">
          <select
            value={period}
            onChange={(e) =>
              commitTime(e.target.value as Period, hour12, minute)
            }
            disabled={!date}
            className={TIME_SELECT_CLASS}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={hour12}
            onChange={(e) => commitTime(period, Number(e.target.value), minute)}
            disabled={!date}
            className={TIME_SELECT_CLASS}
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}
              </option>
            ))}
          </select>
          <select
            value={minute}
            onChange={(e) => commitTime(period, hour12, Number(e.target.value))}
            disabled={!date}
            className={TIME_SELECT_CLASS}
          >
            {MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
