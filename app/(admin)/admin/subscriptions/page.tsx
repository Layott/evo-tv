import { AdminGuard } from "@/components/admin/admin-guard";
import { SubscriptionsPage } from "@/components/admin/subscriptions-page";

export default function AdminSubscriptionsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="commerce">
        <SubscriptionsPage />
      </AdminGuard>
    </div>
  );
}
