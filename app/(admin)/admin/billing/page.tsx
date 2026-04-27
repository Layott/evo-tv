import { AdminGuard } from "@/components/admin/admin-guard";
import { AdminBillingPage } from "@/components/admin/billing-page";

export default function AdminBillingRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <AdminBillingPage />
      </AdminGuard>
    </div>
  );
}
