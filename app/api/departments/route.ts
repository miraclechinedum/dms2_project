// app/api/departments/route.ts
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

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department already exists
    const [existingDepartment] = await DatabaseService.query(
      `SELECT id FROM departments WHERE name = ?`,
      [name.trim()]
    );

    if (existingDepartment) {
      return NextResponse.json(
        { error: "Department with this name already exists" },
        { status: 409 }
      );
    }

    // Create new department
    const result = await DatabaseService.query(
      `INSERT INTO departments (id, name, description, people_count, created_by, created_at) 
       VALUES (UUID(), ?, ?, 0, ?, NOW())`,
      [name.trim(), description?.trim() || null, (decoded as any).userId]
    );

    return NextResponse.json({
      message: "Department created successfully",
      department: {
        id: result.insertId,
        name: name.trim(),
        description: description?.trim(),
        people_count: 0,
        created_by: (decoded as any).userId,
      },
    });
  } catch (error) {
    console.error("Create department error:", error);
    return NextResponse.json(
      { error: "Failed to create department" },
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

    // Fetch all departments with user count
    const departments = await DatabaseService.query(`
      SELECT 
        d.*,
        u.name as created_by_name,
        COUNT(u2.id) as user_count
      FROM departments d
      LEFT JOIN users u ON d.created_by = u.id
      LEFT JOIN users u2 ON d.id = u2.department_id
      GROUP BY d.id
      ORDER BY d.name
    `);

    return NextResponse.json({
      departments: departments || [],
    });
  } catch (error) {
    console.error("Fetch departments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}
