import SidebarWrapper from "@/components/layout/SidebarWrapper";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <SidebarWrapper />
      <main className="min-h-screen flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
