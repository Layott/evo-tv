import { AdminGuard } from "@/components/admin/admin-guard";
import { AnnouncementsPage } from "@/components/admin/announcements-page";

export default function AdminAnnouncementsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="editorial">
        <AnnouncementsPage />
      </AdminGuard>
    </div>
  );
}
