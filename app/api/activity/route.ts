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

    const sql = `
      SELECT 
        al.*,
        u.name as user_name,
        d.title as document_title
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN documents d ON al.document_id = d.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `;

    const activities = await DatabaseService.query(sql);

    return NextResponse.json({ activities });

  } catch (error) {
    console.error('Fetch activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}