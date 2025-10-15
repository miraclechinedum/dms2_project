// app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

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

    // Get roles with permission counts
    const roles = await DatabaseService.query(`
      SELECT 
        r.*,
        COUNT(rp.permission_id) as permission_count,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Fetch roles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

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

    const { name, description, permissions } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    // Check if role already exists
    const existingRoles = await DatabaseService.query(
      "SELECT id FROM roles WHERE name = ?",
      [name]
    );

    if (existingRoles.length > 0) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 400 }
      );
    }

    // Create role
    const roleId = crypto.randomUUID();
    await DatabaseService.query(
      "INSERT INTO roles (id, name, description) VALUES (?, ?, ?)",
      [roleId, name, description || null]
    );

    // Assign permissions
    if (permissions && permissions.length > 0) {
      const permissionValues = permissions.map((permissionId: string) => [
        roleId,
        permissionId,
      ]);
      await DatabaseService.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
        [permissionValues]
      );
    }

    return NextResponse.json({
      message: "Role created successfully",
      roleId,
    });
  } catch (error) {
    console.error("Create role error:", error);
    return NextResponse.json(
      { error: "Failed to create role" },
      { status: 500 }
    );
  }
}
