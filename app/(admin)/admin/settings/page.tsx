import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminSettingsPage } from "@/components/admin/admin-settings-page";

export default function AdminSettingsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <AdminSettingsPage />
      </AdminGuard>
    </div>
  );
}
