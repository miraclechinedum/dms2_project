// app/api/departments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/**
 * Normalize various mysql2 / mysql return shapes into an array of rows.
 * - Handles: [rows, fields], [[rows]], rows
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  // [rows, fields] -> rows might itself be an array or nested
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  // direct rows array
  if (Array.isArray(result)) return result;
  // object with properties (e.g., QueryResult-like) — try to find rows property
  if (typeof result === "object" && result !== null) {
    if (Array.isArray((result as any).rows)) return (result as any).rows;
    // sometimes mysql drivers return an object with numeric keys — coerce to array
    const maybeArray = Object.values(result);
    if (maybeArray.length > 0 && Array.isArray(maybeArray[0]))
      return maybeArray[0];
  }
  return [];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if department exists
    const existingRows = normalizeRows(
      await DatabaseService.query(
        `SELECT id, name FROM departments WHERE id = ?`,
        [params.id]
      )
    );
    const existingDepartment = existingRows.length > 0 ? existingRows[0] : null;

    if (!existingDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if another department already has this name
    const duplicateRows = normalizeRows(
      await DatabaseService.query(
        `SELECT id FROM departments WHERE name = ? AND id != ?`,
        [name.trim(), params.id]
      )
    );
    const duplicateDepartment =
      duplicateRows.length > 0 ? duplicateRows[0] : null;

    if (duplicateDepartment) {
      return NextResponse.json(
        { error: "Another department with this name already exists" },
        { status: 409 }
      );
    }

    // Update department
    await DatabaseService.query(
      `UPDATE departments 
       SET name = ?, description = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [name.trim(), description?.trim() || null, userId, params.id]
    );

    return NextResponse.json({
      message: "Department updated successfully",
    });
  } catch (error) {
    console.error("Update department error:", error);
    return NextResponse.json(
      { error: "Failed to update department" },
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

    // Check if department exists
    const existingRows = normalizeRows(
      await DatabaseService.query(`SELECT id FROM departments WHERE id = ?`, [
        params.id,
      ])
    );
    const existingDepartment = existingRows.length > 0 ? existingRows[0] : null;

    if (!existingDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if department has users
    const usersRows = normalizeRows(
      await DatabaseService.query(
        `SELECT COUNT(*) as user_count FROM users WHERE department_id = ?`,
        [params.id]
      )
    );

    const userCount =
      usersRows.length > 0 ? Number(usersRows[0].user_count ?? 0) : 0;

    if (userCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete department with assigned users" },
        { status: 400 }
      );
    }

    // Delete department
    await DatabaseService.query(`DELETE FROM departments WHERE id = ?`, [
      params.id,
    ]);

    return NextResponse.json({
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Delete department error:", error);
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}
