// app/api/users/[id]/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

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

    // Fetch user permissions (both direct permissions and through roles)
    const permissions = await DatabaseService.query(
      `
      SELECT DISTINCT p.id, p.name, p.description, p.category
      FROM permissions p
      LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      LEFT JOIN user_roles ur ON rp.role_id = ur.role_id AND ur.user_id = ?
      WHERE up.user_id IS NOT NULL OR ur.user_id IS NOT NULL
      ORDER BY p.category, p.name
    `,
      [params.id, params.id]
    );

    return NextResponse.json({
      permissions: permissions || [],
    });
  } catch (error) {
    console.error("Fetch user permissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user permissions" },
      { status: 500 }
    );
  }
}
