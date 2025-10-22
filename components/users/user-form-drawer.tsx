"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Save, Shield, Building2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  department_id: string;
  role_id?: string;
}

interface UserFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  user?: UserData | null;
}

export function UserFormDrawer({
  open,
  onOpenChange,
  onSuccess,
  user,
}: UserFormDrawerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingPermissions, setFetchingPermissions] = useState(false);
  const [hasLoadedUserPermissions, setHasLoadedUserPermissions] =
    useState(false);

  const isEditing = !!user;

  useEffect(() => {
    if (open) {
      fetchDepartments();
      fetchAllRoles();
      fetchAllPermissions();
      setHasLoadedUserPermissions(false); // Reset when opening form
    }
  }, [open]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setDepartmentId(user.department_id);
      setRoleId(user.role_id || "");
      setPassword(""); // Don't show password for editing

      // Fetch user permissions when editing
      if (user.id) {
        fetchUserPermissions(user.id);
      }
    } else {
      setName("");
      setEmail("");
      setPassword("");
      setDepartmentId("");
      setRoleId("");
      setSelectedPermissions([]);
      setHasLoadedUserPermissions(false);
    }
  }, [user]);

  // Filter roles when department changes
  useEffect(() => {
    if (departmentId) {
      fetchRolesByDepartment(departmentId);
    } else {
      setFilteredRoles([]);
      setRoleId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  // Fetch roles by department
  const fetchRolesByDepartment = async (deptId: string) => {
    try {
      console.log("Fetching roles for department:", deptId);
      const response = await fetch(
        `/api/roles/by-department?departmentId=${encodeURIComponent(deptId)}`
      );
      if (response.ok) {
        const json = await response.json();
        const roles: Role[] = (json?.roles as Role[]) || [];
        console.log("Roles for department:", roles);

        // Use all roles returned by API
        setFilteredRoles(roles);

        // If current role is not in the filtered list, clear it
        if (roleId && !roles.some((r: Role) => r.id === roleId)) {
          setRoleId("");
        }
      } else {
        console.error("Failed to fetch roles by department");
        setFilteredRoles([]);
      }
    } catch (error) {
      console.error("Error fetching roles by department:", error);
      setFilteredRoles([]);
    }
  };

  // Fetch user permissions when editing
  const fetchUserPermissions = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);
      if (response.ok) {
        const { user: userData } = await response.json();
        setSelectedPermissions(userData.permissions || []);
        setHasLoadedUserPermissions(true);
      }
    } catch (error) {
      console.error("Failed to fetch user permissions:", error);
      setHasLoadedUserPermissions(true);
    }
  };

  // Only fetch role permissions when creating a new user or when role changes for new users
  useEffect(() => {
    if (roleId && !isEditing) {
      // For new users, load role permissions when role is selected
      fetchRolePermissions(roleId);
    } else if (roleId && isEditing && hasLoadedUserPermissions) {
      // For editing users, only load role permissions if no custom permissions exist
      // This prevents overriding existing user permissions
      if (selectedPermissions.length === 0) {
        fetchRolePermissions(roleId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId, isEditing, hasLoadedUserPermissions]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const json = await response.json();
        const deps: Department[] = (json?.departments as Department[]) || [];
        setDepartments(deps);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchAllRoles = async () => {
    try {
      const response = await fetch("/api/roles");
      if (response.ok) {
        const json = await response.json();
        const roles: Role[] = (json?.roles as Role[]) || [];
        // Use all roles without filtering out Super Admin
        setAllRoles(roles);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const fetchAllPermissions = async () => {
    setFetchingPermissions(true);
    try {
      const response = await fetch("/api/permissions");
      if (response.ok) {
        const json = await response.json();
        const perms: Permission[] = (json?.permissions as Permission[]) || [];
        setPermissions(perms);
      }
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
    } finally {
      setFetchingPermissions(false);
    }
  };

  const fetchRolePermissions = async (roleId: string) => {
    try {
      const response = await fetch(
        `/api/roles/${encodeURIComponent(roleId)}/permissions`
      );
      if (response.ok) {
        const json = await response.json();
        const perms: Permission[] = (json?.permissions as Permission[]) || [];
        // Only set role permissions if we're not editing or if no custom permissions exist
        if (!isEditing || selectedPermissions.length === 0) {
          setSelectedPermissions(perms.map((p) => p.id));
        }
      }
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setDepartmentId("");
    setRoleId("");
    setSelectedPermissions([]);
    setHasLoadedUserPermissions(false);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  // Handle department change
  const handleDepartmentChange = (newDepartmentId: string) => {
    setDepartmentId(newDepartmentId);
    // Role will be automatically cleared by the useEffect above
  };

  // Handle role change - reset permissions only for new users
  const handleRoleChange = (newRoleId: string) => {
    setRoleId(newRoleId);
    // For new users, reset permissions when role changes
    if (!isEditing) {
      setSelectedPermissions([]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !departmentId || !roleId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isEditing && !password.trim()) {
      toast.error("Password is required for new users");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/users/${user?.id}` : "/api/users";

      const method = isEditing ? "PUT" : "POST";

      const body: any = {
        name: name.trim(),
        email: email.trim(),
        departmentId,
        roleId,
        permissions: selectedPermissions,
      };

      if (!isEditing) {
        body.password = password.trim();
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to ${isEditing ? "update" : "create"} user`
        );
      }

      toast.success(`User ${isEditing ? "updated" : "created"} successfully!`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`${isEditing ? "Update" : "Create"} user error:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isEditing ? "update" : "create"} user`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Format permission name for display
  const formatPermissionName = (permissionName: string): string => {
    const nameWithoutPrefix = permissionName.split(":")[1] || permissionName;
    return nameWithoutPrefix
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const permissionsByCategory = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isEditing ? "Edit User" : "Add New User"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the user information below."
              : "Create a new user by filling out the form below."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-full pr-6">
          <div className="space-y-6 mt-6 pb-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-700">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="focus:ring-primary focus:border-primary"
                />
              </div>

              {!isEditing && (
                <div>
                  <Label htmlFor="password" className="text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="focus:ring-primary focus:border-primary"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="department" className="text-gray-700">
                  Department <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={departmentId}
                  onValueChange={handleDepartmentChange}
                >
                  <SelectTrigger className="focus:ring-primary focus:border-primary">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role" className="text-gray-700">
                  Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={roleId}
                  onValueChange={handleRoleChange}
                  disabled={!departmentId}
                >
                  <SelectTrigger className="focus:ring-primary focus:border-primary">
                    <SelectValue
                      placeholder={
                        !departmentId
                          ? "Select department first"
                          : filteredRoles.length === 0
                          ? "No roles available for this department"
                          : "Select role"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {filteredRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {role.name}
                          {role.description && (
                            <span className="text-xs text-gray-500 ml-1">
                              - {role.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!departmentId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Please select a department first to see available roles
                  </p>
                )}
                {departmentId && filteredRoles.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    No roles available for the selected department. Please
                    create roles for this department first.
                  </p>
                )}
              </div>
            </div>

            {/* Permissions Section */}
            {roleId && (
              <div>
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Permissions
                  {isEditing && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      ({selectedPermissions.length} selected)
                    </span>
                  )}
                </Label>
                <p className="text-sm text-gray-500 mb-4">
                  {isEditing
                    ? "Custom permissions for this user. Uncheck to remove, check to add permissions."
                    : "Permissions inherited from the selected role. You can customize them."}
                </p>

                {fetchingPermissions ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">Loading permissions...</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-4">
                      {Object.entries(permissionsByCategory).map(
                        ([category, categoryPermissions]) => (
                          <div key={category}>
                            <h4 className="font-medium text-sm text-gray-900 mb-2">
                              {category}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {categoryPermissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="flex items-center space-x-2 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  <Checkbox
                                    id={`permission-${permission.id}`}
                                    checked={selectedPermissions.includes(
                                      permission.id
                                    )}
                                    onCheckedChange={() =>
                                      handlePermissionToggle(permission.id)
                                    }
                                  />
                                  <label
                                    htmlFor={`permission-${permission.id}`}
                                    className="text-sm font-medium leading-none cursor-pointer flex-1"
                                  >
                                    {formatPermissionName(permission.name)}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={
                  !name.trim() ||
                  !email.trim() ||
                  !departmentId ||
                  !roleId ||
                  (!isEditing && !password.trim()) ||
                  isLoading
                }
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                  ? "Update User"
                  : "Create User"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
