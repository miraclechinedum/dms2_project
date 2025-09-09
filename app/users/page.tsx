"use client";

import { useState, useEffect } from "react";
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
import { Users, Search, Plus, Edit, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import { Toaster } from "react-hot-toast";

interface UserData {
  id: string;
  name: string;
  email: string;
  department_id: string;
  department_name?: string;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchUsers();
  }, [user, router]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const { users } = await response.json();
        setUsers(users);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users");
    }
    setLoading(false);
  };

  const filterUsers = () => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter((user) =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.department_name && user.department_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredUsers(filtered);
  };

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
                <p className="text-gray-600">Loading users...</p>
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
                  <h2 className="text-3xl font-bold text-gray-900">Users</h2>
                  <p className="text-gray-600">Manage system users and their access</p>
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
                    Users ({filteredUsers.length})
                  </CardTitle>
                  <CardDescription>
                    List of all system users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredUsers.length === 0 ? (
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
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Date Created</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map((userData, index) => (
                            <TableRow key={userData.id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{userData.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">{userData.email}</span>
                              </TableCell>
                              <TableCell>
                                {userData.department_name ? (
                                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                    <Building2 className="h-3 w-3" />
                                    {userData.department_name}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-gray-600">System</span>
                              </TableCell>
                              <TableCell>
                                {format(new Date(userData.created_at), "MMM dd, yyyy")}
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