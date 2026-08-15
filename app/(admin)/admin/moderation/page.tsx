import { AdminGuard } from "@/components/admin/admin-guard";
import { ModerationPage } from "@/components/admin/moderation-page";

export default function AdminModerationRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard minRole="moderator">
        <ModerationPage />
      </AdminGuard>
    </div>
  );
}
