"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const iconClass = "w-6 h-6 shrink-0";
const iconClassSmall = "w-5 h-5 shrink-0";

function GridIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ChatIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SettingsIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ClipboardIcon({ className = iconClass }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

const leftItems = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon },
  { href: "/chat", label: "Assistent", icon: ChatIcon },
];
const rightItems = [
  { href: "/profil", label: "Einstellungen", icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/10 bg-zinc-950/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:hidden"
      role="navigation"
      aria-label="Hauptnavigation"
    >
      {leftItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-white/70 transition hover:bg-white/5 hover:text-white"
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={iconClassSmall} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}

      <Link
        href="/checkin"
        className="flex min-h-[52px] min-w-[52px] -translate-y-1 flex-col items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-zinc-950 shadow-lg transition hover:bg-white/90"
        aria-current={pathname === "/checkin" ? "page" : undefined}
      >
        <ClipboardIcon className="h-7 w-7" />
        <span className="text-[10px] font-semibold">Check-in</span>
      </Link>

      {rightItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-white/70 transition hover:bg-white/5 hover:text-white"
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={iconClassSmall} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
