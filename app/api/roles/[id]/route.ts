// app/api/roles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { name, description, departmentId, permissions } =
      await request.json();

    console.log("Updating role:", {
      id: params.id,
      name,
      description,
      departmentId,
      permissions,
    });

    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 }
      );
    }

    // Check if role exists
    const existingRole = await DatabaseService.query(
      "SELECT id FROM roles WHERE id = ?",
      [params.id]
    );

    if (existingRole.length === 0) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Update role
    await DatabaseService.query(
      "UPDATE roles SET name = ?, description = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description || null, departmentId, params.id]
    );

    console.log("Role updated, now updating permissions...");

    // Update permissions - delete existing ones first
    await DatabaseService.query(
      "DELETE FROM role_permissions WHERE role_id = ?",
      [params.id]
    );

    console.log("Existing permissions deleted");

    // Insert new permissions if any
    if (permissions && permissions.length > 0) {
      console.log("Adding new permissions:", permissions);

      for (const permissionId of permissions) {
        try {
          await DatabaseService.query(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            [params.id, permissionId]
          );
        } catch (insertError) {
          console.error(
            `Failed to insert permission ${permissionId}:`,
            insertError
          );
          // Continue with other permissions even if one fails
        }
      }

      console.log("Permissions updated successfully");
    } else {
      console.log("No permissions to add");
    }

    return NextResponse.json({
      message: "Role updated successfully",
    });
  } catch (error) {
    console.error("Update role error:", error);

    let errorMessage = "Failed to update role";
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if role has users
    const usersWithRole = await DatabaseService.query(
      "SELECT id FROM user_roles WHERE role_id = ? LIMIT 1",
      [params.id]
    );

    if (usersWithRole.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role that has users assigned" },
        { status: 400 }
      );
    }

    await DatabaseService.query("DELETE FROM roles WHERE id = ?", [params.id]);

    return NextResponse.json({
      message: "Role deleted successfully",
    });
  } catch (error) {
    console.error("Delete role error:", error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
