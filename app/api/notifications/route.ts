import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/* -------------------------------------------------------------------------- */
/*                                Helper Utils                                */
/* -------------------------------------------------------------------------- */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

async function authenticate(req: NextRequest) {
  const cookieToken = req.cookies.get("auth-token")?.value ?? null;
  const header = req.headers.get("authorization") ?? "";
  const headerToken = header?.replace(/^Bearer\s+/i, "") || null;
  const token = cookieToken || headerToken;
  if (!token) return null;
  try {
    return await Promise.resolve(AuthService.verifyToken(token));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                               GET NOTIFICATIONS                            */
/* -------------------------------------------------------------------------- */
export async function GET(req: NextRequest) {
  try {
    const decoded = await authenticate(req);
    if (!decoded)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Get notifications for this user
    const sql = `
      SELECT n.id, n.message, n.status, n.type, n.created_at, 
             n.related_document_id, n.sender_id
      FROM notifications n
      WHERE n.recipient_id = ?
      ORDER BY n.created_at DESC
      LIMIT 100
    `;
    const result = await DatabaseService.query(sql, [userId]);
    const rows = normalizeRows(result);

    const enriched = [];
    for (const row of rows) {
      let document_title = null;
      let sender_name = null;

      if (row.related_document_id) {
        const docResult: any = await DatabaseService.query(
          "SELECT title FROM documents WHERE id = ?",
          [row.related_document_id]
        );
        const docRows = Array.isArray(docResult)
          ? Array.isArray(docResult[0])
            ? docResult[0]
            : docResult
          : [];
        if (docRows?.[0]?.title) {
          document_title = docRows[0].title;
        }
      }

      if (row.sender_id) {
        const userResult: any = await DatabaseService.query(
          "SELECT name FROM users WHERE id = ?",
          [row.sender_id]
        );
        const userRows = Array.isArray(userResult)
          ? Array.isArray(userResult[0])
            ? userResult[0]
            : userResult
          : [];
        if (userRows?.[0]?.name) {
          sender_name = userRows[0].name;
        }
      }

      enriched.push({
        ...row,
        document_title,
        sender_name,
      });
    }

    return NextResponse.json(enriched, { status: 200 });
  } catch (err) {
    console.error("GET notifications error:", err);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                UPDATE STATUS                               */
/* -------------------------------------------------------------------------- */
export async function PATCH(req: NextRequest) {
  try {
    const decoded = await authenticate(req);
    if (!decoded)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { ids, status } = body;

    if (!Array.isArray(ids) || !status)
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const placeholders = ids.map(() => "?").join(",");
    const sql = `UPDATE notifications SET status = ? WHERE id IN (${placeholders}) AND recipient_id = ?`;
    await DatabaseService.query(sql, [status, ...ids, userId]);

    return NextResponse.json(
      { message: "Updated successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("PATCH notifications error:", err);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                DELETE OLD                                  */
/* -------------------------------------------------------------------------- */
export async function DELETE(req: NextRequest) {
  try {
    const decoded = await authenticate(req);
    if (!decoded)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const sql = `DELETE FROM notifications WHERE recipient_id = ? AND status = 'read'`;
    await DatabaseService.query(sql, [userId]);

    return NextResponse.json(
      { message: "Read notifications cleared" },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE notifications error:", err);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}
