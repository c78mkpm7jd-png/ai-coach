"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useSidebar, SIDEBAR_WIDTH_PX } from "./SidebarContext";

const CLOSED_X = -SIDEBAR_WIDTH_PX;
const HALF_OPEN_X = -SIDEBAR_WIDTH_PX / 2;

function clamp(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

const iconClass = "w-5 h-5 shrink-0";

function GridIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon },
  { href: "/chat", label: "Coach", icon: ChatIcon },
  { href: "/profil", label: "Einstellungen", icon: SettingsIcon },
];

function SidebarContent({
  open,
  onLinkClick,
}: {
  open: boolean;
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex flex-col gap-1 p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon />
              {(open ?? true) && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 space-y-1 p-2">
        <Link
          href="/checkin"
          onClick={onLinkClick}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/checkin"
              ? "bg-white/10 text-white"
              : "bg-white text-zinc-950 hover:bg-white/90"
          }`}
        >
          <ClipboardIcon />
          {(open ?? true) && <span className="truncate">Check-in</span>}
        </Link>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <UserButton
            fallback={<span className="h-8 w-8 rounded-full bg-white/10" aria-hidden />}
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
                userButtonPopoverCard: "bg-zinc-900 border border-white/10",
                userButtonPopoverActionButton: "text-white hover:bg-zinc-800",
                userButtonPopoverActionButtonText: "text-white",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
          {(open ?? true) && (
            <Link
              href="/profil"
              onClick={onLinkClick}
              className="truncate text-sm font-medium text-white/70 hover:text-white"
            >
              Profil
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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
  const didDragRef = useRef(false);

  const closeMobile = () => setMobileOpen(false);

  const handleBackdropClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    closeMobile();
  };

  const onBackdropTouchStart = (e: React.TouchEvent) => {
    const x = e.targetTouches[0]?.clientX;
    if (x == null) return;
    document.body.style.overflow = "hidden";
    touchStartX.current = x;
    touchStartTranslateX.current = sidebarTranslateX;
    lastTranslateX.current = sidebarTranslateX;
    setIsDragging(true);
  };

  const onBackdropTouchMove = (e: React.TouchEvent) => {
    const startX = touchStartX.current;
    if (startX == null) return;
    didDragRef.current = true;
    const currentX = e.targetTouches[0]?.clientX ?? startX;
    const deltaX = currentX - startX;
    const nextX = clamp(touchStartTranslateX.current + deltaX, CLOSED_X, 0);
    lastTranslateX.current = nextX;
    setSidebarTranslateX(nextX);
  };

  const onBackdropTouchEnd = () => {
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
    <>
      {/* Desktop: Sidebar wie bisher in der Spalte */}
      <aside
        className={`hidden md:flex shrink-0 flex-col border-r border-white/10 bg-zinc-950 text-white transition-[width] duration-200 ${
          open ? "w-56" : "w-16"
        }`}
      >
        <div className="flex h-14 items-center border-b border-white/10 px-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={open ? "Sidebar einklappen" : "Sidebar aufklappen"}
          >
            <svg
              className={`h-5 w-5 transition-transform ${open ? "" : "rotate-180"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
          {open && (
            <span className="ml-2 truncate text-sm font-medium text-white/90">AI Fitness Coach</span>
          )}
        </div>
        <SidebarContent open={open} />
      </aside>

      {/* Mobile: Overlay wenn offen oder während Drag; Sidebar folgt translateX */}
      {(mobileOpen || isDragging) && (
        <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
          <div
            role="button"
            tabIndex={0}
            aria-label="Menü schließen"
            className="absolute inset-0 bg-black transition-opacity duration-300 ease-out"
            style={{
              opacity: (SIDEBAR_WIDTH_PX + sidebarTranslateX) / SIDEBAR_WIDTH_PX * 0.6,
            }}
            onClick={handleBackdropClick}
            onTouchStart={onBackdropTouchStart}
            onTouchMove={onBackdropTouchMove}
            onTouchEnd={onBackdropTouchEnd}
            onTouchCancel={onBackdropTouchEnd}
            onKeyDown={(e) => e.key === "Enter" && handleBackdropClick()}
          />
          <aside
            className="absolute left-0 top-0 bottom-0 flex w-56 flex-col border-r border-white/10 bg-zinc-950 text-white shadow-xl"
            style={{
              transform: `translateX(${sidebarTranslateX}px)`,
              transition: isDragging ? "none" : "transform 300ms ease",
            }}
          >
            <div className="flex h-14 items-center border-b border-white/10 px-3">
              <button
                type="button"
                onClick={closeMobile}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Menü schließen"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <span className="ml-2 truncate text-sm font-medium text-white/90">AI Fitness Coach</span>
            </div>
            <SidebarContent open={true} onLinkClick={closeMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
