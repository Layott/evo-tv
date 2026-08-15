import { AdminGuard } from "@/components/admin/admin-guard";
import { ShopManagerPage } from "@/components/admin/shop-manager-page";

export default function AdminShopRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard minRole="support_admin">
        <ShopManagerPage />
      </AdminGuard>
    </div>
  );
}
