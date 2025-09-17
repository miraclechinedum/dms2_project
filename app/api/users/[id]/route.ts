import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

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

    const { name, email, departmentId } = await request.json();

    if (!name || !email || !departmentId) {
      return NextResponse.json(
        { error: "Name, email, and department are required" },
        { status: 400 }
      );
    }

    // 1. Get the user’s current department
    const [existingUser] = await DatabaseService.query(
      `SELECT department_id FROM users WHERE id = ?`,
      [params.id]
    );

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldDepartmentId = existingUser.department_id;

    // 2. Update the user
    await DatabaseService.query(
      `
      UPDATE users 
      SET name = ?, email = ?, department_id = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [name, email, departmentId, params.id]
    );

    // 3. Adjust people_count if department changed
    if (oldDepartmentId !== departmentId) {
      await DatabaseService.query(
        `UPDATE departments SET people_count = people_count - 1 WHERE id = ?`,
        [oldDepartmentId]
      );
      await DatabaseService.query(
        `UPDATE departments SET people_count = people_count + 1 WHERE id = ?`,
        [departmentId]
      );
    }

    return NextResponse.json({
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    await DatabaseService.query(sql, [params.id]);

    return NextResponse.json({ 
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}