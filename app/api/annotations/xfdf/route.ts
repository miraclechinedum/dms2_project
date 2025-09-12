// app/api/annotations/xfdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/**
 * Helper: normalize mysql2 return shapes to rows array
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  // mysql2 sometimes returns [rows, fields]
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

/**
 * Authenticate request (returns decoded token or null)
 */
async function authenticate(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value ?? null;
  if (!token) return null;
  try {
    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    return decoded;
  } catch (e) {
    return null;
  }
}

/**
 * GET /api/annotations/xfdf?documentId=...
 * Returns { xfdf: string | null }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const sql = `SELECT xfdf, updated_at FROM document_annotations_xfdf WHERE document_id = ? LIMIT 1`;
    const result: any = await DatabaseService.query(sql, [documentId]);
    const rows = normalizeRows(result);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ xfdf: null }, { status: 200 });
    }

    const row = rows[0];
    // xfdf may be null or empty string
    return NextResponse.json({ xfdf: row.xfdf ?? null, updated_at: row.updated_at ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/annotations/xfdf error:", err);
    return NextResponse.json({ error: "Failed to fetch XFDF" }, { status: 500 });
  }
}

/**
 * POST /api/annotations/xfdf
 * Body: { documentId: string, xfdf: string }
 * Requires auth cookie "auth-token"
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await authenticate(req);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const documentId = body?.documentId;
    const xfdf = body?.xfdf;

    if (!documentId || typeof xfdf !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    const now = new Date();

    // Upsert: keep one row per document_id (document_id has UNIQUE constraint in the table)
    // Use parameterized query to avoid injection
    const sql = `
      INSERT INTO document_annotations_xfdf (document_id, xfdf, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        xfdf = VALUES(xfdf),
        updated_at = VALUES(updated_at),
        created_by = VALUES(created_by)
    `;

    await DatabaseService.query(sql, [documentId, xfdf, userId, now, now]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/annotations/xfdf error:", err);
    return NextResponse.json({ error: "Failed to save XFDF" }, { status: 500 });
  }
}
