import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get user from token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('Fetching documents for user:', decoded.userId);

    // Get documents with uploader and assignment info using your actual column names
    const sql = `
      SELECT 
        d.*,
        u1.name as uploader_name,
        u2.name as assigned_user_name,
        dept.name as assigned_department_name
      FROM documents d
      LEFT JOIN users u1 ON d.uploaded_by = u1.id
      LEFT JOIN users u2 ON d.assigned_to_user = u2.id
      LEFT JOIN departments dept ON d.assigned_to_department = dept.id
      ORDER BY d.created_at DESC
    `;

    const documents = await DatabaseService.query(sql);
    console.log('Found documents:', documents.length);

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Fetch documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}