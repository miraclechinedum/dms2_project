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
/*                                   CREATE                                   */
/* -------------------------------------------------------------------------- */
export async function POST(request: NextRequest) {
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

    // --- Check if role already exists ---
    const existingResult = await DatabaseService.query(
      "SELECT id FROM roles WHERE name = ?",
      [name]
    );
    const existingRole = normalizeRows(existingResult);

    if (existingRole.length > 0) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 409 }
      );
    }

    // --- Create role ---
    const insertResult: any = await DatabaseService.query(
      "INSERT INTO roles (id, name, description, department_id, created_at, updated_at) VALUES (UUID(), ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [name, description || null, departmentId]
    );

    // Handle both array [OkPacket, FieldPacket[]] and single OkPacket
    let roleId: string | number | null = null;

    if (Array.isArray(insertResult)) {
      const okPacket = insertResult[0];
      if (okPacket && typeof okPacket === "object" && "insertId" in okPacket) {
        roleId = okPacket.insertId;
      }
    } else if (
      insertResult &&
      typeof insertResult === "object" &&
      "insertId" in insertResult
    ) {
      roleId = insertResult.insertId;
    }

    console.log("✅ Role created, ID:", roleId);

    // --- Add permissions if any ---
    if (Array.isArray(permissions) && permissions.length > 0) {
      for (const permissionId of permissions) {
        try {
          await DatabaseService.query(
            "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
            [roleId, permissionId]
          );
        } catch (insertError) {
          console.error(
            `⚠️ Failed to insert permission ${permissionId}:`,
            insertError
          );
        }
      }
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
    console.error("❌ Create role error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to create role: ${error.message}`
            : "Failed to create role",
      },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                   READ                                    */
/* -------------------------------------------------------------------------- */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const rolesResult = await DatabaseService.query(`
      SELECT 
        r.*,
        d.name as department_name,
        COUNT(DISTINCT rp.permission_id) as permission_count,
        COUNT(DISTINCT u.id) as user_count
      FROM roles r
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);

    const roles = normalizeRows(rolesResult);

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("❌ Fetch roles error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}
