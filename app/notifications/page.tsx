// app/notifications/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, Trash2, Check } from "lucide-react";

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

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchNotifications();
  }, [user, router]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.is_read);
      await Promise.all(
        unreadNotifications.map((n) =>
          fetch(`/api/notifications/${n.id}`, { method: "PATCH" })
        )
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.related_document_id) {
      router.push(`/documents/${notification.related_document_id}`);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/documents")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Notifications
              </h1>
              <p className="text-gray-600">
                Manage your document notifications
              </p>
            </div>
          </div>

          {notifications.some((n) => !n.is_read) && (
            <Button onClick={markAllAsRead} variant="outline">
              <Check className="h-4 w-4 mr-2" />
              Mark All as Read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  !notification.is_read
                    ? "border-l-4 border-l-blue-500 bg-blue-50"
                    : ""
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-gray-900">
                        {notification.message}
                      </p>
                      {!notification.is_read && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-800"
                        >
                          New
                        </Badge>
                      )}
                    </div>

                    {notification.document_title && (
                      <p className="text-sm text-gray-600 mb-2">
                        Document:{" "}
                        <span className="font-medium">
                          {notification.document_title}
                        </span>
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatDateTime(notification.created_at)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No notifications
            </h3>
            <p className="text-gray-600">
              You're all caught up! New notifications will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
