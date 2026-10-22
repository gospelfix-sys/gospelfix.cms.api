import NewProductCategoryForm from './NewProductCategoryForm';

export default function NewProductCategoryPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          새 대분류 등록
        </h1>
      </div>
      <NewProductCategoryForm />
    </div>
  );
}
