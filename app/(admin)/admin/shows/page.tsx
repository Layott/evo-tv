import { AdminGuard } from "@/components/admin/admin-guard";
import { ShowsManagerPage } from "@/components/admin/shows-manager-page";

export default function AdminShowsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <ShowsManagerPage />
      </AdminGuard>
    </div>
  );
}
