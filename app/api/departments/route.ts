import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const sql = 'SELECT id, name, description, created_at, created_by, people_count AS user_count FROM departments ORDER BY name';
    const departments = await DatabaseService.query(sql);

    return NextResponse.json({ departments });

  } catch (error) {
    console.error('Fetch departments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

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

    const { name, email, password, departmentId } = await request.json();

    if (!name || !email || !password || !departmentId) {
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

    // Create user
    const user = await AuthService.createUser(
      email,
      password,
      name,
      departmentId
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
      { error: error instanceof Error ? error.message : "Failed to create user" },
      { status: 500 }
    );
  }
}


