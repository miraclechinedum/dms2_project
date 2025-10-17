// app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("🔔 [NOTIFICATIONS ID API] PATCH request started");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("🔔 [NOTIFICATIONS ID API] No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      console.log("🔔 [NOTIFICATIONS ID API] Invalid token payload:", decoded);
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 }
      );
    }

    const notificationId = params.id;
    console.log("🔔 [NOTIFICATIONS ID API] Marking notification as read:", {
      notificationId,
      userId,
    });

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

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

    if (!notification) {
      console.log("🔔 [NOTIFICATIONS ID API] Notification not found");
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.user_id !== userId) {
      console.log(
        "🔔 [NOTIFICATIONS ID API] User not authorized for this notification",
        {
          notificationUserId: notification.user_id,
          currentUserId: userId,
        }
      );
      return NextResponse.json(
        { error: "Not authorized for this notification" },
        { status: 403 }
      );
    }

    // Mark as read
    await DatabaseService.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ?",
      [notificationId]
    );

    console.log(
      "🔔 [NOTIFICATIONS ID API] Notification marked as read successfully"
    );

    return NextResponse.json(
      { message: "Notification marked as read" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ [NOTIFICATIONS ID API] Mark as read error:", err);
    console.error("❌ [NOTIFICATIONS ID API] Error stack:", err.stack);
    console.error("❌ [NOTIFICATIONS ID API] Error details:", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });

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
    console.log("🔔 [NOTIFICATIONS ID API] DELETE request started");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("🔔 [NOTIFICATIONS ID API] No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      console.log("🔔 [NOTIFICATIONS ID API] Invalid token payload:", decoded);
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 }
      );
    }

    const notificationId = params.id;
    console.log("🔔 [NOTIFICATIONS ID API] Deleting notification:", {
      notificationId,
      userId,
    });

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      );
    }

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

    if (!notification) {
      console.log("🔔 [NOTIFICATIONS ID API] Notification not found");
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notification.user_id !== userId) {
      console.log(
        "🔔 [NOTIFICATIONS ID API] User not authorized to delete this notification",
        {
          notificationUserId: notification.user_id,
          currentUserId: userId,
        }
      );
      return NextResponse.json(
        { error: "Not authorized to delete this notification" },
        { status: 403 }
      );
    }

    // Delete notification
    await DatabaseService.query("DELETE FROM notifications WHERE id = ?", [
      notificationId,
    ]);

    console.log("🔔 [NOTIFICATIONS ID API] Notification deleted successfully");

    return NextResponse.json(
      { message: "Notification deleted" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ [NOTIFICATIONS ID API] Delete notification error:", err);
    console.error("❌ [NOTIFICATIONS ID API] Error stack:", err.stack);
    console.error("❌ [NOTIFICATIONS ID API] Error details:", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });

    return NextResponse.json(
      { error: err?.message ?? "Failed to delete notification" },
      { status: 500 }
    );
  }
}
