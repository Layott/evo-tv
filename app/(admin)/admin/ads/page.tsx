import { AdminGuard } from "@/components/admin/admin-guard";
import { AdsManagerPage } from "@/components/admin/ads-manager-page";

export default function AdminAdsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <AdsManagerPage />
      </AdminGuard>
    </div>
  );
}
