import Link from 'next/link';
import { Plus } from 'lucide-react';
import EmptyState from '@/components/admin/EmptyState';
import { getAllProductCategories } from '@/libs/supabase/queries/product-categories.admin';
import { getAllProductSubCategories } from '@/libs/supabase/queries/product-sub-categories.admin';
import ProductCategoriesTable from '../product-categories/ProductCategoriesTable';
import ProductSubCategoriesTable from '../product-sub-categories/ProductSubCategoriesTable';

// 상품 대분류/소분류를 "카테고리" 메뉴 하나(탭 2개)로 통합한 화면. 탭 전환은 ?tab=
// 쿼리스트링을 바꾸는 일반 네비게이션이라, 활성 탭의 목록만 조회한다(둘 다 미리
// 가져와두지 않음 — 데이터 자체는 소규모라도 안 쓰는 조회를 만들 이유가 없다).
const TABS = [
  { key: 'main', label: '상품 대분류' },
  { key: 'sub', label: '상품 소분류' },
] as const;

export default async function CategoryPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const activeTab = searchParams.tab === 'sub' ? 'sub' : 'main';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          카테고리
        </h1>
        <Link
          href={activeTab === 'sub' ? '/product-sub-categories/new' : '/product-categories/new'}
          className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity shrink-0"
        >
          <Plus size={15} />
          {activeTab === 'sub' ? '새 소분류' : '새 대분류'}
        </Link>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-gray-700">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/category?tab=${tab.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-black dark:border-white text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === 'sub' ? <SubCategoryTabContent /> : <MainCategoryTabContent />}
    </div>
  );
}

async function MainCategoryTabContent() {
  const categories = await getAllProductCategories();
  return categories.length === 0 ? (
    <EmptyState message="등록된 대분류가 없습니다" />
  ) : (
    <ProductCategoriesTable categories={categories} />
  );
}

async function SubCategoryTabContent() {
  const subCategories = await getAllProductSubCategories();
  return subCategories.length === 0 ? (
    <EmptyState message="등록된 소분류가 없습니다" />
  ) : (
    <ProductSubCategoriesTable subCategories={subCategories} />
  );
}
