// components/roles/role-form-drawer.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Save, Building2 } from "lucide-react";
import { toast } from "react-hot-toast";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  permission_count: number;
}

interface RoleFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  role?: Role | null;
}

export function RoleFormDrawer({
  open,
  onOpenChange,
  onSuccess,
  role,
}: RoleFormDrawerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingPermissions, setFetchingPermissions] = useState(false);
  const [fetchingDepartments, setFetchingDepartments] = useState(false);

  const isEditing = !!role;

  useEffect(() => {
    if (open) {
      fetchPermissions();
      fetchDepartments();
      if (isEditing && role) {
        setName(role.name);
        setDescription(role.description || "");
        setDepartmentId(role.department_id || "");
        fetchRolePermissions(role.id);
      } else {
        setName("");
        setDescription("");
        setDepartmentId("");
        setSelectedPermissions([]);
      }
    }
  }, [open, isEditing, role]);

  const fetchPermissions = async () => {
    setFetchingPermissions(true);
    try {
      const response = await fetch("/api/permissions");
      if (response.ok) {
        const { permissions } = await response.json();
        setPermissions(permissions || []);
      }
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      toast.error("Failed to load permissions");
    } finally {
      setFetchingPermissions(false);
    }
  };

  const fetchDepartments = async () => {
    setFetchingDepartments(true);
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const { departments } = await response.json();
        setDepartments(departments || []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to load departments");
    } finally {
      setFetchingDepartments(false);
    }
  };

  const fetchRolePermissions = async (roleId: string) => {
    try {
      const response = await fetch(`/api/roles/${roleId}/permissions`);
      if (response.ok) {
        const { permissions } = await response.json();
        setSelectedPermissions(permissions.map((p: Permission) => p.id));
      }
    } catch (error) {
      console.error("Failed to fetch role permissions:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setDepartmentId("");
    setSelectedPermissions([]);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }

    if (!departmentId) {
      toast.error("Please select a department");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/roles/${role.id}` : "/api/roles";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          departmentId: departmentId,
          permissions: selectedPermissions,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to save role");
      }

      toast.success(`Role ${isEditing ? "updated" : "created"} successfully!`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving role:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save role"
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
            <Shield className="h-5 w-5 text-primary" />
            {isEditing ? "Edit Role" : "Create New Role"}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? "Update role details" : "Create a new role"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-full pr-6">
          <div className="space-y-6 mt-6 pb-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-700">
                  Role Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Enter role name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <Label htmlFor="department" className="text-gray-700">
                  Department <span className="text-red-500">*</span>
                </Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
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

              {/* <div>
                <Label htmlFor="description" className="text-gray-700">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Enter role description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="focus:ring-primary focus:border-primary resize-none"
                />
              </div> */}
            </div>

            {/* Permissions Section */}
            {/* <div>
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
                Select the permissions for this role
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
            </div> */}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !departmentId || isLoading}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                  ? "Update Role"
                  : "Create Role"}
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
