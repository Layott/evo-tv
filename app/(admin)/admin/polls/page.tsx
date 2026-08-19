import { AdminGuard } from "@/components/admin/admin-guard";
import { PollsManagerPage } from "@/components/admin/polls-manager-page";

export default function AdminPollsRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="editorial">
        <PollsManagerPage />
      </AdminGuard>
    </div>
  );
}
