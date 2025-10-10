import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId required" },
        { status: 400 }
      );
    }

    // Test direct database query
    const testQuery = await DatabaseService.query(
      "SELECT * FROM document_assignments WHERE document_id = ?",
      [documentId]
    );

    const usersQuery = await DatabaseService.query(
      "SELECT id, name FROM users WHERE id IN (SELECT assigned_to FROM document_assignments WHERE document_id = ?) OR id IN (SELECT assigned_by FROM document_assignments WHERE document_id = ?)",
      [documentId, documentId]
    );

    return NextResponse.json({
      documentId,
      directAssignments: testQuery,
      relatedUsers: usersQuery,
      message: "Debug data fetched successfully",
    });
  } catch (err: any) {
    console.error("Debug assignments error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
