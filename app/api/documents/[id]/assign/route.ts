// app/api/documents/[id]/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

// Node / modern runtime UUID
const genId = () =>
  typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
    ? (crypto as any).randomUUID()
    : // fallback
      `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("=== ASSIGN DOCUMENT STARTED ===");

    // 1) Auth
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("❌ No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      console.log("❌ Token present but no user id in payload:", decoded);
      return NextResponse.json({ error: "Unauthorized - invalid token payload" }, { status: 401 });
    }
    console.log("✅ Authenticated user (assigner):", userId);

    // 2) Parse body
    const body = await request.json().catch(() => ({}));
    const assigned_to: string | undefined = body?.assigned_to;
    const giveLock: boolean = Boolean(body?.giveLock);
    const notify: boolean = Boolean(body?.notify);

    if (!assigned_to) {
      return NextResponse.json({ error: "assigned_to is required" }, { status: 400 });
    }

    const documentId = params.id;
    if (!documentId) {
      return NextResponse.json({ error: "document id missing in params" }, { status: 400 });
    }

    // 3) Ensure the document exists
    const checkSql = `SELECT id FROM documents WHERE id = ? LIMIT 1`;
    const checkRes: any = await DatabaseService.query(checkSql, [documentId]);
    let checkRows: any[] = Array.isArray(checkRes) ? (Array.isArray(checkRes[0]) ? checkRes[0] : checkRes) : [];
    if (!Array.isArray(checkRows)) checkRows = [];
    if (checkRows.length === 0) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 4) Insert assignment row
    const assignmentId = genId();
    const insertSql = `
      INSERT INTO document_assignments
        (id, document_id, assigned_to, assigned_by, department_id, roles, status, notified_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    // notified_at value (NULL or NOW())
    const notifiedAtValue = notify ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

    // Note: mysql driver will accept JS null for SQL NULL
    await DatabaseService.query(insertSql, [
      assignmentId,
      documentId,
      assigned_to,
      userId,
      null, // department_id
      "Editor",
      "waiting",
      notifiedAtValue,
    ]);

    console.log("🟢 Inserted assignment:", assignmentId, "for document:", documentId);

    // 5) Update documents table to reflect assignment and optionally transfer lock
    // We'll set assigned_to_user and assigned_to_department = NULL in all cases
    if (giveLock) {
      const updateSql = `
        UPDATE documents
        SET assigned_to_user = ?,
            assigned_to_department = NULL,
            locked_by = ?,
            locked_at = NOW(),
            updated_at = NOW()
        WHERE id = ?
      `;
      await DatabaseService.query(updateSql, [assigned_to, assigned_to, documentId]);
    } else {
      const updateSql = `
        UPDATE documents
        SET assigned_to_user = ?,
            assigned_to_department = NULL,
            updated_at = NOW()
        WHERE id = ?
      `;
      await DatabaseService.query(updateSql, [assigned_to, documentId]);
    }

    // 6) Fetch the created assignment row (and optionally updated document)
    const fetchAssignmentSql = `
      SELECT
        da.*,
        u_assigned.name AS assigned_to_name,
        u_by.name AS assigned_by_name
      FROM document_assignments da
      LEFT JOIN users u_assigned ON u_assigned.id = da.assigned_to
      LEFT JOIN users u_by ON u_by.id = da.assigned_by
      WHERE da.id = ?
      LIMIT 1
    `;
    const assignmentRes: any = await DatabaseService.query(fetchAssignmentSql, [assignmentId]);
    let assignmentRows: any[] = Array.isArray(assignmentRes)
      ? Array.isArray(assignmentRes[0])
        ? assignmentRes[0]
        : assignmentRes
      : [];
    if (!Array.isArray(assignmentRows)) assignmentRows = [];

    const createdAssignment = assignmentRows[0] ?? null;

    // fetch the updated document (so client can refresh)
    const fetchDocumentSql = `
      SELECT
        d.*,
        u1.name as uploader_name,
        u2.name as assigned_user_name,
        dept.name as assigned_department_name,
        u3.name as locked_by_name
      FROM documents d
      LEFT JOIN users u1 ON d.uploaded_by = u1.id
      LEFT JOIN users u2 ON d.assigned_to_user = u2.id
      LEFT JOIN departments dept ON d.assigned_to_department = dept.id
      LEFT JOIN users u3 ON d.locked_by = u3.id
      WHERE d.id = ?
      LIMIT 1
    `;
    const docRes: any = await DatabaseService.query(fetchDocumentSql, [documentId]);
    let docRows: any[] = Array.isArray(docRes) ? (Array.isArray(docRes[0]) ? docRes[0] : docRes) : [];
    if (!Array.isArray(docRows)) docRows = [];

    const updatedDocument = docRows[0] ?? null;

    // 7) Return success
    return NextResponse.json(
      { assignment: createdAssignment, document: updatedDocument },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Assign document error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to assign document" }, { status: 500 });
  }
}
