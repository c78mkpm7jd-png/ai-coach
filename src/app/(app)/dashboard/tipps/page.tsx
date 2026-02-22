"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TippsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="h-5 w-20 animate-pulse rounded bg-white/10" />
      <p className="mt-4 text-sm text-white/50">Weiterleitung …</p>
    </div>
  );
}
