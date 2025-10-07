import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/** reuse helper from annotations file if you have it; otherwise inline:
 * normalizeRows(result)
 * authenticate(req)
 */

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

/**
 * POST -> acquire or refresh lock
 * Atomic: only sets lock if none or same user or expired (>3 minutes)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const documentId = params.id;
    if (!documentId) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    // Atomic update: set lock if free OR already held by same user OR expired (>3 min)
    const sql = `
      UPDATE documents
      SET locked_by = ?, locked_at = NOW()
      WHERE id = ?
        AND (
          locked_by IS NULL
          OR locked_by = ?
          OR locked_at < (NOW() - INTERVAL 3 MINUTE)
        )
    `;
    const res: any = await DatabaseService.query(sql, [userId, documentId, userId]);
    const rows = normalizeRows(res);

    // mysql2 sometimes returns result object not rows — check affectedRows:
    const affectedRows = (res && typeof res.affectedRows === "number")
      ? res.affectedRows
      : (Array.isArray(res) && res[0] && res[0].affectedRows ? res[0].affectedRows : 0);

    if (affectedRows > 0) {
      return NextResponse.json({ message: "Lock acquired", locked_by: userId }, { status: 200 });
    }

    // If we reach here, lock is held by someone else and not expired — fetch current locker
    const fetchSql = `SELECT locked_by, locked_at FROM documents WHERE id = ? LIMIT 1`;
    const fetchRes: any = await DatabaseService.query(fetchSql, [documentId]);
    const fetchRows = normalizeRows(fetchRes);
    const row = fetchRows[0] ?? null;
    return NextResponse.json({
      error: "Locked",
      locked_by: row?.locked_by ?? null,
      locked_at: row?.locked_at ?? null,
    }, { status: 423 }); // 423 Locked
  } catch (err) {
    console.error("POST lock error:", err);
    return NextResponse.json({ error: "Failed to acquire lock" }, { status: 500 });
  }
}

/**
 * DELETE -> release lock (only owner or admin)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const documentId = params.id;

    // Release only if current locked_by == userId OR user is admin (you can check role from token payload)
    // For simplicity, let's allow release if locked_by == userId OR token has isAdmin flag
    const isAdmin = !!(decoded?.isAdmin || decoded?.admin);

    if (isAdmin) {
      const sql = `UPDATE documents SET locked_by = NULL, locked_at = NULL WHERE id = ?`;
      await DatabaseService.query(sql, [documentId]);
      return NextResponse.json({ message: "Lock released (admin)" }, { status: 200 });
    } else {
      const sql = `UPDATE documents SET locked_by = NULL, locked_at = NULL WHERE id = ? AND locked_by = ?`;
      const res: any = await DatabaseService.query(sql, [documentId, userId]);

      const affectedRows = (res && typeof res.affectedRows === "number")
        ? res.affectedRows
        : (Array.isArray(res) && res[0] && res[0].affectedRows ? res[0].affectedRows : 0);

      if (affectedRows > 0) {
        return NextResponse.json({ message: "Lock released" }, { status: 200 });
      }
      return NextResponse.json({ error: "Not owner of lock" }, { status: 403 });
    }
  } catch (err) {
    console.error("DELETE lock error:", err);
    return NextResponse.json({ error: "Failed to release lock" }, { status: 500 });
  }
}
