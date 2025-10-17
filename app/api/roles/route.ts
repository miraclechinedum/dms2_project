// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function POST(request: NextRequest) {
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

    console.log("Creating role:", {
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

    // Check if role already exists
    const existingRole = await DatabaseService.query(
      "SELECT id FROM roles WHERE name = ?",
      [name]
    );

    if (existingRole.length > 0) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 409 }
      );
    }

    // Create role
    const result = await DatabaseService.query(
      "INSERT INTO roles (id, name, description, department_id, created_at, updated_at) VALUES (UUID(), ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [name, description || null, departmentId]
    );

    const roleId = result.insertId;

    console.log("Role created, ID:", roleId);

    // Add permissions if any
    if (permissions && permissions.length > 0) {
      console.log("Adding permissions:", permissions);

      for (const permissionId of permissions) {
        try {
          await DatabaseService.query(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            [roleId, permissionId]
          );
        } catch (insertError) {
          console.error(
            `Failed to insert permission ${permissionId}:`,
            insertError
          );
          // Continue with other permissions even if one fails
        }
      }

      console.log("Permissions added successfully");
    }

    return NextResponse.json({
      message: "Role created successfully",
      role: {
        id: roleId,
        name,
        description,
        department_id: departmentId,
      },
    });
  } catch (error) {
    console.error("Create role error:", error);

    let errorMessage = "Failed to create role";
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch roles with department information - FIXED QUERY
    const roles = await DatabaseService.query(`
      SELECT 
        r.*,
        d.name as department_name,
        COUNT(rp.permission_id) as permission_count,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);

    return NextResponse.json({
      roles: roles || [],
    });
  } catch (error) {
    console.error("Fetch roles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}
