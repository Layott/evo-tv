import { AdminGuard } from "@/components/admin/admin-guard";
import { EncoderSetupPage } from "@/components/admin/encoder-setup-page";

export default function AdminEncoderSetupRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="broadcast">
        <EncoderSetupPage />
      </AdminGuard>
    </div>
  );
}
