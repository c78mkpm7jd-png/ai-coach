import SidebarWrapper from "@/components/layout/SidebarWrapper";
import AppGuard from "@/components/layout/AppGuard";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import MainContentWithOverlayLock from "@/components/layout/MainContentWithOverlayLock";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppGuard>
      <SidebarProvider>
        <div className="flex min-h-screen bg-zinc-950 text-white">
          <SidebarWrapper />
          <MainContentWithOverlayLock>{children}</MainContentWithOverlayLock>
        </div>
      </SidebarProvider>
    </AppGuard>
  );
}
