// app/api/notifications/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("🔔 [NOTIFICATIONS API FIXED] Starting notifications fetch");

    const token = request.cookies.get("auth-token")?.value ?? null;
    console.log("🔔 [NOTIFICATIONS API FIXED] Token exists:", !!token);

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    console.log("🔔 [NOTIFICATIONS API FIXED] Token decoded:", decoded);

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    console.log("🔔 [NOTIFICATIONS API FIXED] Extracted userId:", userId);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid token payload - no user ID" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "5");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    console.log("🔔 [NOTIFICATIONS API FIXED] Query params:", {
      limit,
      offset,
      unreadOnly,
    });

    // FIX: Use separate queries instead of parameterized LIMIT/OFFSET
    // This avoids the MySQL prepared statement parameter binding issue

    let sql: string;
    let params: any[];

    if (unreadOnly) {
      sql = `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      params = [userId];
    } else {
      sql = `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      params = [userId];
    }

    console.log("🔔 [NOTIFICATIONS API FIXED] Final SQL:", sql);
    console.log("🔔 [NOTIFICATIONS API FIXED] Final params:", params);

    // Test the query with simple parameters first
    try {
      const testResult = await DatabaseService.query(
        "SELECT COUNT(*) as total FROM notifications WHERE user_id = ?",
        [userId]
      );
      console.log(
        "🔔 [NOTIFICATIONS API FIXED] Test query result:",
        testResult
      );
    } catch (testError) {
      console.error(
        "🔔 [NOTIFICATIONS API FIXED] Test query failed:",
        testError
      );
    }

    // Execute main query
    const result = await DatabaseService.query(sql, params);
    console.log(
      "🔔 [NOTIFICATIONS API FIXED] Main query result type:",
      typeof result
    );

    let rows: any[] = [];

    // Handle different database response structures
    if (Array.isArray(result)) {
      if (result.length > 0 && Array.isArray(result[0])) {
        rows = result[0]; // MySQL2 format [rows, fields]
      } else {
        rows = result; // Direct rows array
      }
    } else if (result && typeof result === "object") {
      // Single row object or other structure
      rows = [result];
    }

    console.log(
      "🔔 [NOTIFICATIONS API FIXED] Processed rows count:",
      rows.length
    );

    // Get unread count with simple parameter
    const countResult = await DatabaseService.query(
      "SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    let unreadCount = 0;
    if (Array.isArray(countResult)) {
      const countRows = Array.isArray(countResult[0])
        ? countResult[0]
        : countResult;
      unreadCount = countRows[0]?.unread_count || 0;
    } else if (countResult && countResult.unread_count !== undefined) {
      unreadCount = countResult.unread_count;
    }

    console.log("🔔 [NOTIFICATIONS API FIXED] Unread count:", unreadCount);

    // Process notifications
    const notifications = await Promise.all(
      rows.map(async (row) => {
        let document_title = null;
        let sender_name = null;

        if (row.related_document_id) {
          try {
            const docResult = await DatabaseService.query(
              "SELECT title FROM documents WHERE id = ?",
              [row.related_document_id]
            );

            let docRows: any[] = [];
            if (Array.isArray(docResult)) {
              docRows = Array.isArray(docResult[0]) ? docResult[0] : docResult;
            }

            if (docRows.length > 0 && docRows[0].title) {
              document_title = docRows[0].title;
            }
          } catch (err) {
            console.error("Error fetching document title:", err);
          }
        }

        if (row.sender_id) {
          try {
            const userResult = await DatabaseService.query(
              "SELECT name FROM users WHERE id = ?",
              [row.sender_id]
            );

            let userRows: any[] = [];
            if (Array.isArray(userResult)) {
              userRows = Array.isArray(userResult[0])
                ? userResult[0]
                : userResult;
            }

            if (userRows.length > 0 && userRows[0].name) {
              sender_name = userRows[0].name;
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

    console.log(
      "🔔 [NOTIFICATIONS API FIXED] Final notifications count:",
      notifications.length
    );

    return NextResponse.json(
      {
        notifications,
        unread_count: unreadCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(
      "❌ [NOTIFICATIONS API FIXED] Fetch notifications error:",
      err
    );
    console.error("❌ [NOTIFICATIONS API FIXED] Error name:", err.name);
    console.error("❌ [NOTIFICATIONS API FIXED] Error message:", err.message);

    // More detailed error information
    if (err.code)
      console.error("❌ [NOTIFICATIONS API FIXED] Error code:", err.code);
    if (err.errno)
      console.error("❌ [NOTIFICATIONS API FIXED] Error errno:", err.errno);
    if (err.sqlState)
      console.error(
        "❌ [NOTIFICATIONS API FIXED] Error sqlState:",
        err.sqlState
      );
    if (err.sqlMessage)
      console.error(
        "❌ [NOTIFICATIONS API FIXED] Error sqlMessage:",
        err.sqlMessage
      );
    if (err.sql)
      console.error("❌ [NOTIFICATIONS API FIXED] Error sql:", err.sql);

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
    console.log("🔔 [NOTIFICATIONS API FIXED] Creating new notification");

    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    console.log("🔔 [NOTIFICATIONS API FIXED] Request body:", body);

    const { type, message, related_document_id, recipient_user_id, sender_id } =
      body;

    if (!type || !message || !recipient_user_id) {
      return NextResponse.json(
        { error: "type, message, and recipient_user_id are required" },
        { status: 400 }
      );
    }

    // Use template literals for non-user parameters to avoid binding issues
    const sql = `
      INSERT INTO notifications (id, user_id, type, message, related_document_id, sender_id, is_read, created_at)
      VALUES (UUID(), ?, ?, ?, ?, ?, 0, NOW())
    `;

    const params = [
      String(recipient_user_id),
      String(type),
      String(message),
      related_document_id ? String(related_document_id) : null,
      sender_id ? String(sender_id) : null,
    ];

    console.log("🔔 [NOTIFICATIONS API FIXED] Insert params:", params);

    await DatabaseService.query(sql, params);

    return NextResponse.json(
      { message: "Notification created" },
      { status: 201 }
    );
  } catch (err: any) {
    console.error(
      "❌ [NOTIFICATIONS API FIXED] Create notification error:",
      err
    );
    return NextResponse.json(
      {
        error: err.sqlMessage || err.message || "Failed to create notification",
      },
      { status: 500 }
    );
  }
}
