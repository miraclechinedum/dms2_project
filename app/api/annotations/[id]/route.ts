// app/api/annotations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/** Normalize DB result shapes to rows[] */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

/** Authenticate request: cookie "auth-token" or Authorization header */
async function authenticate(req: NextRequest) {
  const cookieToken = req.cookies.get("auth-token")?.value ?? null;
  const header = req.headers.get("authorization") ?? "";
  const headerToken = header?.replace(/^Bearer\s+/i, "") || null;
  const token = cookieToken || headerToken;
  if (!token) return null;
  try {
    return await Promise.resolve(AuthService.verifyToken(token));
  } catch (err) {
    const error = err as Error;
    console.warn("Auth verify failed:", error?.message ?? err);
    return null;
  }
}

/** Get user details by id (id, name, email) */
async function getUserDetails(userId: string | null) {
  if (!userId) return null;
  try {
    const sql = `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`;
    const result: any = await DatabaseService.query(sql, [userId]);
    const rows = normalizeRows(result);
    return rows && rows.length ? rows[0] : null;
  } catch (err) {
    const error = err as Error;
    console.error("getUserDetails error:", error?.message ?? err);
    return null;
  }
}

/** Convert DB DATETIME / value -> ISO string (best-effort) */
function toIsoStringFromDb(value: any) {
  try {
    if (value instanceof Date) return value.toISOString();
    // If MySQL DATETIME string or numeric
    return new Date(value).toISOString();
  } catch {
    return String(value);
  }
}

/**
 * GET /api/annotations/:id
 * Returns single annotation with user info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const annotationId = params.id;
    if (!annotationId) {
      return NextResponse.json(
        { error: "Annotation ID is required" },
        { status: 400 }
      );
    }

    const sql = `
      SELECT a.*, u.name as user_name, u.email as user_email
      FROM annotations a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ? LIMIT 1
    `;
    const result: any = await DatabaseService.query(sql, [annotationId]);
    const rows = normalizeRows(result);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    const row = rows[0];
    let content = row.content;
    try {
      if (typeof content === "string" && content) content = JSON.parse(content);
    } catch {
      // leave as-is
    }

    const annotation = {
      id: row.id,
      document_id: row.document_id,
      user_id: row.user_id,
      page_number: Number(row.page_number),
      annotation_type: row.annotation_type,
      content,
      sequence_number: Number(row.sequence_number),
      position_x: Number(row.position_x),
      position_y: Number(row.position_y),
      created_at: toIsoStringFromDb(row.created_at),
      updated_at: toIsoStringFromDb(row.updated_at),
      user_name: row.user_name || row.user_email,
      user_email: row.user_email,
    };

    return NextResponse.json({ annotation }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error(
      "GET /api/annotations/:id error:",
      error?.stack ?? error?.message ?? err
    );
    return NextResponse.json(
      { error: "Failed to fetch annotation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/annotations/[id]
 * Body may include: content, position_x, position_y, page_number
 * Only the annotation owner may modify.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const annotationId = params.id;
    if (!annotationId) {
      return NextResponse.json(
        { error: "Annotation ID is required" },
        { status: 400 }
      );
    }

    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fix: Use the correct property names based on the AuthService return type
    const tokenUserId =
      (decoded as any)?.userId ??
      (decoded as any)?.id ??
      (decoded as any)?.sub ??
      (decoded as any)?.uid ??
      null;
    if (!tokenUserId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Rest of your PATCH function remains the same...
    const checkSql = `SELECT * FROM annotations WHERE id = ? LIMIT 1`;
    const checkRes: any = await DatabaseService.query(checkSql, [annotationId]);
    const checkRows = normalizeRows(checkRes);
    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }
    const existing = checkRows[0];
    if (String(existing.user_id) !== String(tokenUserId)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // ... rest of your PATCH function
  } catch (err) {
    const error = err as Error;
    console.error(
      "PATCH /api/annotations/:id error:",
      error?.stack ?? error?.message ?? err
    );
    return NextResponse.json(
      {
        error: "Failed to update annotation",
        detail: String(error?.message ?? err),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotations/[id]
 * Only the owner may delete. (Add admin override if desired.)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const annotationId = params.id;
    if (!annotationId) {
      return NextResponse.json(
        { error: "Annotation ID is required" },
        { status: 400 }
      );
    }

    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fix: Use the same approach here
    const tokenUserId =
      (decoded as any)?.userId ??
      (decoded as any)?.id ??
      (decoded as any)?.sub ??
      (decoded as any)?.uid ??
      null;
    if (!tokenUserId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // ... rest of your DELETE function
  } catch (err) {
    const error = err as Error;
    console.error(
      "DELETE /api/annotations/:id error:",
      error?.stack ?? error?.message ?? err
    );
    return NextResponse.json(
      {
        error: "Failed to delete annotation",
        detail: String(error?.message ?? err),
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Format Date -> MySQL DATETIME: "YYYY-MM-DD HH:MM:SS"
 * Kept here so this file is self-contained.
 */
function toMySQLDatetime(d: Date): string {
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

// helper: check document lock owner
async function isDocumentLockOwnedBy(
  userId: string | null,
  documentId: string
) {
  if (!documentId) return false;
  const sql = `SELECT locked_by, locked_at FROM documents WHERE id = ? LIMIT 1`;
  const res: any = await DatabaseService.query(sql, [documentId]);
  const rows = normalizeRows(res);
  if (!rows || rows.length === 0) return false;
  const row = rows[0];
  const lockedBy = row.locked_by;
  const lockedAt = row.locked_at ? new Date(row.locked_at) : null;

  if (!lockedBy) return false;
  // expired?
  if (lockedAt && Date.now() - lockedAt.getTime() > 3 * 60 * 1000) return false;
  return String(lockedBy) === String(userId);
}
