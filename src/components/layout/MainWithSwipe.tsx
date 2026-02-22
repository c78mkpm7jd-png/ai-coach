"use client";

import { useRef } from "react";
import { useSidebar } from "./SidebarContext";

const SWIPE_MIN_PX = 50;

export default function MainWithSwipe({ children }: { children: React.ReactNode }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const deltaX = end - start;
    if (Math.abs(deltaX) < SWIPE_MIN_PX) return;
    if (deltaX > 0) {
      setMobileOpen(true);
    } else {
      setMobileOpen(false);
    }
  };

  return (
    <main
      className="min-h-screen min-w-0 flex-1 overflow-auto md:touch-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </main>
  );
}
