import { notFound } from 'next/navigation';
import EditProductCategoryForm from './EditProductCategoryForm';
import { getProductCategoryByIdAdmin } from '@/libs/supabase/queries/product-categories.admin';

export default async function EditProductCategoryPage({ params }: { params: { id: string } }) {
  const category = await getProductCategoryByIdAdmin(params.id);
  if (!category) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          대분류 편집
        </h1>
        <p className="text-sm text-gray-400 mt-0.5 truncate">{category.label}</p>
      </div>
      <EditProductCategoryForm category={category} />
    </div>
  );
}
