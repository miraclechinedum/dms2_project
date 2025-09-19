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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const annotationId = params.id;
    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    // Check if annotation exists and user has permission to update
    const checkSql = `
      SELECT a.*, u.name as user_name, u.email as user_email 
      FROM annotations a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ? LIMIT 1
    `;
    const checkResult: any = await DatabaseService.query(checkSql, [annotationId]);
    const checkRows = normalizeRows(checkResult);

    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    const existingAnnotation = checkRows[0];

    // Only allow users to update their own annotations (or add admin check here)
    if (userId !== existingAnnotation.user_id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();

    // Accept both snake_case and camelCase field names for updates
    const updates: any = {};
    
    if (body.content !== undefined) updates.content = JSON.stringify(body.content);
    if (body.position_x !== undefined || body.positionX !== undefined) {
      updates.position_x = body.position_x ?? body.positionX;
    }
    if (body.position_y !== undefined || body.positionY !== undefined) {
      updates.position_y = body.position_y ?? body.positionY;
    }
    if (body.page_number !== undefined || body.pageNumber !== undefined) {
      updates.page_number = body.page_number ?? body.pageNumber;
    }
    if (body.annotation_type !== undefined || body.annotationType !== undefined) {
      updates.annotation_type = body.annotation_type ?? body.annotationType;
    }

    // If no updates provided, return current annotation
    if (Object.keys(updates).length === 0) {
      const returnAnnotation = {
        ...existingAnnotation,
        content: typeof existingAnnotation.content === 'string' 
          ? JSON.parse(existingAnnotation.content) 
          : existingAnnotation.content
      };
      return NextResponse.json({ annotation: returnAnnotation });
    }

    // Add updated timestamp
    updates.updated_at = new Date();

    // Build dynamic UPDATE query
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const updateSql = `UPDATE annotations SET ${setClause} WHERE id = ?`;
    const updateParams = [...Object.values(updates), annotationId];

    await DatabaseService.query(updateSql, updateParams);

    // Fetch and return updated annotation with user info
    const fetchSql = `
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
      WHERE a.id = ? LIMIT 1
    `;
    
    const fetchResult: any = await DatabaseService.query(fetchSql, [annotationId]);
    const fetchRows = normalizeRows(fetchResult);
    
    if (fetchRows && fetchRows.length > 0) {
      const updatedAnnotation = {
        ...fetchRows[0],
        content: typeof fetchRows[0].content === 'string' 
          ? JSON.parse(fetchRows[0].content) 
          : fetchRows[0].content
      };
      return NextResponse.json({ annotation: updatedAnnotation });
    }

    return NextResponse.json({ error: 'Failed to fetch updated annotation' }, { status: 500 });
  } catch (error) {
    console.error('Error updating annotation:', error);
    return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate user
    const decoded = await authenticate(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const annotationId = params.id;
    if (!annotationId) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    // Check if annotation exists and user has permission to delete
    const checkSql = `SELECT user_id FROM annotations WHERE id = ? LIMIT 1`;
    const checkResult: any = await DatabaseService.query(checkSql, [annotationId]);
    const checkRows = normalizeRows(checkResult);

    if (!checkRows || checkRows.length === 0) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

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