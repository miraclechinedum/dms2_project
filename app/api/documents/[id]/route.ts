import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get document details
    const documentSql = `
      SELECT 
        d.*,
        u.name as uploader_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.id = ?
    `;

    const documents = await DatabaseService.query(documentSql, [params.id]);
    
    if (documents.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documents[0];

    // Get assignments
    const assignmentsSql = `
      SELECT 
        da.*,
        u.name as assigned_user_name,
        dept.name as assigned_department_name
      FROM document_assignments da
      LEFT JOIN users u ON da.assigned_to_user = u.id
      LEFT JOIN departments dept ON da.assigned_to_department = dept.id
      WHERE da.document_id = ?
    `;
    
    const assignments = await DatabaseService.query(assignmentsSql, [params.id]);

    return NextResponse.json({ 
      document: { ...document, assignments }
    });

  } catch (error) {
    console.error('Fetch document error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}