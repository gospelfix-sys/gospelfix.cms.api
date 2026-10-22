'use client';

import { useRouter } from 'next/navigation';
import ProductCategoryForm from '@/components/admin/ProductCategoryForm';
import { updateProductCategoryAction } from '../../actions';
import type {
  ProductCategory,
  ProductCategoryFormInput,
} from '@/libs/supabase/queries/product-categories.admin';

export default function EditProductCategoryForm({ category }: { category: ProductCategory }) {
  const router = useRouter();

  const handleSubmit = async (input: ProductCategoryFormInput) => {
    await updateProductCategoryAction(category.id, input);
    router.push('/category');
    router.refresh();
  };

  const initialValues: Partial<ProductCategoryFormInput> = {
    value: category.value,
    label: category.label,
    is_active: category.is_active,
  };

  return (
    <ProductCategoryForm
      initialValues={initialValues}
      onSubmit={handleSubmit}
      submitLabel="수정 완료"
    />
  );
}
