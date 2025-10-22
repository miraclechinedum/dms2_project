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

    const { name, email, departmentId, roleId, permissions } =
      await request.json();

    if (!name || !email || !departmentId || !roleId) {
      return NextResponse.json(
        { error: "Name, email, department, and role are required" },
        { status: 400 }
      );
    }

    // 1. Get the user's current department and role
    const [existingUserResult]: any = await DatabaseService.query(
      `SELECT department_id, role_id FROM users WHERE id = ?`,
      [params.id]
    );
    const existingUser = existingUserResult?.[0];

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldDepartmentId = existingUser.department_id;
    const oldRoleId = existingUser.role_id;

    // 2. Update the user
    await DatabaseService.query(
      `
      UPDATE users 
      SET name = ?, email = ?, department_id = ?, role_id = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [name, email, departmentId, roleId, params.id]
    );

    // 3. Update user permissions if provided
    if (permissions && Array.isArray(permissions)) {
      await DatabaseService.query(
        "DELETE FROM user_permissions WHERE user_id = ?",
        [params.id]
      );

      if (permissions.length > 0) {
        for (const permissionId of permissions) {
          await DatabaseService.query(
            "INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)",
            [params.id, permissionId]
          );
        }
      }
    }

    // 4. Adjust people_count if department changed
    if (oldDepartmentId !== departmentId) {
      await DatabaseService.query(
        `UPDATE departments SET people_count = people_count - 1 WHERE id = ?`,
        [oldDepartmentId]
      );
      await DatabaseService.query(
        `UPDATE departments SET people_count = people_count + 1 WHERE id = ?`,
        [departmentId]
      );
    }

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function GET(
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

    // Get user details
    const [userResult]: any = await DatabaseService.query(
      `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.department_id,
        u.role_id,
        d.name as department_name,
        r.name as role_name
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
      `,
      [params.id]
    );
    const user = userResult?.[0];

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's custom permissions
    const [permissionsResult]: any = await DatabaseService.query(
      `
      SELECT p.id, p.name, p.description, p.category
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ?
      ORDER BY p.category, p.name
      `,
      [params.id]
    );

    return NextResponse.json({
      user: {
        ...user,
        permissions: permissionsResult.map((p: any) => p.id),
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
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

    // Get user's department before deletion
    const [userResult]: any = await DatabaseService.query(
      "SELECT department_id FROM users WHERE id = ?",
      [params.id]
    );
    const user = userResult?.[0];

    if (user) {
      await DatabaseService.query(
        "UPDATE departments SET people_count = people_count - 1 WHERE id = ?",
        [user.department_id]
      );
    }

    await DatabaseService.query(
      "DELETE FROM user_permissions WHERE user_id = ?",
      [params.id]
    );
    await DatabaseService.query("DELETE FROM users WHERE id = ?", [params.id]);

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
