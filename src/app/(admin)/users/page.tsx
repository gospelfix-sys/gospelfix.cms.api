import EmptyState from '@/components/admin/EmptyState';
import { getAllUsers } from '@/libs/supabase/queries/users';
import { requireAdminPage } from '@/libs/supabase/queries/auth';
import UsersTable from './UsersTable';

export default async function UsersPage() {
  const currentUser = await requireAdminPage();
  const users = await getAllUsers();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            유저 관리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">총 {users.length}명</p>
        </div>
      </div>
      {users.length === 0 ? (
        <EmptyState message="등록된 유저가 없습니다" />
      ) : (
        <UsersTable users={users} currentUserId={currentUser.id} />
      )}
    </div>
  );
}
