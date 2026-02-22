"use client";

import { createContext, useContext, useState } from "react";

export const SIDEBAR_WIDTH_PX = 224; // w-56 = 14rem

type SidebarContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  sidebarTranslateX: number;
  setSidebarTranslateX: (v: number) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const closedTranslate = -SIDEBAR_WIDTH_PX;

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  return (
    ctx ?? {
      mobileOpen: false,
      setMobileOpen: () => {},
      sidebarTranslateX: closedTranslate,
      setSidebarTranslateX: () => {},
      isDragging: false,
      setIsDragging: () => {},
    }
  );
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpenState, setMobileOpenState] = useState(false);
  const [sidebarTranslateX, setSidebarTranslateX] = useState(closedTranslate);
  const [isDragging, setIsDragging] = useState(false);

  const setMobileOpen = (open: boolean) => {
    setMobileOpenState(open);
    setSidebarTranslateX(open ? 0 : closedTranslate);
  };

  return (
    <SidebarContext.Provider
      value={{
        mobileOpen: mobileOpenState,
        setMobileOpen,
        sidebarTranslateX,
        setSidebarTranslateX,
        isDragging,
        setIsDragging,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
