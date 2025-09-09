"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Building2, Save } from "lucide-react";
import { toast } from "react-hot-toast";

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface DepartmentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  department?: Department | null;
}

export function DepartmentFormDrawer({
  open,
  onOpenChange,
  onSuccess,
  department,
}: DepartmentFormDrawerProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!department;

  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [department]);

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing 
        ? `/api/departments/${department.id}`
        : '/api/departments';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} department`);
      }

      toast.success(`Department ${isEditing ? 'updated' : 'created'} successfully!`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(`${isEditing ? 'Update' : 'Create'} department error:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} department`
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
            <Building2 className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Department' : 'Add New Department'}
          </SheetTitle>
          <SheetDescription>
            {isEditing 
              ? 'Update the department information below.'
              : 'Create a new department by filling out the form below.'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Department Name *</Label>
              <Input
                id="name"
                placeholder="Enter department name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter department description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || isLoading}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading 
                ? (isEditing ? "Updating..." : "Creating...") 
                : (isEditing ? "Update Department" : "Create Department")
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