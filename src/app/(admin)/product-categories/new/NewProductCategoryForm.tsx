'use client';

import { useRouter } from 'next/navigation';
import ProductCategoryForm from '@/components/admin/ProductCategoryForm';
import { createProductCategoryAction } from '../actions';
import type { ProductCategoryFormInput } from '@/libs/supabase/queries/product-categories.admin';

export default function NewProductCategoryForm() {
  const router = useRouter();

  const handleSubmit = async (input: ProductCategoryFormInput) => {
    await createProductCategoryAction(input);
    router.push('/category');
    router.refresh();
  };

  return <ProductCategoryForm onSubmit={handleSubmit} />;
}
