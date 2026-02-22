"use client";

import { useEffect } from "react";
import { useSidebar } from "./SidebarContext";
import MainWithSwipe from "./MainWithSwipe";

export default function MainContentWithOverlayLock({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mobileOpen, isDragging } = useSidebar();
  const overlayActive = mobileOpen || isDragging;

  useEffect(() => {
    if (overlayActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [overlayActive]);

  return (
    <div
      className={overlayActive ? "pointer-events-none min-h-screen min-w-0 flex-1" : "min-h-screen min-w-0 flex-1"}
      aria-hidden={overlayActive}
    >
      <MainWithSwipe>{children}</MainWithSwipe>
    </div>
  );
}
