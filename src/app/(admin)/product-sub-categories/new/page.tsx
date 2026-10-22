import NewProductSubCategoryForm from './NewProductSubCategoryForm';

export default function NewProductSubCategoryPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          새 소분류 등록
        </h1>
      </div>
      <NewProductSubCategoryForm />
    </div>
  );
}
