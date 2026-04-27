import { AdminGuard } from "@/components/admin/admin-guard";
import { ForensicPage } from "@/components/forensic/forensic-page";

export default function AdminForensicRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <ForensicPage />
      </AdminGuard>
    </div>
  );
}
