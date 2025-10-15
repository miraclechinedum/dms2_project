// app/api/users/route.ts
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

    const { name, email, password, departmentId, roleId } =
      await request.json();

    if (!name || !email || !password || !departmentId || !roleId) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await AuthService.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create user with role
    const user = await AuthService.createUser(
      email,
      password,
      name,
      departmentId,
      decoded.userId, // createdBy
      roleId
    );

    // Increment people_count for the assigned department
    await DatabaseService.query(
      `UPDATE departments SET people_count = people_count + 1 WHERE id = ?`,
      [departmentId]
    );

    return NextResponse.json({
      message: "User created successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create user",
      },
      { status: 500 }
    );
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

    const sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.department_id,
        u.role_id,
        d.name as department_name,
        r.name as role_name,
        u.created_at
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.name
    `;

    const users = await DatabaseService.query(sql);

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
