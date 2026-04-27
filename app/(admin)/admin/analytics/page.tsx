import { AdminGuard } from "@/components/admin/admin-guard";
import { AnalyticsPage } from "@/components/admin/analytics-page";

export default function AdminAnalyticsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <AnalyticsPage />
      </AdminGuard>
    </div>
  );
}
