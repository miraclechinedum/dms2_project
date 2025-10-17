// components/layout/sidebar.tsx
"use client";

import { useState, useEffect } from "react";
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
  Shield,
  Building2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarContext } from "./sidebar-context";

// Permission IDs mapping
const PERMISSION_IDS = {
  USERS_CREATE: "cd7ba8ee-a9a5-11f0-8763-98e7f4ec7f69",
  ROLES_CREATE: "cd7bf8ec-a9a5-11f0-8763-98e7f4ec7f69",
  DOCUMENTS_UPLOAD: "cd7bfe50-a9a5-11f0-8763-98e7f4ec7f69",
  DEPARTMENTS_CREATE: "cd7c09fa-a9a5-11f0-8763-98e7f4ec7f69",
} as const;

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  route: string;
  requiredPermission?: string;
}

export function Sidebar() {
  const { profile, signOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebarContext();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  // Fetch user permissions
  useEffect(() => {
    if (user?.id) {
      extractUserPermissions();
    }
  }, [user]);

  const extractUserPermissions = async () => {
    if (!user?.id) return;

    try {
      // Try multiple approaches to get user permissions

      // Approach 1: Check if permissions are already in the user object
      if (user.permissions && Array.isArray(user.permissions)) {
        console.log("Found permissions in user object:", user.permissions);
        setUserPermissions(user.permissions);
        return;
      }

      // Approach 2: Try the main user endpoint
      const response = await fetch(`/api/users/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.user?.permissions && Array.isArray(data.user.permissions)) {
          console.log(
            "Found permissions in user API response:",
            data.user.permissions
          );
          setUserPermissions(data.user.permissions);
          return;
        }
      }

      // Approach 3: As a fallback, use the hardcoded permissions
      console.log("Using fallback permissions for sidebar");
      const fallbackPermissions = [
        PERMISSION_IDS.USERS_CREATE,
        PERMISSION_IDS.ROLES_CREATE,
        PERMISSION_IDS.DOCUMENTS_UPLOAD,
        PERMISSION_IDS.DEPARTMENTS_CREATE,
        "cd7c0634-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7c0f93-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7c03a9-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7c00f8-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7bfbb9-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7ba8ee-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7bf3c0-a9a5-11f0-8763-98e7f4ec7f69",
        "cd7becb9-a9a5-11f0-8763-98e7f4ec7f69",
      ];
      setUserPermissions(fallbackPermissions);
    } catch (error) {
      console.error("Failed to extract user permissions:", error);
      // Use minimal permissions on error
      setUserPermissions([]);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permissionId: string) => {
    return userPermissions.includes(permissionId);
  };

  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      route: "/documents",
      requiredPermission: PERMISSION_IDS.DOCUMENTS_UPLOAD,
    },
    {
      id: "users",
      label: "Users",
      icon: Users,
      route: "/users",
      requiredPermission: PERMISSION_IDS.USERS_CREATE,
    },
    {
      id: "departments",
      label: "Departments",
      icon: Building2,
      route: "/departments",
      requiredPermission: PERMISSION_IDS.DEPARTMENTS_CREATE,
    },
    {
      id: "roles",
      label: "Roles & Permissions",
      icon: Shield,
      route: "/roles",
      requiredPermission: PERMISSION_IDS.ROLES_CREATE,
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

  // Filter menu items based on permissions
  const filteredMenuItems = menuItems.filter((item) => {
    // If no permission required, always show
    if (!item.requiredPermission) return true;

    // Check if user has the required permission
    return hasPermission(item.requiredPermission);
  });

  const activeView =
    filteredMenuItems.find((item) => pathname?.startsWith(item.route))?.id ??
    "dashboard";

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
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-gray-900">DocuFlow</h1>
        )}
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
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start transition-all duration-200",
                  activeView === item.id
                    ? "bg-primary text-white shadow-sm"
                    : "hover:bg-primary/10 hover:text-primary",
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
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
            isCollapsed ? "px-2" : "px-3"
          )}
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
