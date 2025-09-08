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

    console.log('Fetching document:', params.id);

    // Get document details using your actual column names
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
    `;

    const documents = await DatabaseService.query(documentSql, [params.id]);
    
    if (documents.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documents[0];
    console.log('Found document:', document.title);

    return NextResponse.json({ 
      document
    });

  } catch (error) {
    console.error('Fetch document error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}