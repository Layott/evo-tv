import { AdminGuard } from "@/components/admin/admin-guard";
import { AuditLogPage } from "@/components/admin/audit-log-page";

export default function AdminAuditRoute() {
  return (
    <div className="p-6 lg:p-8">
      {/* Roster, because reading who did what is part of running the staff
          list. head_admin additionally sees its own rows, which the API
          decides rather than this screen. */}
      <AdminGuard capability="roster">
        <AuditLogPage />
      </AdminGuard>
    </div>
  );
}
