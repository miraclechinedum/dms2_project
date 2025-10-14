import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const notificationId = params.id;

    // Verify the notification belongs to the current user
    const verifyResult = await DatabaseService.query(
      "SELECT user_id FROM notifications WHERE id = ?",
      [notificationId]
    );

    let notification: any = null;
    if (Array.isArray(verifyResult)) {
      const rows = Array.isArray(verifyResult[0])
        ? verifyResult[0]
        : verifyResult;
      notification = rows[0];
    }

    if (!notification || notification.user_id !== user.id) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Mark as read
    await DatabaseService.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ?",
      [notificationId]
    );

    return NextResponse.json(
      { message: "Notification marked as read" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Mark notification as read error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const notificationId = params.id;

    // Verify the notification belongs to the current user
    const verifyResult = await DatabaseService.query(
      "SELECT user_id FROM notifications WHERE id = ?",
      [notificationId]
    );

    let notification: any = null;
    if (Array.isArray(verifyResult)) {
      const rows = Array.isArray(verifyResult[0])
        ? verifyResult[0]
        : verifyResult;
      notification = rows[0];
    }

    if (!notification || notification.user_id !== user.id) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // Delete notification
    await DatabaseService.query("DELETE FROM notifications WHERE id = ?", [
      notificationId,
    ]);

    return NextResponse.json(
      { message: "Notification deleted" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Delete notification error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete notification" },
      { status: 500 }
    );
  }
}
