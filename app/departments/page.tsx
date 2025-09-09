"use client";

import { useState, useEffect } from "react";
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
import { Building2, Search, Plus, Edit, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";

interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  user_count?: number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchDepartments();
  }, [user, router]);

  useEffect(() => {
    filterDepartments();
  }, [departments, searchTerm]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const { departments } = await response.json();
        setDepartments(departments);
      } else {
        toast.error("Failed to fetch departments");
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to fetch departments");
    }
    setLoading(false);
  };

  const filterDepartments = () => {
    let filtered = departments;

    if (searchTerm) {
      filtered = filtered.filter((dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredDepartments(filtered);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading departments...</p>
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
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 overflow-auto p-6 page-transition">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Departments</h2>
                  <p className="text-gray-600">Manage organizational departments</p>
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
                      onChange={(e) => setSearchTerm(e.target.value)}
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
                  {filteredDepartments.length === 0 ? (
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
                            <TableHead>Department</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>People Count</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Date Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDepartments.map((department, index) => (
                            <TableRow key={department.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{department.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">
                                  {department.description || '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-gray-400" />
                                  <span>{department.user_count || 0}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">System</span>
                              </TableCell>
                              <TableCell>
                                {format(new Date(department.created_at), "MMM dd, yyyy")}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditDepartment(department)}
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