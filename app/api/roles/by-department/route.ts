// app/api/roles/by-department/route.ts
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
    const departmentId = searchParams.get("departmentId");

    if (!departmentId) {
      return NextResponse.json(
        { error: "Department ID is required" },
        { status: 400 }
      );
    }

    // Fetch roles for specific department
    const roles = await DatabaseService.query(
      `
      SELECT 
        r.*,
        d.name as department_name
      FROM roles r
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE r.department_id = ?
      ORDER BY r.name
    `,
      [departmentId]
    );

    console.log(`Roles for department ${departmentId}:`, roles);

    return NextResponse.json({
      roles: roles || [],
    });
  } catch (error) {
    console.error("Fetch roles by department error:", error);
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    );
  }
}
