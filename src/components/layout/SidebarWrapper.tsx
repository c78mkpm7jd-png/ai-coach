"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";

function HamburgerIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/**
 * Desktop: Sidebar links aufklappbar wie bisher.
 * Mobile: Sidebar standardmäßig zugeklappt; Hamburger oben links öffnet Drawer mit dunklem Overlay (Klick schließt).
 */
export default function SidebarWrapper() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    setIsDesktop(media.matches);
    const listener = () => {
      setIsDesktop(media.matches);
      if (media.matches) setMobileDrawerOpen(false);
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return (
    <>
      {/* Mobile: Hamburger oben links */}
      <div className="fixed left-0 top-0 z-30 flex h-14 w-14 items-center justify-center border-b border-r border-white/10 bg-zinc-950 md:hidden">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Menü öffnen"
        >
          <HamburgerIcon />
        </button>
      </div>
      {/* Desktop: Sidebar immer sichtbar | Mobile: Sidebar als Drawer wenn geöffnet */}
      {isDesktop ? (
        <Sidebar />
      ) : mobileDrawerOpen ? (
        <Sidebar isDrawer onClose={() => setMobileDrawerOpen(false)} />
      ) : null}
    </>
  );
}
