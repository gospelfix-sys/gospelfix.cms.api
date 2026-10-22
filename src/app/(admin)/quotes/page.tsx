import EmptyState from '@/components/admin/EmptyState';
import ApiPagination from '@/components/admin/ApiPagination';
import QuotesTable from './QuotesTable';
import { getAllQuotesAdmin } from '@/libs/supabase/queries/quotes.admin';

const PAGE_SIZE = 20;

interface QuotesPageProps {
  searchParams: { page?: string };
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const page = Number(searchParams.page) || 1;
  const { data: quotes, total } = await getAllQuotesAdmin(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          견적 신청
        </h1>
        <span className="text-sm text-gray-400">총 {total}건</span>
      </div>
      {quotes.length === 0 ? (
        <EmptyState message="접수된 견적 신청이 없습니다" />
      ) : (
        <>
          <QuotesTable quotes={quotes} />
          {totalPages > 1 && (
            <ApiPagination
              currentPage={page}
              totalPages={totalPages}
              paramName="page"
            />
          )}
        </>
      )}
    </div>
  );
}
