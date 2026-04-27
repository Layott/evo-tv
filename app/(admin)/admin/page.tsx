import { AdminGuard } from "@/components/admin/admin-guard";
import { OverviewPage } from "@/components/admin/overview-page";

export default function AdminOverviewRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <OverviewPage />
      </AdminGuard>
    </div>
  );
}
