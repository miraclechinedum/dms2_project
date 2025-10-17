// app/roles/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
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
  Search,
  Plus,
  Edit,
  Shield,
  Users,
  Key,
  ArrowUpDown,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleFormDrawer } from "@/components/roles/role-form-drawer";

interface Role {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  permission_count: number;
  user_count: number;
  created_at: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Role;
    direction: "asc" | "desc";
  } | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchRoles();
  }, [user, router]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/roles");
      if (!response.ok) throw new Error("Failed to fetch roles");

      const { roles } = await response.json();
      setRoles(roles ?? []);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Could not load roles");
    } finally {
      setLoading(false);
    }
  };

  const sortedRoles = useMemo(() => {
    let sortable = [...roles];
    if (sortConfig) {
      sortable.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || bValue === undefined) return 0;

        // Handle department_name sorting
        if (sortConfig.key === "department_name") {
          const aDept = a.department_name || "";
          const bDept = b.department_name || "";
          if (aDept < bDept) return sortConfig.direction === "asc" ? -1 : 1;
          if (aDept > bDept) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }

        // Handle other fields
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [roles, sortConfig]);

  const filteredRoles = useMemo(() => {
    return sortedRoles.filter(
      (role) =>
        role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedRoles, searchTerm]);

  const totalPages = Math.ceil(filteredRoles.length / itemsPerPage);

  const paginatedRoles = filteredRoles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof Role) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setFormDrawerOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormDrawerOpen(true);
  };

  const handleFormSuccess = () => {
    fetchRoles();
    setFormDrawerOpen(false);
  };

  // Small page number rendering (show up to 5)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-auto p-6 page-transition">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Roles & Permissions
                  </h2>
                  <p className="text-gray-600">
                    Manage user roles and their permissions
                  </p>
                </div>
                <Button
                  onClick={handleAddRole}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </div>

              {/* Search */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search roles..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Roles Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Roles ({filteredRoles.length})
                  </CardTitle>
                  <CardDescription>
                    List of all system roles with their departments and
                    permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-4 items-center">
                          <Skeleton className="h-5 w-10" />
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-5 w-60" />
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No roles found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Create your first role to get started
                      </p>
                      <Button
                        onClick={handleAddRole}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Role
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">S/N</TableHead>
                            <TableHead
                              onClick={() => handleSort("name")}
                              className="cursor-pointer"
                            >
                              Role Name{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>
                            <TableHead
                              onClick={() => handleSort("department_name")}
                              className="cursor-pointer"
                            >
                              Department{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead>Users</TableHead>
                            <TableHead
                              onClick={() => handleSort("created_at")}
                              className="cursor-pointer"
                            >
                              Date Created{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRoles.map((role, index) => (
                            <TableRow
                              key={role.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="font-medium">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-primary" />
                                  <div>
                                    <span className="font-medium">
                                      {role.name}
                                    </span>
                                    {role.description && (
                                      <p className="text-xs text-gray-500">
                                        {role.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {role.department_name ? (
                                  <Badge
                                    variant="outline"
                                    className="flex items-center gap-1 w-fit"
                                  >
                                    <Building2 className="h-3 w-3" />
                                    {role.department_name}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Key className="h-4 w-4 text-gray-400" />
                                  <span>{role.permission_count}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <span>{role.user_count}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(role.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditRole(role)}
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
                      {!loading && filteredRoles.length > 0 && (
                        <div className="flex justify-between items-center mt-4">
                          <p className="text-sm text-gray-600">
                            Showing {(currentPage - 1) * itemsPerPage + 1} -{" "}
                            {Math.min(
                              currentPage * itemsPerPage,
                              filteredRoles.length
                            )}{" "}
                            of {filteredRoles.length}
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
                                  p === currentPage
                                    ? "bg-primary text-white"
                                    : ""
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
                                setCurrentPage((p) =>
                                  Math.min(totalPages, p + 1)
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <RoleFormDrawer
        open={formDrawerOpen}
        onOpenChange={setFormDrawerOpen}
        onSuccess={handleFormSuccess}
        role={editingRole}
      />
      <Toaster position="top-right" />
    </div>
  );
}
