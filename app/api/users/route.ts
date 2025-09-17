import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("=== FETCH USERS STARTED ===");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("❌ No auth token found for users request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    console.log("🔍 Token payload (raw):", decoded);

    if (!decoded) {
      console.log("❌ Invalid token payload for users request");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Query
    const sql = `
      SELECT u.id, u.name, u.email, u.department_id, u.created_by, 
             u.created_at, d.name as department_name, cu.name as created_by_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users cu ON u.created_by = cu.id
      ORDER BY u.name
    `;

    const result: any = await DatabaseService.query(sql);

    // Normalize possible result shapes (some MySQL libs return [rows, fields])
    let rows: any[] = [];
    if (Array.isArray(result)) {
      // If result looks like [rows, fields] or just rows
      if (Array.isArray(result[0])) {
        rows = result[0];
      } else {
        rows = result;
      }
    } else if (result && typeof result === "object" && "length" in result) {
      rows = result as any[];
    } else {
      rows = [];
    }

    if (!Array.isArray(rows)) rows = [];

    console.log(`📋 Returning ${rows.length} user(s)`);

    return NextResponse.json({ users: rows }, { status: 200 });
  } catch (err: any) {
    // Log the full error for debugging in the server console
    console.error("💥 Fetch users error:", err);
    // Return a safe error message to the client
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch users" },
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

    // ✅ Pass the creator's ID (from the token)
    const createdBy = decoded.userId;

    // Create user
    const user = await AuthService.createUser(
      email,
      password,
      name,
      departmentId,
      createdBy
    );

    // 🔹 Increment people_count for the assigned department
    await DatabaseService.query(
      `UPDATE departments 
       SET people_count = people_count + 1 
       WHERE id = ?`,
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

