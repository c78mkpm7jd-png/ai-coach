import SidebarWrapper from "@/components/layout/SidebarWrapper";
import AppGuard from "@/components/layout/AppGuard";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import MainWithSwipe from "@/components/layout/MainWithSwipe";

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
          <MainWithSwipe>{children}</MainWithSwipe>
        </div>
      </SidebarProvider>
    </AppGuard>
  );
}
