// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

// Simple JWT implementation using crypto
function signJWT(payload: any, secret: string, expiresIn: string = "7d") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const expires = now + 7 * 24 * 60 * 60; // 7 days

  const data = {
    ...payload,
    iat: now,
    exp: expires,
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  );
  const base64Payload = Buffer.from(JSON.stringify(data)).toString("base64url");

  const crypto = require("crypto");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${base64Header}.${base64Payload}`)
    .digest("base64url");

  return `${base64Header}.${base64Payload}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log("Signin request received");

    const { email, password } = await request.json();
    console.log("Email:", email);

    if (!email || !password) {
      console.log("Missing email or password");
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email with role information
    console.log("Querying database for user...");
    let users;
    try {
      users = (await DatabaseService.query(
        `SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.password_hash, 
          u.department_id, 
          u.role_id,
          r.name as role_name,
          u.created_at 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.email = ?`,
        [email.toLowerCase().trim()]
      )) as any[];
      console.log("Database query successful, found users:", users?.length);
    } catch (dbError) {
      console.error("Database query error:", dbError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log("No user found with email:", email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = users[0];
    console.log("User found:", {
      id: user.id,
      email: user.email,
      role: user.role_name,
      role_id: user.role_id,
      hasPasswordHash: !!user.password_hash,
    });

    // Verify password
    console.log("Verifying password...");
    let isValidPassword = false;
    try {
      const bcrypt = await import("bcryptjs");
      isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log("Password validation result:", isValidPassword);
    } catch (bcryptError) {
      console.error("Bcrypt error:", bcryptError);
      return NextResponse.json(
        { error: "Password verification failed" },
        { status: 500 }
      );
    }

    if (!isValidPassword) {
      console.log("Invalid password for user:", email);
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate token with role information
    console.log("Generating JWT token...");
    const token = signJWT(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role_name || "user", // Use actual role from database or default to "user"
        roleId: user.role_id,
        departmentId: user.department_id,
      },
      process.env.JWT_SECRET || "fallback-secret-change-in-production"
    );

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name || "user", // Use actual role from database
        roleId: user.role_id,
        departmentId: user.department_id,
      },
      message: "Signed in successfully",
    });

    // Set HTTP-only cookie
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    console.log("Signin successful for user:", user.email);
    return response;
  } catch (error) {
    console.error("Sign in error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
