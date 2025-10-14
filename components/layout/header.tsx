// components/layout/header.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Bell, ChevronDown } from "lucide-react";
import { useSidebarContext } from "./sidebar-context";

interface Notification {
  id: string;
  type: string;
  message: string;
  related_document_id?: string;
  document_title?: string;
  sender_name?: string;
  is_read: boolean;
  created_at: string;
}

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const { isCollapsed } = useSidebarContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const headerClass =
    "h-16 bg-white border-b border-gray-200 flex items-center px-6";

  const fetchNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=5&unreadOnly=false");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      } else {
        console.error("Failed to fetch notifications:", res.status);
        // Don't show error to user for notifications, just log it
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      // Don't show error to user for notifications
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.related_document_id) {
      router.push(`/documents/${notification.related_document_id}`);
    }

    setNotificationsOpen(false);
  };

  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div className={headerClass}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-primary">DocuFlow</h1>
            <p className="text-xs text-gray-500">Document Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications Dropdown */}
          <DropdownMenu
            open={notificationsOpen}
            onOpenChange={setNotificationsOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative p-2">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 max-h-96 overflow-y-auto"
            >
              <div className="p-2 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-gray-500">{unreadCount} unread</p>
                )}
              </div>

              {loading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`p-3 border-b last:border-b-0 cursor-pointer ${
                      !notification.is_read ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="w-full">
                      <p className="text-sm font-medium mb-1">
                        {notification.message}
                      </p>
                      {notification.document_title && (
                        <p className="text-xs text-gray-600 mb-1">
                          Document: {notification.document_title}
                        </p>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              )}

              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      router.push("/notifications");
                      setNotificationsOpen(false);
                    }}
                  >
                    View All Notifications
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Dropdown */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3">
                <Avatar className="h-8 w-8 bg-primary">
                  <AvatarFallback>
                    {(user.name || "U").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {profile?.role ?? "member"}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    menuOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 data-[state=open]:animate-fade-in-down"
            >
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
