import EmptyState from '@/components/admin/EmptyState';
import ProductsTable from './ProductsTable';
import { getAllProducts } from '@/libs/supabase/queries/products.admin';
import { getProductCategoryLabelMap } from '@/libs/supabase/queries/product-categories.admin';
import { getProductSubCategoryLabelMap } from '@/libs/supabase/queries/product-sub-categories.admin';

export default async function ProductsPage() {
  const [products, categoryLabels, subCategoryLabels] = await Promise.all([
    getAllProducts(),
    getProductCategoryLabelMap(),
    getProductSubCategoryLabelMap(),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            상품 관리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            총 {products.length}건 — 등록/수정은 회원 마이페이지 셀프서비스로
            이전되었습니다
          </p>
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState message="등록된 상품이 없습니다" />
      ) : (
        <ProductsTable
          products={products}
          categoryLabels={categoryLabels}
          subCategoryLabels={subCategoryLabels}
        />
      )}
    </div>
  );
}
