// app/notifications/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const notificationsPerPage = 10;

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchNotifications();
  }, [user, router, currentPage]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * notificationsPerPage;
      const res = await fetch(
        `/api/notifications?limit=${notificationsPerPage}&offset=${offset}`
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);

        // Calculate total pages based on total count
        const totalNotifications =
          data.unread_count + (data.notifications?.length || 0);
        setTotalCount(totalNotifications);
        setTotalPages(Math.ceil(totalNotifications / notificationsPerPage));
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
      // Refresh to get updated counts
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
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

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // First page and previous buttons
    if (currentPage > 1) {
      buttons.push(
        <Button
          key="first"
          variant="outline"
          size="sm"
          onClick={() => goToPage(1)}
          className="h-8 w-8 p-0"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>,
        <Button
          key="prev"
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      );
    }

    // Page numbers
    for (let page = startPage; page <= endPage; page++) {
      buttons.push(
        <Button
          key={page}
          variant={currentPage === page ? "default" : "outline"}
          size="sm"
          onClick={() => goToPage(page)}
          className="h-8 w-8 p-0"
        >
          {page}
        </Button>
      );
    }

    // Next page and last page buttons
    if (currentPage < totalPages) {
      buttons.push(
        <Button
          key="next"
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>,
        <Button
          key="last"
          variant="outline"
          size="sm"
          onClick={() => goToPage(totalPages)}
          className="h-8 w-8 p-0"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      );
    }

    return buttons;
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

        {/* Stats */}
        <div className="mb-6 p-4 bg-white rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Notifications</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unread</p>
              <p className="text-2xl font-bold text-blue-600">
                {notifications.filter((n) => !n.is_read).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Page</p>
              <p className="text-2xl font-bold text-gray-900">
                {currentPage} of {totalPages}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        ) : notifications.length > 0 ? (
          <>
            {/* Notifications List */}
            <div className="space-y-4 mb-8">
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

                      {notification.sender_name && (
                        <p className="text-sm text-gray-600 mb-2">
                          From:{" "}
                          <span className="font-medium">
                            {notification.sender_name}
                          </span>
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {formatDateTime(notification.created_at)}
                        </span>
                        <div className="flex items-center gap-2">
                          {!notification.is_read && (
                            <Badge
                              variant="outline"
                              className="text-xs bg-green-50 text-green-700 border-green-200"
                            >
                              Unread
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-6">
                <div className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * notificationsPerPage + 1} to{" "}
                  {Math.min(currentPage * notificationsPerPage, totalCount)} of{" "}
                  {totalCount} notifications
                </div>
                <div className="flex items-center gap-1">
                  {renderPaginationButtons()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Go to page:</span>
                  <select
                    value={currentPage}
                    onChange={(e) => goToPage(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <option key={page} value={page}>
                          {page}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            )}
          </>
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
