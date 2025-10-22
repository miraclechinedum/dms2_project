export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Get the token from the cookie
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Verify the token
    const decoded = await AuthService.verifyToken(token);

    if (!decoded) {
      // Clear invalid token
      const response = NextResponse.json({ user: null }, { status: 200 });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    // Use the centralized helper to resolve the canonical userId (string | null)
    const userId = AuthService.extractUserId(decoded);

    if (!userId) {
      // token didn't contain any usable id claim — clear cookie and return
      const response = NextResponse.json({ user: null }, { status: 200 });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    // Now this is safe to call because userId is guaranteed to be string
    const user = await AuthService.getUserById(userId);

    if (!user) {
      // Clear token if user not found
      const response = NextResponse.json({ user: null }, { status: 200 });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
