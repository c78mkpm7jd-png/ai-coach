import SidebarWrapper from "@/components/layout/SidebarWrapper";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <SidebarWrapper />
      <main className="min-h-screen flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>
      {/* Mobile Bottom Navigation: Sichtbarkeit über globals.css (.mobile-bottom-nav), nicht über Tailwind – funktioniert zuverlässig in Production */}
      <div className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-[100]">
        <BottomNav />
      </div>
    </div>
  );
}
