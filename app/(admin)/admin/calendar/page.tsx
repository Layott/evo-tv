import { AdminGuard } from "@/components/admin/admin-guard";
import { CalendarPage } from "@/components/admin/calendar-page";

export default function AdminCalendarRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="editorial">
        <CalendarPage />
      </AdminGuard>
    </div>
  );
}
