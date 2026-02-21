"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * Wenn ein eingeloggter Nutzer bereits ein Profil in Supabase hat und
 * /onboarding besucht → automatisch zu /dashboard weiterleiten.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [checkDone, setCheckDone] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setCheckDone(true);
      return;
    }

    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((json: { data?: unknown }) => {
        if (cancelled) return;
        if (json.data != null) {
          router.replace("/dashboard");
          return;
        }
        setCheckDone(true);
      })
      .catch(() => setCheckDone(true));

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !checkDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return <>{children}</>;
}
