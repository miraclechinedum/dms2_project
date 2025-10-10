import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;

    if (!token) {
      return NextResponse.json({ error: "No token found" }, { status: 401 });
    }

    console.log("🔐 [AUTH DEBUG] Token:", token);

    const user = await AuthService.verifyToken(token);

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        type: typeof user.id,
        fullUser: user,
      },
      token: token.substring(0, 50) + "...", // Only show first 50 chars for security
    });
  } catch (err: any) {
    console.error("Auth debug error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
