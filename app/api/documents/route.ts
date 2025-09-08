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

    // NOTE:
    // This query returns documents along with uploader name and (if present)
    // assigned user / assigned department names. Adjust column/table names
    // if your schema differs.
    const sql = `
      SELECT
        d.id,
        d.title,
        d.file_path,
        d.file_size,
        d.uploaded_by,
        d.status,
        d.created_at,
        d.updated_at,
        u.name AS uploader_name,
        d.assigned_to_user,
        d.assigned_to_department,
        au.name AS assigned_user_name,
        ad.name AS assigned_department_name
      FROM documents d
      LEFT JOIN users u ON u.id = d.uploaded_by
      LEFT JOIN users au ON au.id = d.assigned_to_user
      LEFT JOIN departments ad ON ad.id = d.assigned_to_department
      ORDER BY d.created_at DESC
    `;

    // Execute query. DatabaseService.query may return rows or [rows, fields] depending on implementation.
    const result: any = await DatabaseService.query(sql, []);
    // Normalize to rows array:
    let rows: any[] = Array.isArray(result)
      ? // If result is like [rows, fields] then result[0] is rows
        Array.isArray(result[0])
        ? result[0]
        : result
      : [];

    // Defensive: if rows is not an array, make it an empty array
    if (!Array.isArray(rows)) rows = [];

    console.log("📄 Found documents:", rows.length);

    // Map rows to the shape expected by client
    const documents = rows.map((r: any) => {
      const assignments: any[] = [];

      // If your app only stores a single assigned user/department per document,
      // create assignments array accordingly so the frontend has consistent shape.
      if (r.assigned_to_user) {
        assignments.push({
          id: r.assigned_to_user,
          assigned_to_user: r.assigned_to_user,
          assigned_user_name: r.assigned_user_name ?? null,
          assigned_to_department: null,
          assigned_department_name: null,
        });
      }

      if (r.assigned_to_department) {
        assignments.push({
          id: r.assigned_to_department,
          assigned_to_user: null,
          assigned_user_name: null,
          assigned_to_department: r.assigned_to_department,
          assigned_department_name: r.assigned_department_name ?? null,
        });
      }

      return {
        id: r.id,
        title: r.title,
        file_path: r.file_path,
        file_size: typeof r.file_size === "number" ? r.file_size : Number(r.file_size ?? 0),
        uploaded_by: r.uploaded_by,
        uploader_name: r.uploader_name ?? null,
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
