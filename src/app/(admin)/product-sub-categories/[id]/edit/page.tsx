import { notFound } from 'next/navigation';
import EditProductSubCategoryForm from './EditProductSubCategoryForm';
import { getProductSubCategoryByIdAdmin } from '@/libs/supabase/queries/product-sub-categories.admin';

export default async function EditProductSubCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  const subCategory = await getProductSubCategoryByIdAdmin(params.id);
  if (!subCategory) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          소분류 편집
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 truncate">{subCategory.label}</p>
      </div>
      <EditProductSubCategoryForm subCategory={subCategory} />
    </div>
  );
}
