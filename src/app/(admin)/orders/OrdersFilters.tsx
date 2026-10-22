'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const DEBOUNCE_MS = 300;

function DateRangeField({
  label,
  fromParam,
  toParam,
}: {
  label: string;
  fromParam: string;
  toParam: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateDate(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="date"
          defaultValue={searchParams.get(fromParam) ?? ''}
          onChange={(e) => updateDate(fromParam, e.target.value)}
          className="h-9 w-[7.5rem] text-xs sm:w-[9.5rem]"
        />
        <span className="text-gray-400">~</span>
        <Input
          type="date"
          defaultValue={searchParams.get(toParam) ?? ''}
          onChange={(e) => updateDate(toParam, e.target.value)}
          className="h-9 w-[7.5rem] text-xs sm:w-[9.5rem]"
        />
      </div>
    </div>
  );
}

export default function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim()) {
        params.set('q', search.trim());
      } else {
        params.delete('q');
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // pathname/router/searchParams는 매 렌더마다 새 참조가 생겨 deps에 넣으면 무한 루프가 되므로 제외한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div className="relative w-full max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="주문번호, 상품명, 구매자 이메일로 검색"
          className="pl-9"
        />
      </div>
      <DateRangeField label="주문일" fromParam="orderFrom" toParam="orderTo" />
      <DateRangeField label="결제일" fromParam="paidFrom" toParam="paidTo" />
    </div>
  );
}
