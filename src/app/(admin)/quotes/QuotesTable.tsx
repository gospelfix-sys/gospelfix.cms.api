'use client';

import { useRouter } from 'next/navigation';
import type { AdminQuoteListItem } from '@/types/quote';
import { parseUserAgent, formatTrafficSource } from '@/libs/user-agent';
import { formatPrice } from '@/libs/format';

export default function QuotesTable({
  quotes,
}: {
  quotes: AdminQuoteListItem[];
}) {
  const router = useRouter();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-700">
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
              담당자
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">
              연락처
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-28">
              예상견적
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-32 hidden md:table-cell">
              브라우저
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-32 hidden md:table-cell">
              유입경로
            </th>
            <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-40">
              신청일시
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
          {quotes.map((quote) => {
            const { browser, os } = parseUserAgent(quote.user_agent);
            return (
              <tr
                key={quote.id}
                onClick={() => router.push(`/quotes/${quote.id}`)}
                className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100 truncate max-w-[10rem]">
                  {quote.contact_name}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  {quote.contact_value}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {formatPrice(quote.estimated_total)}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                  {browser} · {os}
                </td>
                <td
                  className="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell truncate max-w-[8rem]"
                  title={quote.referer ?? undefined}
                >
                  {formatTrafficSource(quote.referer, quote.utm_params)}
                </td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(quote.created_at).toLocaleString('ko-KR')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
