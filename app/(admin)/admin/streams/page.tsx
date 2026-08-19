import { AdminGuard } from "@/components/admin/admin-guard";
import { StreamsManagerPage } from "@/components/admin/streams-manager-page";

export default function AdminStreamsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="broadcast">
        <StreamsManagerPage />
      </AdminGuard>
    </div>
  );
}
