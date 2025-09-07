"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, X, Users, Building2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  department_id: string;
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentType, setAssignmentType] = useState<"user" | "department">("department");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetchDepartments();
    fetchUsers();
  }, [user, router]);

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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const { users } = await response.json();
        setUsers(users);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
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

  const handleUserSelection = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  const handleDepartmentSelection = (deptId: string, checked: boolean) => {
    if (checked) {
      setSelectedDepartments([...selectedDepartments, deptId]);
    } else {
      setSelectedDepartments(selectedDepartments.filter(id => id !== deptId));
    }
  };

  const uploadDocument = async () => {
    if (!selectedFile || !title || !user) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (assignmentType === "user" && selectedUsers.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    if (assignmentType === "department" && selectedDepartments.length === 0) {
      toast.error("Please select at least one department");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("assignmentType", assignmentType);
      
      if (assignmentType === "user") {
        selectedUsers.forEach(userId => {
          formData.append("assignedUsers", userId);
        });
      } else {
        selectedDepartments.forEach(deptId => {
          formData.append("assignedDepartments", deptId);
        });
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
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
      
      setTimeout(() => {
        router.push("/documents");
      }, 1000);

    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Document
            </CardTitle>
            <CardDescription>
              Upload a PDF document and assign it to users or departments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

            {/* Assignment Type */}
            <div>
              <Label>Assignment Type *</Label>
              <Select
                value={assignmentType}
                onValueChange={(value: "user" | "department") => {
                  setAssignmentType(value);
                  setSelectedUsers([]);
                  setSelectedDepartments([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Assign to Users
                    </div>
                  </SelectItem>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Assign to Departments
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            {assignmentType === "user" && (
              <div>
                <Label>Select Users *</Label>
                <Card className="p-4">
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) =>
                            handleUserSelection(user.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`user-${user.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {user.name} ({user.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedUsers.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedUsers.length} user(s) selected
                    </p>
                  )}
                </Card>
              </div>
            )}

            {/* Department Selection */}
            {assignmentType === "department" && (
              <div>
                <Label>Select Departments *</Label>
                <Card className="p-4">
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {departments.map((dept) => (
                      <div key={dept.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dept-${dept.id}`}
                          checked={selectedDepartments.includes(dept.id)}
                          onCheckedChange={(checked) =>
                            handleDepartmentSelection(dept.id, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`dept-${dept.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {dept.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedDepartments.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedDepartments.length} department(s) selected
                    </p>
                  )}
                </Card>
              </div>
            )}

            {/* File Upload Area */}
            <div>
              <Label>Upload PDF File *</Label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : selectedFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                )}
              >
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="flex items-center justify-center space-x-2">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-green-700">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-green-600">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
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
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700">
                      {isDragActive
                        ? "Drop your PDF here"
                        : "Drag & drop a PDF file here"}
                    </p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                )}
              </div>
            </div>

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

            <Button
              onClick={uploadDocument}
              disabled={!selectedFile || !title || isUploading}
              className="w-full"
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}