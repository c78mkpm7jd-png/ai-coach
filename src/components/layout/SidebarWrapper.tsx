"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";

/**
 * Rendert die Sidebar nur auf Desktop (≥768px).
 * Auf Mobile wird sie nicht gemountet, damit der Clerk UserButton
 * keinen "Rendering..."-Platzhalter anzeigt.
 */
export default function SidebarWrapper() {
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    setShowSidebar(media.matches);
    const listener = () => setShowSidebar(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  if (!showSidebar) return null;
  return <Sidebar />;
}
