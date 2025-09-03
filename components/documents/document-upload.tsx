"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAuth } from "@/hooks/use-auth";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "react-hot-toast";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  full_name: string;
}

export function DocumentUpload() {
  const [title, setTitle] = useState("");
  const [assignmentType, setAssignmentType] = useState<"user" | "department">(
    "department"
  );
  const [assignedToUser, setAssignedToUser] = useState("");
  const [assignedToDepartment, setAssignedToDepartment] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { profile } = useAuth();

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

  const uploadDocument = async () => {
    if (!selectedFile || !title || !profile) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (assignmentType === "user" && !assignedToUser) {
      toast.error("Please select a user to assign to");
      return;
    }

    if (assignmentType === "department" && !assignedToDepartment) {
      toast.error("Please select a department to assign to");
      return;
    }

    setIsUploading(true);

    try {
      // Upload document via API
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title);
      formData.append("assignmentType", assignmentType);
      if (assignmentType === "user") {
        formData.append("assignedToUser", assignedToUser);
      } else {
        formData.append("assignedToDepartment", assignedToDepartment);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      toast.success("Document uploaded successfully!");

      // Reset form
      setTitle("");
      setSelectedFile(null);
      setAssignedToUser("");
      setAssignedToDepartment("");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Upload a PDF document and assign it to users or departments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
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

          {/* Document Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Document Title</Label>
              <Input
                id="title"
                placeholder="Enter document title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Assignment Type */}
            <div>
              <Label>Assignment Type</Label>
              <Select
                value={assignmentType}
                onValueChange={(value: "user" | "department") =>
                  setAssignmentType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Assign to User</SelectItem>
                  <SelectItem value="department">
                    Assign to Department
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Target */}
            {assignmentType === "user" ? (
              <div>
                <Label>Assign to User</Label>
                <Select
                  value={assignedToUser}
                  onValueChange={setAssignedToUser}
                  onOpenChange={fetchUsers}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Assign to Department</Label>
                <Select
                  value={assignedToDepartment}
                  onValueChange={setAssignedToDepartment}
                  onOpenChange={fetchDepartments}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

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
  );
}
