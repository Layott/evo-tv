import { AdminMobileNav } from "@/components/shell/admin-mobile-nav";
import { AdminSidebar } from "@/components/shell/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar />
      {/* `min-w-0` matters: without it a wide table inside a flex child refuses
          to shrink and pushes the whole page sideways on a phone. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
