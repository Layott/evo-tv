import { AdminGuard } from "@/components/admin/admin-guard";
import { ForensicPage } from "@/components/admin/forensic-page";

/**
 * Sign-in forensics.
 *
 * Was a "Coming soon" card promising per-session watermarks, which needs a
 * transcoding pipeline nobody has built. What has existed since August is
 * `login_events` and an endpoint that can answer "every account that signed in
 * from this connection", and nothing called it. Now something does.
 */
export default function AdminForensicRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard capability="broadcast">
        <ForensicPage />
      </AdminGuard>
    </div>
  );
}
