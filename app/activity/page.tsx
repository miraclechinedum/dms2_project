"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, FileText, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Toaster } from "react-hot-toast";

interface ActivityLog {
  id: string;
  document_id: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
  user_name?: string;
  document_title?: string;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchActivities();
  }, [user, router]);

  const fetchActivities = async () => {
    try {
      const response = await fetch("/api/activity");
      if (response.ok) {
        const { activities } = await response.json();
        setActivities(activities);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "document_uploaded":
        return <FileText className="h-4 w-4" />;
      case "annotation_added":
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "document_uploaded":
        return "bg-blue-100 text-blue-800";
      case "annotation_added":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Activity Log</h2>
            <p className="text-gray-600">Track all system activities and changes</p>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {activities.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No activities found</p>
                    <p className="text-sm text-gray-500">
                      System activities will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                activities.map((activity) => (
                  <Card key={activity.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-full ${getActionColor(activity.action)}`}>
                          {getActionIcon(activity.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge className={getActionColor(activity.action)}>
                              {activity.action.replace("_", " ")}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              by {activity.user_name}
                            </span>
                          </div>
                          {activity.document_title && (
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              Document: {activity.document_title}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(activity.created_at), "MMM dd, yyyy HH:mm")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}