// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email
    const users = (await DatabaseService.query(
      "SELECT id, name, email, password, role, created_at FROM users WHERE email = ?",
      [email.toLowerCase().trim()]
    )) as any[];

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verify password (assuming you're using bcrypt)
    const bcrypt = await import("bcryptjs");
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate token
    const jwt = await import("jsonwebtoken");
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      process.env.JWT_SECRET || "fallback-secret-change-in-production",
      { expiresIn: "7d" }
    );

    // Update last login time
    try {
      await DatabaseService.query(
        "UPDATE users SET last_login = NOW() WHERE id = ?",
        [user.id]
      );
    } catch (updateError) {
      console.warn("Failed to update last login time:", updateError);
      // Continue even if this fails
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: "Signed in successfully",
    });

    // Set HTTP-only cookie with proper configuration
    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Sign in error:", error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("connection limit exceeded")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again later." },
          { status: 503 }
        );
      }
      if (error.message.includes("Cannot connect to database")) {
        return NextResponse.json(
          { error: "Database connection failed. Please try again later." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
