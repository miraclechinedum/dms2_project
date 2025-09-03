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

    // Get user's department
    const user = await AuthService.getUserById(decoded.userId);

    // Build query based on user role and department
    let sql = `
      SELECT 
        d.*,
        u1.full_name as uploader_name,
        u2.full_name as assigned_user_name,
        dept.name as assigned_department_name
      FROM documents d
      LEFT JOIN users u1 ON d.uploaded_by = u1.id
      LEFT JOIN users u2 ON d.assigned_to_user = u2.id
      LEFT JOIN departments dept ON d.assigned_to_department = dept.id
      WHERE 
    `;

    let params = [];

    if (user.role === 'admin') {
      // Admins can see all documents
      sql += '1 = 1';
    } else {
      // Users can see documents assigned to them or their department
      sql += `
        (d.assigned_to_user = ? OR 
         d.assigned_to_department = ? OR 
         d.uploaded_by = ?)
      `;
      params = [decoded.userId, user.department_id, decoded.userId];
    }

    sql += ' ORDER BY d.created_at DESC';

    const documents = await DatabaseService.query(sql, params);

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Fetch documents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}