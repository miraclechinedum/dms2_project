// app/api/annotations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import type { DecodedToken } from "@/lib/auth";

/**
 * Helper: normalize mysql2 return shapes to rows array
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

/**
 * Authenticate request and extract user info
 */
async function authenticate(req: NextRequest): Promise<DecodedToken | null> {
  const token = req.cookies.get("auth-token")?.value ?? null;
  if (!token) return null;
  try {
    // AuthService.verifyToken now returns DecodedToken | null
    const decoded = await AuthService.verifyToken(token);
    return decoded;
  } catch (e) {
    console.error("Token verification error:", e);
    return null;
  }
}

/**
 * Get user details from database using user ID
 */
async function getUserDetails(userId: string) {
  try {
    const sql = `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`;
    const result: any = await DatabaseService.query(sql, [userId]);
    const rows = normalizeRows(result);

    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching user details:", error);
    return null;
  }
}

/**
 * Get next sequence number for a document
 */
async function getNextSequenceNumber(documentId: string): Promise<number> {
  try {
    const sql = `SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM annotations WHERE document_id = ?`;
    const result: any = await DatabaseService.query(sql, [documentId]);
    const rows = normalizeRows(result);

    const maxSeq = rows && rows.length > 0 ? Number(rows[0].max_seq || 0) : 0;
    return (maxSeq || 0) + 1;
  } catch (error) {
    console.error("Error getting next sequence number:", error);
    return 1;
  }
}

/**
 * Format JS Date to MySQL DATETIME string "YYYY-MM-DD HH:MM:SS"
 */
function formatDateForMySQL(d: Date) {
  // Use local-time or UTC depending on your DB timezone setup.
  // This produces a UTC-based string (from toISOString) without millis/Z:
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * GET /api/annotations?documentId=... (&pageNumber=...)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId =
      searchParams.get("documentId") || searchParams.get("document_id");
    const pageNumber =
      searchParams.get("pageNumber") || searchParams.get("page_number");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Build query with optional page filter
    let sql = `
      SELECT 
        a.id,
        a.document_id,
        a.user_id,
        a.page_number,
        a.annotation_type,
        a.content,
        a.sequence_number,
        a.position_x,
        a.position_y,
        a.created_at,
        a.updated_at,
        u.name as user_name,
        u.email as user_email
      FROM annotations a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.document_id = ?
    `;
    const params: any[] = [documentId];

    if (pageNumber) {
      const pn = Number(pageNumber);
      if (!Number.isNaN(pn)) {
        sql += ` AND a.page_number = ?`;
        params.push(pn);
      }
    }

    sql += ` ORDER BY a.sequence_number ASC`;

    const result: any = await DatabaseService.query(sql, params);
    const annotations = normalizeRows(result);

    // Parse JSON content if stored as string
    const processedAnnotations = annotations.map((annotation: any) => ({
      ...annotation,
      content:
        typeof annotation.content === "string" && annotation.content
          ? JSON.parse(annotation.content)
          : annotation.content,
    }));

    return NextResponse.json(
      { annotations: processedAnnotations },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch annotations",
        detail: String((error as any)?.message ?? error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/annotations
 * Body accepts snake_case or camelCase fields.
 * Returns: { annotation: {...} } (201)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // resolve userId with fallbacks (userId, id, sub, uid)
    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid user token" },
        { status: 401 }
      );
    }

    // Get user details
    const user = await getUserDetails(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));

    // Accept both snake_case and camelCase field names
    const {
      id,
      document_id,
      documentId,
      user_id,
      userId: bodyUserId,
      page_number,
      pageNumber,
      annotation_type,
      annotationType,
      content,
      position_x,
      positionX,
      position_y,
      positionY,
    } = body;

    // Normalize field names (prefer snake_case for consistency)
    const normalizedData = {
      id:
        id ||
        `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      document_id: document_id || documentId,
      user_id: user_id || bodyUserId || userId,
      page_number: page_number ?? pageNumber,
      annotation_type: annotation_type || annotationType,
      content,
      position_x: position_x ?? positionX ?? 0,
      position_y: position_y ?? positionY ?? 0,
    };

    // Validate required fields
    if (
      !normalizedData.document_id ||
      normalizedData.page_number == null ||
      !normalizedData.annotation_type ||
      normalizedData.content == null
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields (document_id, page_number, annotation_type, content)",
        },
        { status: 400 }
      );
    }

    // Get next sequence number for this document
    const sequenceNumber = await getNextSequenceNumber(
      normalizedData.document_id
    );

    // Format dates for MySQL-compatible DATETIME/TIMESTAMP columns
    const now = new Date();
    const nowForDb = formatDateForMySQL(now); // "YYYY-MM-DD HH:MM:SS"

    // Insert annotation into database
    const sql = `
      INSERT INTO annotations (
        id, document_id, user_id, page_number, annotation_type, 
        content, sequence_number, position_x, position_y, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      normalizedData.id,
      normalizedData.document_id,
      normalizedData.user_id,
      Number(normalizedData.page_number),
      normalizedData.annotation_type,
      JSON.stringify(normalizedData.content),
      sequenceNumber,
      Number(normalizedData.position_x),
      Number(normalizedData.position_y),
      nowForDb,
      nowForDb,
    ];

    try {
      await DatabaseService.query(sql, params);
    } catch (dbError) {
      console.error("DB insert error:", dbError, params);
      // Return DB error detail to help debugging (remove detail in production)
      return NextResponse.json(
        {
          error: "Database error inserting annotation",
          detail: String((dbError as any)?.message ?? dbError),
        },
        { status: 500 }
      );
    }

    // Return the created annotation with user info
    const newAnnotation = {
      id: normalizedData.id,
      document_id: normalizedData.document_id,
      user_id: normalizedData.user_id,
      page_number: Number(normalizedData.page_number),
      annotation_type: normalizedData.annotation_type,
      content: normalizedData.content,
      sequence_number: sequenceNumber,
      position_x: Number(normalizedData.position_x),
      position_y: Number(normalizedData.position_y),
      // return ISO for frontend convenience
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      user_name: user.name || user.email,
      user_email: user.email,
    };

    return NextResponse.json({ annotation: newAnnotation }, { status: 201 });
  } catch (error) {
    console.error("Error creating annotation:", error);
    return NextResponse.json(
      {
        error: "Failed to create annotation",
        detail: String((error as any)?.message ?? error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotations?id=...
 * Requires authentication and only allows the annotation owner (or admin) to delete.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get("id");

    if (!annotationId) {
      return NextResponse.json(
        { error: "Annotation ID is required" },
        { status: 400 }
      );
    }

    // Check if annotation exists and user has permission to delete
    const checkSql = `SELECT user_id FROM annotations WHERE id = ? LIMIT 1`;
    const checkResult: any = await DatabaseService.query(checkSql, [
      annotationId,
    ]);
    const checkRows = normalizeRows(checkResult);

    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 }
      );
    }

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    const annotationUserId = checkRows[0].user_id;

    // Only allow users to delete their own annotations (or add admin check here)
    if (userId !== annotationUserId) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Delete annotation
    const deleteSql = `DELETE FROM annotations WHERE id = ?`;
    await DatabaseService.query(deleteSql, [annotationId]);

    return NextResponse.json(
      { message: "Annotation deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json(
      {
        error: "Failed to delete annotation",
        detail: String((error as any)?.message ?? error),
      },
      { status: 500 }
    );
  }
}
