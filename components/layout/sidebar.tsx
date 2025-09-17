// components/layout/sidebar.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Upload,
  Users,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Home,
  Building2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "./sidebar-context";

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebarContext();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
    { id: "documents", label: "Documents", icon: FileText, route: "/documents" },
    { id: "users", label: "Users", icon: Users, route: "/users" },
    { id: "departments", label: "Departments", icon: Building2, route: "/departments" },
    { id: "notifications", label: "Notifications", icon: Bell, route: "/notifications" },
    { id: "activity", label: "Activity Log", icon: Activity, route: "/activity" },
    { id: "settings", label: "Settings", icon: Settings, route: "/settings" },
  ];

  const activeView = menuItems.find((item) => pathname?.startsWith(item.route))?.id ?? "dashboard";

  return (
    // fixed on md+; on small screens keep positioned relative so it can be used as a top bar or off-canvas
    <aside
      className={cn(
        "bg-white border-r border-gray-200 transition-all duration-300 z-50",
        // width: w-64 (256px) when expanded, w-16 (64px) when collapsed
        isCollapsed ? "w-16" : "w-64",
        // fixed layout on md+ (desktop)
        "md:fixed md:inset-y-0 md:left-0 md:top-0",
        // small-screen behavior: stick to top in flow
        "flex-shrink-0 flex flex-col h-screen"
      )}
      style={{ minWidth: isCollapsed ? 64 : 256 }}
    >
      <div className="flex items-center justify-between p-4 border-b">
        {!isCollapsed && <h1 className="text-xl font-bold text-gray-900">DocuFlow</h1>}
        <Button variant="ghost" size="sm" onClick={toggle}>
          {isCollapsed ? <Menu size={16} /> : <X size={16} />}
        </Button>
      </div>

      {!isCollapsed && profile && (
        <div className="p-4 border-b bg-gray-50">
          <p className="font-medium text-sm text-gray-900">{profile.name}</p>
          <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-200",
                  activeView === item.id ? "bg-primary text-white shadow-sm" : "hover:bg-primary/10 hover:text-primary",
                  isCollapsed ? "px-2" : "px-3"
                )}
                onClick={() => router.push(item.route)}
              >
                <Icon size={16} />
                {!isCollapsed && <span className="ml-2">{item.label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button variant="ghost" className={cn("w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50", isCollapsed ? "px-2" : "px-3")} onClick={async () => { await signOut(); router.push("/"); }}>
          <LogOut size={16} />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
