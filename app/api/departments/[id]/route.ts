// app/api/departments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function PUT(
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

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    // Check if department exists
    const [existingDepartment] = await DatabaseService.query(
      `SELECT id, name FROM departments WHERE id = ?`,
      [params.id]
    );

    if (!existingDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if another department already has this name
    const [duplicateDepartment] = await DatabaseService.query(
      `SELECT id FROM departments WHERE name = ? AND id != ?`,
      [name.trim(), params.id]
    );

    if (duplicateDepartment) {
      return NextResponse.json(
        { error: "Another department with this name already exists" },
        { status: 409 }
      );
    }

    // Update department
    await DatabaseService.query(
      `UPDATE departments 
       SET name = ?, description = ?, updated_by = ?
       WHERE id = ?`,
      [
        name.trim(),
        description?.trim() || null,
        (decoded as any).userId,
        params.id,
      ]
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

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if department exists
    const [existingDepartment] = await DatabaseService.query(
      `SELECT id FROM departments WHERE id = ?`,
      [params.id]
    );

    if (!existingDepartment) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    // Check if department has users
    const [usersInDepartment] = await DatabaseService.query(
      `SELECT COUNT(*) as user_count FROM users WHERE department_id = ?`,
      [params.id]
    );

    if (usersInDepartment && usersInDepartment.user_count > 0) {
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
