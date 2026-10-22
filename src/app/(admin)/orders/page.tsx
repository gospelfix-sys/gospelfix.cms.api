import EmptyState from '@/components/admin/EmptyState';
import ApiPagination from '@/components/admin/ApiPagination';
import OrdersTable from './OrdersTable';
import OrdersFilters from './OrdersFilters';
import { getAllOrdersAdmin } from '@/libs/supabase/queries/orders.admin';

const PAGE_SIZE = 10;

interface OrdersPageProps {
  searchParams: {
    page?: string;
    q?: string;
    orderFrom?: string;
    orderTo?: string;
    paidFrom?: string;
    paidTo?: string;
  };
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const page = Number(searchParams.page) || 1;
  const filters = {
    search: searchParams.q,
    orderDateFrom: searchParams.orderFrom,
    orderDateTo: searchParams.orderTo,
    paidDateFrom: searchParams.paidFrom,
    paidDateTo: searchParams.paidTo,
  };
  const hasActiveFilter = Object.values(filters).some(Boolean);
  const { data: orders, total } = await getAllOrdersAdmin(page, PAGE_SIZE, filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          주문 관리
        </h1>
        <span className="text-sm text-gray-400">총 {total}건</span>
      </div>
      <OrdersFilters />
      {orders.length === 0 ? (
        <EmptyState
          message={hasActiveFilter ? '검색 결과가 없습니다' : '접수된 주문이 없습니다'}
        />
      ) : (
        <>
          <OrdersTable orders={orders} />
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
