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

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      route: "/documents",
    },
    { id: "upload", label: "Upload", icon: Upload, route: "/upload" },
    { id: "users", label: "Users", icon: Users, route: "/users" },
    {
      id: "departments",
      label: "Departments",
      icon: Building2,
      route: "/departments",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      route: "/notifications",
    },
    {
      id: "activity",
      label: "Activity Log",
      icon: Activity,
      route: "/activity",
    },
    { id: "settings", label: "Settings", icon: Settings, route: "/settings" },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleNavigation = (route: string) => {
    router.push(route);
  };

  // Determine active view based on current pathname
  const getActiveView = () => {
    const currentItem = menuItems.find((item) =>
      pathname.startsWith(item.route)
    );
    return currentItem?.id || "dashboard";
  };

  const activeView = getActiveView();

  return (
    <div
      className={cn(
        "flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-gray-900">DocuFlow</h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? <Menu size={16} /> : <X size={16} />}
        </Button>
      </div>

      {/* User Info */}
      {!isCollapsed && profile && (
        <div className="p-4 border-b bg-gray-50">
          <p className="font-medium text-sm text-gray-900">{profile.name}</p>
          <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isCollapsed ? "px-2" : "px-3"
                )}
                onClick={() => handleNavigation(item.route)}
              >
                <Icon size={16} />
                {!isCollapsed && <span className="ml-2">{item.label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
            isCollapsed ? "px-2" : "px-3"
          )}
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}
