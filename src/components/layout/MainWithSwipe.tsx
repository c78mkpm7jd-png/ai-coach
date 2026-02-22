"use client";

import { useRef, useEffect } from "react";
import { useSidebar, SIDEBAR_WIDTH_PX } from "./SidebarContext";

const CLOSED_X = -SIDEBAR_WIDTH_PX;
const HALF_OPEN_X = -SIDEBAR_WIDTH_PX / 2;
const LEFT_EDGE_PX = 20;
const HORIZONTAL_THRESHOLD_PX = 10;

function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

export default function MainWithSwipe({ children }: { children: React.ReactNode }) {
  const {
    setMobileOpen,
    sidebarTranslateX,
    setSidebarTranslateX,
    setIsDragging,
  } = useSidebar();
  const mainRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTranslateX = useRef<number>(CLOSED_X);
  const lastTranslateX = useRef<number>(CLOSED_X);
  const swipeCommitted = useRef(false);
  const setSidebarTranslateXRef = useRef(setSidebarTranslateX);
  setSidebarTranslateXRef.current = setSidebarTranslateX;

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.targetTouches[0];
    if (!t) return;
    const x = t.clientX;
    const y = t.clientY;
    if (x >= LEFT_EDGE_PX) return;
    touchStartX.current = x;
    touchStartY.current = y;
    touchStartTranslateX.current = sidebarTranslateX;
    lastTranslateX.current = sidebarTranslateX;
    swipeCommitted.current = false;
  };

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (touchStartX.current == null || touchStartY.current == null) return;
      const t = e.touches[0];
      if (!t) return;
      const deltaX = t.clientX - touchStartX.current;
      const deltaY = t.clientY - touchStartY.current;
      if (!swipeCommitted.current) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > absY && absX >= HORIZONTAL_THRESHOLD_PX) {
          swipeCommitted.current = true;
          document.body.style.overflow = "hidden";
          setIsDragging(true);
        } else return;
      }
      e.preventDefault();
      const nextX = clamp(touchStartTranslateX.current + deltaX, CLOSED_X, 0);
      lastTranslateX.current = nextX;
      setSidebarTranslateXRef.current(nextX);
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [setIsDragging]);

  const onTouchEnd = () => {
    if (touchStartX.current == null) return;
    const committed = swipeCommitted.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (committed) {
      setIsDragging(false);
      const current = lastTranslateX.current;
      if (current > HALF_OPEN_X) {
        setMobileOpen(true);
      } else {
        setMobileOpen(false);
      }
    }
  };

  return (
    <main
      ref={mainRef}
      className="min-h-screen min-w-0 flex-1 overflow-auto md:touch-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {children}
    </main>
  );
}
