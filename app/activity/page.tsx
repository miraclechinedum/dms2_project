"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Calendar, Filter, FileText, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
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

interface ActivityStats {
  currentMonth: number;
  currentDay: number;
  currentWeek: number;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    currentMonth: 0,
    currentDay: 0,
    currentWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchActivities();
  }, [user, router]);

  const fetchActivities = async (dateRange?: {
    start: string;
    end: string;
  }) => {
    setLoading(true);
    try {
      let url = "/api/activity";
      if (dateRange) {
        url += `?startDate=${dateRange.start}&endDate=${dateRange.end}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const { activities, stats } = await response.json();
        setActivities(activities);
        setStats(stats);
      } else {
        toast.error("Failed to fetch activities");
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
      toast.error("Failed to fetch activities");
    }
    setLoading(false);
  };

  const handleDateFilter = () => {
    if (startDate && endDate) {
      fetchActivities({ start: startDate, end: endDate });
    } else {
      fetchActivities();
    }
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    fetchActivities();
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
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <div className="flex-1 flex flex-col">
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading activities...</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-auto p-6 page-transition">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Activity Log
                </h2>
                <p className="text-gray-600">
                  Track all system activities and changes
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      This Month
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {stats.currentMonth}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total activities
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                    <Activity className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {stats.currentDay}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Activities today
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      This Week
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {stats.currentWeek}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Activities this week
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Date Range Filter */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        End Date
                      </label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <Button
                      onClick={handleDateFilter}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" onClick={clearDateFilter}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Activities Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Activities ({activities.length})
                  </CardTitle>
                  <CardDescription>
                    Recent system activities and changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No activities found</p>
                      <p className="text-sm text-gray-500">
                        System activities will appear here
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">S/N</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Document</TableHead>
                            <TableHead>Date & Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activities.map((activity, index) => (
                            <TableRow
                              key={activity.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-1 rounded-full ${getActionColor(
                                      activity.action
                                    )}`}
                                  >
                                    {getActionIcon(activity.action)}
                                  </div>
                                  <Badge
                                    className={getActionColor(activity.action)}
                                  >
                                    {activity.action.replace("_", " ")}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-gray-400" />
                                  <span>{activity.user_name || "Unknown"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {activity.document_title ? (
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="truncate max-w-xs">
                                      {activity.document_title}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  <span>
                                    {format(
                                      new Date(activity.created_at),
                                      "MMM dd, yyyy HH:mm"
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
