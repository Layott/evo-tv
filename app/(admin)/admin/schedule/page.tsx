import { AdminGuard } from "@/components/admin/admin-guard";
import { ScheduleManagerPage } from "@/components/admin/schedule-manager-page";

export default function AdminScheduleRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <ScheduleManagerPage />
      </AdminGuard>
    </div>
  );
}
