"use client";

import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, FileText } from "lucide-react";
import { format } from "date-fns";

export function NotificationCenter() {
  const { profile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications(profile?.id);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "document_assigned":
      case "document_updated":
        return <FileText className="h-4 w-4" />;
      case "annotation_added":
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "document_assigned":
        return "bg-blue-100 text-blue-800";
      case "annotation_added":
        return "bg-green-100 text-green-800";
      case "document_updated":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle>Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No notifications yet</p>
                <p className="text-sm text-gray-500">
                  You'll see updates about documents and annotations here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !notification.is_read
                        ? "ring-2 ring-blue-200 bg-blue-50"
                        : ""
                    }`}
                    onClick={() =>
                      !notification.is_read && markAsRead(notification.id)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div
                          className={`p-2 rounded-full ${getNotificationColor(
                            notification.type
                          )}`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="outline"
                              className={getNotificationColor(
                                notification.type
                              )}
                            >
                              {notification.type.replace("_", " ")}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {format(
                                new Date(notification.created_at),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </span>
                          </div>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
