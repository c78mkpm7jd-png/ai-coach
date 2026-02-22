import SidebarWrapper from "@/components/layout/SidebarWrapper";
import AppGuard from "@/components/layout/AppGuard";
import { SidebarProvider } from "@/components/layout/SidebarContext";

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
          <main className="min-h-screen min-w-0 flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </AppGuard>
  );
}
