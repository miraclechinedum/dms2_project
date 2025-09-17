"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { UserFormDrawer } from "@/components/users/user-form-drawer";
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
import {
  Users,
  Search,
  Plus,
  Edit,
  User,
  Building2,
  ArrowUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface UserData {
  id: string;
  name: string;
  email: string;
  department_id: string;
  department_name?: string;
  created_at: string;
  created_by_name?: string;
}

type SortKey =
  | "name"
  | "email"
  | "department_name"
  | "created_by_name"
  | "created_at";

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  // Pagination + sorting
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: "asc" | "desc";
  } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const { users } = await response.json();
        setUsers(users ?? []);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users");
    }
    setLoading(false);
  };

  // Filtering + sorting memoized
  const filteredAndSortedUsers = useMemo(() => {
    // Filter
    const q = searchTerm.trim().toLowerCase();
    let arr = users.filter((u) => {
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.department_name ?? "").toLowerCase().includes(q) ||
        (u.created_by_name ?? "").toLowerCase().includes(q)
      );
    });

    // Sort
    if (sortConfig) {
      const { key, direction } = sortConfig;
      arr.sort((a, b) => {
        let va: any = (a as any)[key];
        let vb: any = (b as any)[key];

        // Normalize for dates
        if (key === "created_at") {
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        } else {
          va = (va ?? "").toString().toLowerCase();
          vb = (vb ?? "").toString().toLowerCase();
        }

        if (va < vb) return direction === "asc" ? -1 : 1;
        if (va > vb) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return arr;
  }, [users, searchTerm, sortConfig]);

  // Pagination derived values
  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedUsers.length / itemsPerPage)
  );
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedUsers.slice(start, start + itemsPerPage);
  }, [filteredAndSortedUsers, currentPage]);

  // reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, users.length, sortConfig]);

  const handleAddUser = () => {
    setEditingUser(null);
    setFormDrawerOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setFormDrawerOpen(true);
  };

  const handleFormSuccess = () => {
    fetchUsers();
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const getPageNumbers = () => {
    const maxButtons = 5;
    const pages: number[] = [];
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // Loading skeleton UI
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Users</h2>
                    <p className="text-gray-600">
                      Manage system users and their access
                    </p>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>

                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input placeholder="Search users..." className="pl-10" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Users
                    </CardTitle>
                    <CardDescription>List of all system users</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">S/N</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead>Date Created</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {Array.from({ length: 8 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-6" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-36" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-48" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-8 w-16 rounded-md" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-auto p-6 page-transition">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Users</h2>
                  <p className="text-gray-600">
                    Manage system users and their access
                  </p>
                </div>
                <Button
                  onClick={handleAddUser}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>

              {/* Search */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Users Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Users ({filteredAndSortedUsers.length})
                  </CardTitle>
                  <CardDescription>List of all system users</CardDescription>
                </CardHeader>

                <CardContent>
                  {filteredAndSortedUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No users found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Add your first user to get started
                      </p>
                      <Button
                        onClick={handleAddUser}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add User
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">S/N</TableHead>

                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("name")}
                            >
                              Name{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>

                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("email")}
                            >
                              Email{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>

                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("department_name")}
                            >
                              Department{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>

                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("created_by_name")}
                            >
                              Created By{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>

                            <TableHead
                              className="cursor-pointer"
                              onClick={() => handleSort("created_at")}
                            >
                              Date Created{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>

                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {paginatedUsers.map((userData, index) => (
                            <TableRow
                              key={userData.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="font-medium">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-primary" />
                                  <span className="font-medium">
                                    {userData.name}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <span className="text-gray-600">
                                  {userData.email}
                                </span>
                              </TableCell>

                              <TableCell>
                                {userData.department_name ? (
                                  <Badge
                                    variant="outline"
                                    className="flex items-center gap-1 w-fit"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {userData.department_name}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>

                              <TableCell>
                                <span className="text-gray-600">
                                  {userData.created_by_name ?? "System"}
                                </span>
                              </TableCell>

                              <TableCell>
                                {format(
                                  new Date(userData.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </TableCell>

                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditUser(userData)}
                                  className="hover:bg-primary/10 hover:border-primary hover:text-primary"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Pagination */}
                      <div className="flex justify-between items-center mt-4">
                        <p className="text-sm text-gray-600">
                          Showing {(currentPage - 1) * itemsPerPage + 1} -{" "}
                          {Math.min(
                            currentPage * itemsPerPage,
                            filteredAndSortedUsers.length
                          )}{" "}
                          of {filteredAndSortedUsers.length}
                        </p>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                          >
                            Previous
                          </Button>

                          {getPageNumbers().map((p) => (
                            <Button
                              key={p}
                              size="sm"
                              variant={
                                p === currentPage ? undefined : "outline"
                              }
                              className={
                                p === currentPage ? "bg-primary text-white" : ""
                              }
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </Button>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <UserFormDrawer
        open={formDrawerOpen}
        onOpenChange={setFormDrawerOpen}
        onSuccess={handleFormSuccess}
        user={editingUser}
      />
      <Toaster position="top-right" />
    </div>
  );
}
