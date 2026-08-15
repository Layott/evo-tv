import { TopNav } from "@/components/shell/top-nav";
import { BottomNav } from "@/components/shell/bottom-nav";
import { LiteModeBanner } from "@/components/shell/lite-mode-banner";
import { AppFooter } from "@/components/shell/app-footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LiteModeBanner />
      <TopNav />
      <main className="flex-1">{children}</main>
      <AppFooter />
      <BottomNav />
    </div>
  );
}
