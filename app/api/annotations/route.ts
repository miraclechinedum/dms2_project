import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

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
 * Authenticate request and extract user info
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
 * Get user details from database using user ID
 */
async function getUserDetails(userId: string) {
  try {
    // TODO: Ensure 'users' table exists with columns: id, name, email
    const sql = `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`;
    const result: any = await DatabaseService.query(sql, [userId]);
    const rows = normalizeRows(result);
    
    if (rows && rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

/**
 * Get next sequence number for a document
 */
async function getNextSequenceNumber(documentId: string): Promise<number> {
  try {
    // TODO: Ensure 'annotations' table exists with column: sequence_number
    const sql = `SELECT MAX(sequence_number) as max_seq FROM annotations WHERE document_id = ?`;
    const result: any = await DatabaseService.query(sql, [documentId]);
    const rows = normalizeRows(result);
    
    const maxSeq = rows && rows.length > 0 ? rows[0].max_seq : 0;
    return (maxSeq || 0) + 1;
  } catch (error) {
    console.error('Error getting next sequence number:', error);
    return 1;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId') || searchParams.get('document_id');
    const pageNumber = searchParams.get('pageNumber') || searchParams.get('page_number');

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
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
    
    const params = [documentId];
    
    if (pageNumber) {
      sql += ` AND a.page_number = ?`;
      params.push(pageNumber);
    }
    
    sql += ` ORDER BY a.sequence_number ASC`;

    // TODO: Ensure 'annotations' table exists with columns:
    // - id (varchar/uuid primary key)
    // - document_id (varchar)
    // - user_id (varchar)
    // - page_number (int)
    // - annotation_type (enum: 'sticky_note', 'drawing', 'highlight')
    // - content (json/text)
    // - sequence_number (int)
    // - position_x (decimal/float)
    // - position_y (decimal/float)
    // - created_at (timestamp)
    // - updated_at (timestamp)
    
    const result: any = await DatabaseService.query(sql, params);
    const annotations = normalizeRows(result);

    // Parse JSON content if stored as string
    const processedAnnotations = annotations.map((annotation: any) => ({
      ...annotation,
      content: typeof annotation.content === 'string' 
        ? JSON.parse(annotation.content) 
        : annotation.content
    }));

    return NextResponse.json({ annotations: processedAnnotations });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    // Get user details
    const user = await getUserDetails(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    
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
      id: id || `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      document_id: document_id || documentId,
      user_id: user_id || bodyUserId || userId,
      page_number: page_number || pageNumber,
      annotation_type: annotation_type || annotationType,
      content,
      position_x: position_x || positionX || 0,
      position_y: position_y || positionY || 0,
    };

    // Validate required fields
    if (!normalizedData.document_id || !normalizedData.page_number || !normalizedData.annotation_type || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get next sequence number for this document
    const sequenceNumber = await getNextSequenceNumber(normalizedData.document_id);

    const now = new Date();

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
      normalizedData.page_number,
      normalizedData.annotation_type,
      JSON.stringify(content),
      sequenceNumber,
      normalizedData.position_x,
      normalizedData.position_y,
      now,
      now
    ];

    await DatabaseService.query(sql, params);

    // Return the created annotation with user info
    const newAnnotation = {
      id: normalizedData.id,
      document_id: normalizedData.document_id,
      user_id: normalizedData.user_id,
      page_number: normalizedData.page_number,
      annotation_type: normalizedData.annotation_type,
      content,
      sequence_number: sequenceNumber,
      position_x: normalizedData.position_x,
      position_y: normalizedData.position_y,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      user_name: user.name || user.email,
      user_email: user.email,
    };

    return NextResponse.json({ annotation: newAnnotation }, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const annotationId = searchParams.get('id');

    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    // Check if annotation exists and user has permission to delete
    const checkSql = `SELECT user_id FROM annotations WHERE id = ? LIMIT 1`;
    const checkResult: any = await DatabaseService.query(checkSql, [annotationId]);
    const checkRows = normalizeRows(checkResult);

    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    const annotationUserId = checkRows[0].user_id;

    // Only allow users to delete their own annotations (or add admin check here)
    if (userId !== annotationUserId) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete annotation
    const deleteSql = `DELETE FROM annotations WHERE id = ?`;
    await DatabaseService.query(deleteSql, [annotationId]);

    return NextResponse.json({ message: 'Annotation deleted successfully' });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}