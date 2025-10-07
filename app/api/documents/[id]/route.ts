// app/api/documents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import { CloudinaryService } from "@/lib/cloudinary";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("=== FETCH SINGLE DOCUMENT STARTED ===");

    // 1) Auth
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

    // NOTE: COLLATE added to both sides of comparisons to avoid illegal mix of collations.
   const documentSql = `
  SELECT 
    d.*,
    u1.name as uploader_name,
    u2.name as assigned_user_name,
    dept.name as assigned_department_name,
    d.locked_by,
    d.locked_at,
    u3.name as locked_by_name,
    u3.email as locked_by_email
  FROM documents d
  LEFT JOIN users u1 ON d.uploaded_by = u1.id
  LEFT JOIN users u2 ON d.assigned_to_user = u2.id
  LEFT JOIN departments dept ON d.assigned_to_department = dept.id
  LEFT JOIN users u3 ON d.locked_by = u3.id
  WHERE d.id = ?
  LIMIT 1
`;

    const result: any = await DatabaseService.query(documentSql, [params.id]);

    // Normalize possible mysql2 shapes
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

    const filePath = docRow.file_path || "";

    let fileUrl = filePath;
    if (filePath.includes("cloudinary.com")) {
      const publicIdMatch = filePath.match(/\/(documents\/[^?]+)/);
      if (publicIdMatch) {
        let publicId = publicIdMatch[1];
        publicId = publicId.split("?")[0];
        publicId = publicId.replace(/\.pdf\.pdf$/, ".pdf");
        const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`;
        fileUrl = `${baseUrl}/${publicId}`;
        console.log("🔗 Generated PDF URL:", fileUrl);
      } else {
        fileUrl = filePath
          .replace("/image/upload/", "/raw/upload/")
          .replace(/\.pdf\.pdf/, ".pdf")
          .split("?")[0];
        console.log("⚠️ Using cleaned fallback URL:", fileUrl);
      }
    }

    const document = {
      id: docRow.id,
      title: docRow.title,
      file_path: filePath,
      file_url: fileUrl,
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
      locked_by: docRow.locked_by ?? null,
      locked_by_name: docRow.locked_by_name ?? null,
      locked_by_email: docRow.locked_by_email ?? null,
      locked_at: docRow.locked_at ? new Date(docRow.locked_at).toISOString() : null,
    };

    return NextResponse.json({ document }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch document error:", error);
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
