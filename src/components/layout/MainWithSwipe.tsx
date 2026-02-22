"use client";

import { useRef } from "react";
import { useSidebar, SIDEBAR_WIDTH_PX } from "./SidebarContext";

const CLOSED_X = -SIDEBAR_WIDTH_PX;
const HALF_OPEN_X = -SIDEBAR_WIDTH_PX / 2;

function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

export default function MainWithSwipe({ children }: { children: React.ReactNode }) {
  const {
    mobileOpen,
    setMobileOpen,
    sidebarTranslateX,
    setSidebarTranslateX,
    isDragging,
    setIsDragging,
  } = useSidebar();
  const touchStartX = useRef<number | null>(null);
  const touchStartTranslateX = useRef<number>(CLOSED_X);
  const lastTranslateX = useRef<number>(CLOSED_X);

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0]?.clientX;
    if (x == null) return;
    touchStartX.current = x;
    touchStartTranslateX.current = sidebarTranslateX;
    lastTranslateX.current = sidebarTranslateX;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    if (startX == null) return;
    const currentX = e.targetTouches[0]?.clientX ?? startX;
    const deltaX = currentX - startX;
    const nextX = clamp(touchStartTranslateX.current + deltaX, CLOSED_X, 0);
    lastTranslateX.current = nextX;
    setSidebarTranslateX(nextX);
  };

  const onTouchEnd = () => {
    const current = lastTranslateX.current;
    touchStartX.current = null;
    setIsDragging(false);
    if (current > HALF_OPEN_X) {
      setMobileOpen(true);
    } else {
      setMobileOpen(false);
    }
  };

  return (
    <main
      className="min-h-screen min-w-0 flex-1 overflow-auto md:touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {children}
    </main>
  );
}
