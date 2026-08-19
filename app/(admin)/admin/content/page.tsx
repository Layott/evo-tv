import { AdminGuard } from "@/components/admin/admin-guard";
import { ContentManagerPage } from "@/components/admin/content-manager-page";

export default function AdminContentRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="editorial">
        <ContentManagerPage />
      </AdminGuard>
    </div>
  );
}
