import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/* -------------------------------------------------------------------------- */
/*                              Helper to normalize                           */
/* -------------------------------------------------------------------------- */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

/* -------------------------------------------------------------------------- */
/*                                   UPDATE                                   */
/* -------------------------------------------------------------------------- */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { name, description, departmentId, permissions } =
      await request.json();

    if (!name)
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );

    if (!departmentId)
      return NextResponse.json(
        { error: "Department is required" },
        { status: 400 }
      );

    // --- Check if role exists ---
    const roleCheck = await DatabaseService.query(
      "SELECT id FROM roles WHERE id = ?",
      [params.id]
    );
    const existingRole = normalizeRows(roleCheck);

    if (existingRole.length === 0) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // --- Update role ---
    await DatabaseService.query(
      "UPDATE roles SET name = ?, description = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description || null, departmentId, params.id]
    );

    // --- Update permissions ---
    await DatabaseService.query(
      "DELETE FROM role_permissions WHERE role_id = ?",
      [params.id]
    );

    if (Array.isArray(permissions) && permissions.length > 0) {
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
        }
      }
    }

    return NextResponse.json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Update role error:", error);
    return NextResponse.json(
      { error: `Failed to update role: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   DELETE                                   */
/* -------------------------------------------------------------------------- */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // --- Check if role has users ---
    const usersResult = await DatabaseService.query(
      "SELECT id FROM user_roles WHERE role_id = ? LIMIT 1",
      [params.id]
    );
    const usersWithRole = normalizeRows(usersResult);

    if (usersWithRole.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role that has users assigned" },
        { status: 400 }
      );
    }

    await DatabaseService.query("DELETE FROM roles WHERE id = ?", [params.id]);
    return NextResponse.json({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error:", error);
    return NextResponse.json(
      { error: "Failed to delete role" },
      { status: 500 }
    );
  }
}
