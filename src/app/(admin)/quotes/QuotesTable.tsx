'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminQuoteListItem } from '@/types/quote';
import { parseUserAgent, formatTrafficSource } from '@/libs/user-agent';
import { formatPrice, formatDateTime } from '@/libs/format';

export default function QuotesTable({
  quotes,
}: {
  quotes: AdminQuoteListItem[];
}) {
  const router = useRouter();

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {quotes.map((quote) => {
          const { browser, os } = parseUserAgent(quote.user_agent);
          return (
            <li key={quote.id}>
              <Link
                href={`/quotes/${quote.id}`}
                className="block rounded-xl border border-gray-100 bg-white p-4 transition-colors active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:active:bg-gray-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {!quote.viewed_at && (
                      <span
                        role="img"
                        aria-label="읽지 않음"
                        className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                      />
                    )}
                    <span className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                      {quote.contact_name}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatPrice(quote.estimated_total)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {quote.contact_value}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span>{formatDateTime(quote.created_at)}</span>
                  <span className="truncate">
                    {browser} · {os} ·{' '}
                    {formatTrafficSource(quote.referer, quote.utm_params)}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
                담당자
              </th>
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
                연락처
              </th>
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-28">
                예상견적
              </th>
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-32">
                브라우저
              </th>
              <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium w-32">
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
                  <td className="relative px-4 py-3 pl-6 text-gray-900 dark:text-gray-100 truncate max-w-[10rem]">
                    {!quote.viewed_at && (
                      <span
                        role="img"
                        aria-label="읽지 않음"
                        className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500"
                      />
                    )}
                    {quote.contact_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {quote.contact_value}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {formatPrice(quote.estimated_total)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {browser} · {os}
                  </td>
                  <td
                    className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[8rem]"
                    title={quote.referer ?? undefined}
                  >
                    {formatTrafficSource(quote.referer, quote.utm_params)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {formatDateTime(quote.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
