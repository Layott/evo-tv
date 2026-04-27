import { TopNav } from "@/components/shell/top-nav";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LiteModeBanner } from "@/components/shell/lite-mode-banner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <LiteModeBanner />
      <TopNav />
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
