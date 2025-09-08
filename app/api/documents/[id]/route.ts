// app/api/documents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("=== FETCH SINGLE DOCUMENT STARTED ===");

    // 1) Auth: ensure we await verifyToken whether it's async or sync
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      console.log("❌ No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    console.log("🔍 Token payload (raw):", decoded);

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      console.log("❌ Token found but no user id in payload:", decoded);
      return NextResponse.json(
        { error: "Unauthorized - invalid token payload" },
        { status: 401 }
      );
    }
    console.log("✅ Authenticated user:", userId);

    // 2) Query document
    console.log("Fetching document:", params.id);
    const documentSql = `
      SELECT 
        d.*,
        u1.name as uploader_name,
        u2.name as assigned_user_name,
        dept.name as assigned_department_name
      FROM documents d
      LEFT JOIN users u1 ON d.uploaded_by = u1.id
      LEFT JOIN users u2 ON d.assigned_to_user = u2.id
      LEFT JOIN departments dept ON d.assigned_to_department = dept.id
      WHERE d.id = ?
      LIMIT 1
    `;

    const result: any = await DatabaseService.query(documentSql, [params.id]);

    // Normalize possible mysql2 shapes: result may be rows or [rows, fields]
    let rows: any[] = Array.isArray(result)
      ? Array.isArray(result[0])
        ? result[0]
        : result
      : [];

    if (!Array.isArray(rows)) rows = [];

    if (rows.length === 0) {
      console.log("❌ Document not found:", params.id);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const docRow = rows[0];

    console.log("Found document:", docRow.title ?? docRow.id);

    // 3) The file_path is now a Cloudinary URL, so we can use it directly
    const filePath = docRow.file_path || "";
    const fileUrl = filePath; // Cloudinary URLs are already absolute

    // 4) Shape the response document object for the client
    const document = {
      id: docRow.id,
      title: docRow.title,
      file_path: filePath,    // original relative path
      file_url: fileUrl,      // <-- absolute URL for the client to use
      file_size:
        typeof docRow.file_size === "number"
          ? docRow.file_size
          : Number(docRow.file_size ?? 0),
      uploaded_by: docRow.uploaded_by,
      uploader_name: docRow.uploader_name ?? null,
      status: docRow.status ?? "active",
      created_at: docRow.created_at,
      updated_at: docRow.updated_at,
      assigned_to_user: docRow.assigned_to_user ?? null,
      assigned_to_department: docRow.assigned_to_department ?? null,
      assigned_user_name: docRow.assigned_user_name ?? null,
      assigned_department_name: docRow.assigned_department_name ?? null,
    };

    // 5) Return document (note: client should use document.file_url for pdf viewer)
    return NextResponse.json({ document }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch document error:", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}
