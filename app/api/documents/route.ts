// app/api/documents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("=== FETCH DOCUMENTS STARTED ===");

    // Get token from cookie
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("❌ No auth token found for documents request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support both sync and async verifyToken implementations
    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    console.log("🔍 Token payload (raw):", decoded);

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      console.log("❌ Token present but no user id in payload:", decoded);
      return NextResponse.json(
        { error: "Unauthorized - invalid token payload" },
        { status: 401 }
      );
    }

    console.log("✅ Fetching documents for user:", userId);

    // Simplified documents query:
    // - include documents uploaded by user
    // - OR documents assigned to user via document_assignments
    const sql = `
      SELECT DISTINCT
        d.id,
        d.title,
        d.file_path,
        d.file_size,
        d.uploaded_by,
        d.assigned_to_user,
        d.status,
        d.created_at,
        d.updated_at,
        u.name AS uploader_name,
        u_assigned.name AS assigned_user_name
      FROM documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
      LEFT JOIN users u_assigned ON u_assigned.id = d.assigned_to_user
      WHERE
        d.uploaded_by = ?
        OR d.assigned_to_user = ?
        OR EXISTS (
          SELECT 1
          FROM document_assignments da
          WHERE da.document_id = d.id
            AND (da.assigned_to = ? OR da.assigned_by = ?)
        )
      ORDER BY d.created_at DESC
    `;

    const docsResult: any = await DatabaseService.query(sql, [
      userId,
      userId,
      userId,
      userId,
    ]);

    // Normalize to rows array:
    let docRows: any[] = Array.isArray(docsResult)
      ? Array.isArray(docsResult[0])
        ? docsResult[0]
        : docsResult
      : [];

    if (!Array.isArray(docRows)) docRows = [];

    console.log("📄 Found documents (rows):", docRows.length);

    // If no documents found, return empty list quickly
    if (docRows.length === 0) {
      return NextResponse.json({ documents: [] }, { status: 200 });
    }

    // Collect document IDs to fetch assignment rows
    const docIds = docRows.map((r) => r.id).filter(Boolean);

    // Prepare placeholders for IN (...) clause
    const placeholders = docIds.map(() => "?").join(",");

    // Query to fetch all assignment rows for these documents (REMOVED department fields)
    const assignmentsSql = `
      SELECT
        da.id AS assignment_id,
        da.document_id,
        da.assigned_to,
        u_assigned.name AS assigned_to_name,
        da.assigned_by,
        u_by.name AS assigned_by_name,
        da.roles,
        da.status AS assignment_status,
        da.notified_at,
        da.created_at AS assigned_at,
        da.updated_at AS assignment_updated_at
      FROM document_assignments da
      LEFT JOIN users u_assigned ON u_assigned.id = da.assigned_to
      LEFT JOIN users u_by ON u_by.id = da.assigned_by
      WHERE da.document_id IN (${placeholders})
      ORDER BY da.created_at ASC
    `;

    const assignmentsResult: any = await DatabaseService.query(
      assignmentsSql,
      docIds
    );

    // Normalize assignments rows
    let assignmentRows: any[] = Array.isArray(assignmentsResult)
      ? Array.isArray(assignmentsResult[0])
        ? assignmentsResult[0]
        : assignmentsResult
      : [];

    if (!Array.isArray(assignmentRows)) assignmentRows = [];

    // Group assignments by document_id
    const assignmentsByDoc: Record<string, any[]> = {};
    for (const ar of assignmentRows) {
      const did = ar.document_id;
      if (!did) continue;
      if (!assignmentsByDoc[did]) assignmentsByDoc[did] = [];
      assignmentsByDoc[did].push({
        assignment_id: ar.assignment_id,
        assigned_to: ar.assigned_to ?? null,
        assigned_to_name: ar.assigned_to_name ?? null,
        assigned_by: ar.assigned_by ?? null,
        assigned_by_name: ar.assigned_by_name ?? null,
        roles: ar.roles ?? null,
        status: ar.assignment_status ?? null,
        notified_at: ar.notified_at ?? null,
        assigned_at: ar.assigned_at ?? null,
        updated_at: ar.assignment_updated_at ?? null,
      });
    }

    // Map documents to the shape expected by the client
    const documents = docRows.map((r: any) => {
      const fileSize =
        typeof r.file_size === "number"
          ? r.file_size
          : Number(r.file_size ?? 0);

      const assignments = assignmentsByDoc[r.id] ?? [];

      return {
        id: r.id,
        title: r.title,
        file_path: r.file_path,
        file_url: r.file_path,
        file_size: fileSize,
        uploaded_by: r.uploaded_by,
        uploader_name: r.uploader_name ?? null,
        assigned_to_user: r.assigned_to_user,
        assigned_user_name: r.assigned_user_name ?? null,
        status: r.status ?? "active",
        created_at: r.created_at,
        updated_at: r.updated_at,
        assignments,
      };
    });

    return NextResponse.json({ documents }, { status: 200 });
  } catch (err: any) {
    console.error("💥 Error fetching documents:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
