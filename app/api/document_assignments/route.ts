// app/api/document_assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // optional auth: ensure token exists — you may skip or relax if not needed
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await Promise.resolve(AuthService.verifyToken(token));

    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "documentId is required" }, { status: 400 });
    }

    const sql = `
      SELECT
        da.id AS assignment_id,
        da.document_id,
        da.assigned_to,
        u_assigned.name AS assigned_to_name,
        da.assigned_by,
        u_by.name AS assigned_by_name,
        da.department_id,
        dpt.name AS department_name,
        da.roles,
        da.status,
        da.notified_at,
        da.created_at AS assigned_at,
        da.updated_at AS updated_at
      FROM document_assignments da
      LEFT JOIN users u_assigned ON u_assigned.id = da.assigned_to
      LEFT JOIN users u_by ON u_by.id = da.assigned_by
      LEFT JOIN departments dpt ON dpt.id = da.department_id
      WHERE da.document_id = ?
      ORDER BY da.created_at DESC
    `;

    const res: any = await DatabaseService.query(sql, [documentId]);
    let rows: any[] = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
    if (!Array.isArray(rows)) rows = [];

    // Normalize date fields to ISO strings (optional)
    const assignments = rows.map((r) => ({
      assignment_id: r.assignment_id,
      document_id: r.document_id,
      assigned_to: r.assigned_to,
      assigned_to_name: r.assigned_to_name ?? null,
      assigned_by: r.assigned_by,
      assigned_by_name: r.assigned_by_name ?? null,
      department_id: r.department_id ?? null,
      department_name: r.department_name ?? null,
      roles: r.roles ?? null,
      status: r.status ?? null,
      notified_at: r.notified_at ? new Date(r.notified_at).toISOString() : null,
      assigned_at: r.assigned_at ? new Date(r.assigned_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    }));

    return NextResponse.json({ assignments }, { status: 200 });
  } catch (err: any) {
    console.error("Fetch assignment history error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to fetch assignments" }, { status: 500 });
  }
}
