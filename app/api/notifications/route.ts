import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("🔔 [NOTIFICATIONS API] Starting notifications fetch");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("🔔 [NOTIFICATIONS API] No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await AuthService.verifyToken(token);
    if (!user) {
      console.log("🔔 [NOTIFICATIONS API] Invalid token");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log("🔔 [NOTIFICATIONS API] User authenticated:", user.userId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "5");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    console.log("🔔 [NOTIFICATIONS API] Query params:", {
      limit,
      offset,
      unreadOnly,
    });

    // Build query with proper parameter handling
    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    const params: any[] = [user.userId]; // FIXED: Use user.userId

    if (unreadOnly) {
      sql += ` AND is_read = 0`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

    // Ensure proper types for LIMIT and OFFSET (MySQL expects numbers)
    params.push(Number(limit), Number(offset));

    console.log("🔔 [NOTIFICATIONS API] SQL:", sql);
    console.log("🔔 [NOTIFICATIONS API] Params:", params);
    console.log(
      "🔔 [NOTIFICATIONS API] Param types:",
      params.map((p) => typeof p)
    );

    const result = await DatabaseService.query(sql, params);
    console.log("🔔 [NOTIFICATIONS API] Raw result:", result);

    // Handle different database response structures
    let rows: any[] = [];
    if (Array.isArray(result)) {
      if (result.length > 0 && Array.isArray(result[0])) {
        rows = result[0]; // MySQL2 format [rows, fields]
      } else {
        rows = result; // Direct rows array
      }
    } else if (result) {
      rows = [result]; // Single row object
    }

    console.log("🔔 [NOTIFICATIONS API] Notifications found:", rows.length);

    // For each notification, get additional data separately
    const notifications = await Promise.all(
      rows.map(async (row) => {
        let document_title = null;
        let sender_name = null;

        // Get document title if related_document_id exists
        if (row.related_document_id) {
          try {
            const docResult = await DatabaseService.query(
              "SELECT title FROM documents WHERE id = ?",
              [row.related_document_id]
            );
            if (Array.isArray(docResult)) {
              const docRows = Array.isArray(docResult[0])
                ? docResult[0]
                : docResult;
              document_title = docRows[0]?.title || null;
            }
          } catch (err) {
            console.error("Error fetching document title:", err);
          }
        }

        // Get sender name if sender_id exists
        if (row.sender_id) {
          try {
            const userResult = await DatabaseService.query(
              "SELECT name FROM users WHERE id = ?",
              [row.sender_id]
            );
            if (Array.isArray(userResult)) {
              const userRows = Array.isArray(userResult[0])
                ? userResult[0]
                : userResult;
              sender_name = userRows[0]?.name || null;
            }
          } catch (err) {
            console.error("Error fetching sender name:", err);
          }
        }

        return {
          id: row.id,
          user_id: row.user_id,
          type: row.type,
          message: row.message,
          related_document_id: row.related_document_id,
          document_title,
          sender_name,
          is_read: Boolean(row.is_read),
          created_at: row.created_at,
        };
      })
    );

    // Get unread count
    const countResult = await DatabaseService.query(
      "SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0",
      [user.userId] // FIXED: Use user.userId
    );

    let unreadCount = 0;
    if (Array.isArray(countResult)) {
      const countRows = Array.isArray(countResult[0])
        ? countResult[0]
        : countResult;
      unreadCount = countRows[0]?.unread_count || 0;
    }

    console.log("🔔 [NOTIFICATIONS API] Final response:", {
      notificationsCount: notifications.length,
      unreadCount,
    });

    return NextResponse.json(
      {
        notifications,
        unread_count: unreadCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ [NOTIFICATIONS API] Fetch notifications error:", err);
    console.error("❌ [NOTIFICATIONS API] Error stack:", err.stack);
    console.error("❌ [NOTIFICATIONS API] Error details:", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });

    return NextResponse.json(
      {
        error: "Failed to fetch notifications",
        details: err.sqlMessage || err.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔔 [NOTIFICATIONS API] Creating new notification");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    console.log("🔔 [NOTIFICATIONS API] Request body:", body);

    const { type, message, related_document_id, recipient_user_id, sender_id } =
      body;

    if (!type || !message || !recipient_user_id) {
      console.log("🔔 [NOTIFICATIONS API] Missing required fields");
      return NextResponse.json(
        { error: "type, message, and recipient_user_id are required" },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO notifications (id, user_id, type, message, related_document_id, sender_id, is_read, created_at)
      VALUES (UUID(), ?, ?, ?, ?, ?, 0, NOW())
    `;

    // Ensure proper parameter types
    const params = [
      String(recipient_user_id),
      String(type),
      String(message),
      related_document_id ? String(related_document_id) : null,
      sender_id ? String(sender_id) : null,
    ];

    console.log("🔔 [NOTIFICATIONS API] Insert SQL:", sql);
    console.log("🔔 [NOTIFICATIONS API] Insert params:", params);
    console.log(
      "🔔 [NOTIFICATIONS API] Insert param types:",
      params.map((p) => typeof p)
    );

    await DatabaseService.query(sql, params);

    console.log("🔔 [NOTIFICATIONS API] Notification created successfully");

    return NextResponse.json(
      { message: "Notification created" },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("❌ [NOTIFICATIONS API] Create notification error:", err);
    console.error("❌ [NOTIFICATIONS API] Error stack:", err.stack);
    console.error("❌ [NOTIFICATIONS API] Error details:", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });

    return NextResponse.json(
      {
        error: err.sqlMessage || err.message || "Failed to create notification",
      },
      { status: 500 }
    );
  }
}
