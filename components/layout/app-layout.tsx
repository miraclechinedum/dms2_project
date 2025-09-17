// components/layout/app-layout.tsx
"use client";

import React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SidebarProvider, useSidebarContext } from "./sidebar-context";

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarContext();

  // sidebar widths must match the Sidebar component
  const expandedWidth = 64 * 1; // 16rem -> 64 (Tailwind * 0.25 = rem), we'll compute in px below
  // We'll derive px values directly for inline style:
  const SIDEBAR_EXPANDED_PX = 256; // 16rem = 256px
  const SIDEBAR_COLLAPSED_PX = 64; // 4rem = 64px
  const headerHeight = 64; // px (adjust if your header uses a different height)

  const leftOffset = isCollapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX;

  return (
    <div className="min-h-screen">
      {/* fixed sidebar (left) is rendered by Sidebar component */}
      <Sidebar />

      {/* fixed header with left offset so it doesn't overlap sidebar */}
      <div
        style={{
          marginLeft: leftOffset,
          height: headerHeight,
        }}
        className="fixed top-0 right-0 left-0 z-40"
      >
        <Header />
      </div>

      {/* main content area: add padding-top for header and padding-left for sidebar offset */}
      <main
        style={{
          marginLeft: leftOffset,
          paddingTop: headerHeight,
        }}
        className="min-h-screen bg-gray-50"
      >
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <InnerLayout>{children}</InnerLayout>
    </SidebarProvider>
  );
}
