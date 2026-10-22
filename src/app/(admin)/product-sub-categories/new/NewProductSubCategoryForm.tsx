'use client';

import { useRouter } from 'next/navigation';
import ProductSubCategoryForm from '@/components/admin/ProductSubCategoryForm';
import { createProductSubCategoryAction } from '../actions';
import type { ProductSubCategoryFormInput } from '@/libs/supabase/queries/product-sub-categories.admin';

export default function NewProductSubCategoryForm() {
  const router = useRouter();

  const handleSubmit = async (input: ProductSubCategoryFormInput) => {
    await createProductSubCategoryAction(input);
    router.push('/category?tab=sub');
    router.refresh();
  };

  return <ProductSubCategoryForm onSubmit={handleSubmit} />;
}
