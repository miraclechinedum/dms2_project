// app/api/departments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import { randomUUID } from "crypto";

/**
 * Normalize various mysql2 / mysql return shapes into an array of rows.
 * - Handles: [rows, fields], [[rows]], rows, objects with rows property
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && result !== null) {
    if (Array.isArray((result as any).rows)) return (result as any).rows;
    const maybeArray = Object.values(result);
    if (maybeArray.length > 0 && Array.isArray(maybeArray[0]))
      return maybeArray[0];
  }
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = AuthService.extractUserId(decoded);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid token: missing user id" },
        { status: 401 }
      );
    }

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department already exists (safe normalization)
    const existingRows = normalizeRows(
      await DatabaseService.query(`SELECT id FROM departments WHERE name = ?`, [
        name.trim(),
      ])
    );
    const existingDepartment = existingRows.length > 0 ? existingRows[0] : null;

    if (existingDepartment) {
      return NextResponse.json(
        { error: "Department with this name already exists" },
        { status: 409 }
      );
    }

    // Generate id in JS so we can return it reliably
    const deptId = randomUUID();

    // Create new department (insert explicit id)
    await DatabaseService.query(
      `INSERT INTO departments (id, name, description, people_count, created_by, created_at) 
       VALUES (?, ?, ?, 0, ?, NOW())`,
      [deptId, name.trim(), description?.trim() || null, userId]
    );

    return NextResponse.json({
      message: "Department created successfully",
      department: {
        id: deptId,
        name: name.trim(),
        description: description?.trim() || null,
        people_count: 0,
        created_by: userId,
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

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Fetch all departments with user count (normalize rows before returning)
    const result = await DatabaseService.query(`
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

    const departments = normalizeRows(result);

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
