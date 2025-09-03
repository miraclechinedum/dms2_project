import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const pageNumber = searchParams.get('pageNumber');

    if (!documentId || !pageNumber) {
      return NextResponse.json({ error: 'Document ID and page number are required' }, { status: 400 });
    }

    const sql = `
      SELECT a.*, u.full_name as user_name
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.document_id = ? AND a.page_number = ?
      ORDER BY a.sequence_number
    `;

    const annotations = await DatabaseService.query(sql, [documentId, parseInt(pageNumber)]);

    return NextResponse.json({ annotations });

  } catch (error) {
    console.error('Fetch annotations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch annotations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const {
      documentId,
      pageNumber,
      annotationType,
      content,
      sequenceNumber,
      positionX,
      positionY
    } = await request.json();

    const annotationId = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sql = `
      INSERT INTO annotations (id, document_id, user_id, page_number, annotation_type, content, sequence_number, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await DatabaseService.query(sql, [
      annotationId,
      documentId,
      decoded.userId,
      pageNumber,
      annotationType,
      JSON.stringify(content),
      sequenceNumber,
      positionX,
      positionY
    ]);

    // Log activity
    const activitySql = `
      INSERT INTO activity_logs (id, document_id, user_id, action, details)
      VALUES (?, ?, ?, 'annotation_added', JSON_OBJECT('type', ?, 'page', ?))
    `;
    
    await DatabaseService.query(activitySql, [
      `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      decoded.userId,
      annotationType,
      pageNumber
    ]);

    return NextResponse.json({ 
      message: 'Annotation saved successfully',
      annotationId 
    });

  } catch (error) {
    console.error('Save annotation error:', error);
    return NextResponse.json(
      { error: 'Failed to save annotation' },
      { status: 500 }
    );
  }
}