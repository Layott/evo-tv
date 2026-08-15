import { AdminGuard } from "@/components/admin/admin-guard";
import { LibraryManagerPage } from "@/components/admin/library-manager-page";

export default function AdminLibraryRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard minRole="moderator">
        <LibraryManagerPage />
      </AdminGuard>
    </div>
  );
}
