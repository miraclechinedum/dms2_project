// components/documents/document-upload-drawer.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  X,
  Search,
  Shield,
  Building2,
  User,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

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

interface User {
  id: string;
  name: string;
  email: string;
  role_id: string;
}

interface DocumentUploadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess: () => void;
}

export function DocumentUploadDrawer({
  open,
  onOpenChange,
  onUploadSuccess,
}: DocumentUploadDrawerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (open) {
      fetchDepartments();
      fetchAllRoles();
    }
  }, [open]);

  // Filter roles when department changes
  useEffect(() => {
    if (selectedDepartment) {
      const rolesForDepartment = allRoles.filter(
        (role) => role.department_id === selectedDepartment
      );
      setFilteredRoles(rolesForDepartment);

      // If current role is not in the filtered list, clear it
      if (
        selectedRole &&
        !rolesForDepartment.some((role) => role.id === selectedRole)
      ) {
        setSelectedRole("");
        setSelectedUser("");
        setUsers([]);
        setFilteredUsers([]);
      }
    } else {
      setFilteredRoles([]);
      setSelectedRole("");
      setSelectedUser("");
      setUsers([]);
      setFilteredUsers([]);
    }
  }, [selectedDepartment, allRoles, selectedRole]);

  // Fetch users when role is selected
  useEffect(() => {
    if (selectedRole) {
      fetchUsersByRole(selectedRole);
    } else {
      setUsers([]);
      setFilteredUsers([]);
      setSelectedUser("");
    }
  }, [selectedRole]);

  // Filter roles by search query
  useEffect(() => {
    if (searchQuery) {
      const filtered = filteredRoles.filter(
        (role) =>
          role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          role.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRoles(filtered);
    } else if (selectedDepartment) {
      // Reset to department-filtered roles when search is cleared
      const rolesForDepartment = allRoles.filter(
        (role) => role.department_id === selectedDepartment
      );
      setFilteredRoles(rolesForDepartment);
    }
  }, [searchQuery, selectedDepartment, allRoles]);

  // Filter users by search query
  useEffect(() => {
    if (userSearchQuery) {
      const filtered = users.filter(
        (user) =>
          user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [userSearchQuery, users]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const { departments } = await response.json();
        setDepartments(departments);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchAllRoles = async () => {
    try {
      const response = await fetch("/api/roles");
      if (response.ok) {
        const { roles } = await response.json();
        setAllRoles(roles);
      }
    } catch (error) {
      console.error("Failed to fetch roles:", error);
    }
  };

  const fetchUsersByRole = async (roleId: string) => {
    try {
      const response = await fetch(`/api/users/by-role?roleId=${roleId}`);
      if (response.ok) {
        const { users } = await response.json();
        setUsers(users);
        setFilteredUsers(users);
      }
    } catch (error) {
      console.error("Failed to fetch users by role:", error);
      setUsers([]);
      setFilteredUsers([]);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && file.type === "application/pdf") {
        setSelectedFile(file);
        if (!title) {
          setTitle(file.name.replace(".pdf", ""));
        }
      } else {
        toast.error("Please upload a PDF file only");
      }
    },
    [title]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setSelectedDepartment("");
    setSelectedRole("");
    setSelectedUser("");
    setSearchQuery("");
    setUserSearchQuery("");
    setUploadProgress(0);
  };

  const handleDepartmentChange = (newDepartmentId: string) => {
    setSelectedDepartment(newDepartmentId);
    setSelectedRole("");
    setSelectedUser("");
    setUsers([]);
    setFilteredUsers([]);
  };

  const handleRoleChange = (newRoleId: string) => {
    setSelectedRole(newRoleId);
    setSelectedUser("");
  };

  const uploadDocument = async () => {
    if (!selectedFile || !title || !currentUser) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedDepartment) {
      toast.error("Please select a department");
      return;
    }

    if (!selectedRole) {
      toast.error("Please select a role to assign the document to");
      return;
    }

    if (!selectedUser) {
      toast.error("Please select a user to assign the document to");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("assignmentType", "role");
      formData.append("assignedRole", selectedRole);
      formData.append("selectedUser", selectedUser); // FIXED: Changed from assignedUser to selectedUser

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      toast.success("Document uploaded successfully!");
      resetForm();
      onUploadSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Document
          </SheetTitle>
          <SheetDescription>
            Upload a PDF document and assign it to a specific user within a role
            and department
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* File Upload Area */}
          <div>
            <Label>Upload PDF File *</Label>
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mt-2",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : selectedFile
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:border-gray-400"
              )}
            >
              <input {...getInputProps({ form: undefined })} />
              {selectedFile ? (
                <div className="flex items-center justify-center space-x-2">
                  <FileText className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-green-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="font-medium text-gray-700">
                    {isDragActive
                      ? "Drop your PDF here"
                      : "Drag & drop a PDF file here"}
                  </p>
                  <p className="text-sm text-gray-500">or click to browse</p>
                </div>
              )}
            </div>
          </div>

          {/* Document Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Document Title *</Label>
              <Input
                id="title"
                placeholder="Enter document title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter document description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Department Selection */}
          <div>
            <Label htmlFor="department">Department *</Label>
            <Select
              value={selectedDepartment}
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
            {!selectedDepartment && (
              <p className="text-xs text-gray-500 mt-1">
                Please select a department first to see available roles
              </p>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <Label>Assign to Role *</Label>
            <div className="space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search roles by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={!selectedDepartment}
                />
              </div>

              {/* Role List */}
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-3">
                  {filteredRoles.length > 0 ? (
                    filteredRoles.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center space-x-3 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRoleChange(role.id)}
                      >
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            selectedRole === role.id
                              ? "bg-primary border-primary"
                              : "border-gray-300"
                          )}
                        >
                          {selectedRole === role.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            {role.name}
                          </p>
                          {role.description && (
                            <p className="text-xs text-gray-600">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : selectedDepartment ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No roles found for this department
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Please select a department first
                    </p>
                  )}
                </div>
                {selectedRole && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected Role:{" "}
                    {allRoles.find((r) => r.id === selectedRole)?.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* User Selection (only shown when role is selected) */}
          {selectedRole && (
            <div>
              <Label>Assign to Specific User *</Label>
              <div className="space-y-3">
                {/* User Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* User List */}
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-3">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-3 p-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedUser(user.id)}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                              selectedUser === user.id
                                ? "bg-primary border-primary"
                                : "border-gray-300"
                            )}
                          >
                            {selectedUser === user.id && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No users found with this role
                      </p>
                    )}
                  </div>
                  {selectedUser && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected User:{" "}
                      {users.find((u) => u.id === selectedUser)?.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={uploadDocument}
              disabled={
                !selectedFile ||
                !title ||
                !selectedDepartment ||
                !selectedRole ||
                !selectedUser ||
                isUploading
              }
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
