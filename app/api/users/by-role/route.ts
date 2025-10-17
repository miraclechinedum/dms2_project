// app/api/users/by-role/route.ts
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

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("roleId");

    if (!roleId) {
      return NextResponse.json(
        { error: "Role ID is required" },
        { status: 400 }
      );
    }

    // Fetch users with the specified role
    const users = await DatabaseService.query(
      `
      SELECT 
        u.id, 
        u.name, 
        u.email,
        u.role_id
      FROM users u
      WHERE u.role_id = ?
      ORDER BY u.name
    `,
      [roleId]
    );

    console.log(`Users with role ${roleId}:`, users);

    return NextResponse.json({
      users: users || [],
    });
  } catch (error) {
    console.error("Fetch users by role error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
