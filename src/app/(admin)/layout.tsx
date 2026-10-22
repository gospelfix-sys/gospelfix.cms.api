import { MobileMenuProvider } from '@/components/admin/MobileMenuContext';
import AdminShell from '@/components/admin/AdminShell';
import Sidebar from '@/components/admin/Sidebar';
import { requireAdminPage } from '@/libs/supabase/queries/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

  return (
    <MobileMenuProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <AdminShell>
          <div className="flex gap-3 p-3 pt-[68px] lg:pt-3">
            <Sidebar />
            <main className="flex-1 min-w-0 py-4 px-3 lg:pt-8 lg:px-6">
              {children}
            </main>
          </div>
        </AdminShell>
      </div>
    </MobileMenuProvider>
  );
}
