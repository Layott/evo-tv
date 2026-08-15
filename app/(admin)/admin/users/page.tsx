import { AdminGuard } from "@/components/admin/admin-guard";
import { UsersRolesPage } from "@/components/admin/users-roles-page";

export default function AdminUsersRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard minRole="support_admin">
        <UsersRolesPage />
      </AdminGuard>
    </div>
  );
}
