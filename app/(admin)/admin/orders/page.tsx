import { AdminGuard } from "@/components/admin/admin-guard";
import { OrdersPage } from "@/components/admin/orders-page";

export default function AdminOrdersRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard minRole="support_admin">
        <OrdersPage />
      </AdminGuard>
    </div>
  );
}
