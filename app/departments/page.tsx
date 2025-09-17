"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DepartmentFormDrawer } from "@/components/departments/department-form-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Building2,
  Search,
  Plus,
  Edit,
  Users,
  ArrowUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  user_count?: number;
  created_by?: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [sortConfig, setSortConfig] = useState<{
    key: keyof Department;
    direction: "asc" | "desc";
  } | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchDepartments();
  }, [user, router]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/departments");
      if (!response.ok) throw new Error("Failed to fetch");

      const { departments } = await response.json();
      setDepartments(departments ?? []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Could not load departments");
    } finally {
      setLoading(false);
    }
  };

  const sortedDepartments = useMemo(() => {
    let sortable = [...departments];
    if (sortConfig) {
      sortable.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || bValue === undefined) return 0;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortable;
  }, [departments, sortConfig]);

  const filteredDepartments = useMemo(() => {
    return sortedDepartments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedDepartments, searchTerm]);

  const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage);

  const paginatedDepartments = filteredDepartments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof Department) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleAddDepartment = () => {
    setEditingDepartment(null);
    setFormDrawerOpen(true);
  };

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setFormDrawerOpen(true);
  };

  const handleFormSuccess = () => {
    fetchDepartments();
  };

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
                  <h2 className="text-3xl font-bold text-gray-900">
                    Departments
                  </h2>
                  <p className="text-gray-600">
                    Manage organizational departments
                  </p>
                </div>
                <Button
                  onClick={handleAddDepartment}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </div>

              {/* Search */}
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search departments..."
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

              {/* Departments Table */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Departments ({filteredDepartments.length})
                  </CardTitle>
                  <CardDescription>
                    List of all organizational departments
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
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : filteredDepartments.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No departments found</p>
                      <p className="text-sm text-gray-500 mb-4">
                        Create your first department to get started
                      </p>
                      <Button
                        onClick={handleAddDepartment}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Department
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
                              Department{" "}
                              <ArrowUpDown className="inline h-3 w-3 ml-1" />
                            </TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>People Count</TableHead>
                            <TableHead>Created By</TableHead>
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
                          {paginatedDepartments.map((department, index) => (
                            <TableRow
                              key={department.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <TableCell className="font-medium">
                                {(currentPage - 1) * itemsPerPage + index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-primary" />
                                  <span className="font-medium">
                                    {department.name}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">
                                  {department.description || "-"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <span>{department.user_count || 0}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">
                                  {department.created_by ?? "System"}
                                </span>
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(department.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleEditDepartment(department)
                                  }
                                  className="hover:bg-primary/10 hover:border-primary hover:text-primary"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {!loading && filteredDepartments.length > 0 && (
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <DepartmentFormDrawer
        open={formDrawerOpen}
        onOpenChange={setFormDrawerOpen}
        onSuccess={handleFormSuccess}
        department={editingDepartment}
      />
      <Toaster position="top-right" />
    </div>
  );
}
