"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Wenn ein eingeloggter Nutzer kein Profil hat → zu /onboarding weiterleiten.
 * Nicht eingeloggt → zu /sign-in weiterleiten.
 */
export default function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json: { data?: unknown }) => {
        if (cancelled) return;
        if (json.data == null) {
          router.replace("/onboarding");
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) setAllowed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return <>{children}</>;
}
