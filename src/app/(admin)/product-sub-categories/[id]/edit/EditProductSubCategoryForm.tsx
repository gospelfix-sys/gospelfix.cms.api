'use client';

import { useRouter } from 'next/navigation';
import ProductSubCategoryForm from '@/components/admin/ProductSubCategoryForm';
import { updateProductSubCategoryAction } from '../../actions';
import type {
  ProductSubCategory,
  ProductSubCategoryFormInput,
} from '@/libs/supabase/queries/product-sub-categories.admin';

export default function EditProductSubCategoryForm({
  subCategory,
}: {
  subCategory: ProductSubCategory;
}) {
  const router = useRouter();

  const handleSubmit = async (input: ProductSubCategoryFormInput) => {
    await updateProductSubCategoryAction(subCategory.id, input);
    router.push('/category?tab=sub');
    router.refresh();
  };

  const initialValues: Partial<ProductSubCategoryFormInput> = {
    value: subCategory.value,
    label: subCategory.label,
    is_active: subCategory.is_active,
  };

  return (
    <ProductSubCategoryForm
      initialValues={initialValues}
      onSubmit={handleSubmit}
      submitLabel="수정 완료"
    />
  );
}
