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
import { User, Save } from "lucide-react";
import { toast } from "react-hot-toast";

interface Department {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  department_id: string;
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!user;

  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setDepartmentId(user.department_id);
      setPassword(""); // Don't show password for editing
    } else {
      setName("");
      setEmail("");
      setPassword("");
      setDepartmentId("");
    }
  }, [user]);

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

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setDepartmentId("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !departmentId) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isEditing && !password.trim()) {
      toast.error("Password is required for new users");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing 
        ? `/api/users/${user.id}`
        : '/api/users';
      
      const method = isEditing ? 'PUT' : 'POST';

      const body: any = {
        name: name.trim(),
        email: email.trim(),
        departmentId,
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
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} user`);
      }

      toast.success(`User ${isEditing ? 'updated' : 'created'} successfully!`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`${isEditing ? 'Update' : 'Create'} user error:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} user`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit User' : 'Add New User'}
          </SheetTitle>
          <SheetDescription>
            {isEditing 
              ? 'Update the user information below.'
              : 'Create a new user by filling out the form below.'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
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
              <Label htmlFor="email">Email Address *</Label>
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
                <Label htmlFor="password">Password *</Label>
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
              <Label htmlFor="department">Department *</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="focus:ring-primary focus:border-primary">
                  <SelectValue placeholder="Select department" />
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
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !email.trim() || !departmentId || (!isEditing && !password.trim()) || isLoading}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading 
                ? (isEditing ? "Updating..." : "Creating...") 
                : (isEditing ? "Update User" : "Create User")
              }
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
      </SheetContent>
    </Sheet>
  );
}