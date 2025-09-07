"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
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

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, signOut } = useAuth();
  const router = useRouter();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "users", label: "Users", icon: Users },
    { id: "departments", label: "Departments", icon: Building2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "activity", label: "Activity Log", icon: Activity },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleNavigation = (view: string) => {
    onViewChange(view);

    // If we're on a different page, navigate to the dashboard first
    // then change the view
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.includes("/dashboard")
    ) {
      router.push("/dashboard");

      // Use a small timeout to ensure the navigation happens before changing view
      setTimeout(() => {
        onViewChange(view);
      }, 100);
    }
  };

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
                onClick={() => handleNavigation(item.id)}
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
