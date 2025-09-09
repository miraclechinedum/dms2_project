import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let whereClause = '';
    let params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE al.created_at BETWEEN ? AND ?';
      params = [startDate, endDate];
    }

    const sql = `
      SELECT 
        al.*,
        u.name as user_name,
        d.title as document_title,
        DATE(al.created_at) as activity_date
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN documents d ON al.document_id = d.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT 100
    `;

    const activities = await DatabaseService.query(sql, params);

    // Get activity stats
    const statsQueries = [
      // Current month
      `SELECT COUNT(*) as count FROM activity_logs WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      // Current day
      `SELECT COUNT(*) as count FROM activity_logs WHERE DATE(created_at) = CURRENT_DATE()`,
      // Current week
      `SELECT COUNT(*) as count FROM activity_logs WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURRENT_DATE(), 1)`
    ];

    const [monthResult, dayResult, weekResult] = await Promise.all(
      statsQueries.map(query => DatabaseService.query(query))
    );

    const stats = {
      currentMonth: Array.isArray(monthResult) ? (monthResult[0] as any)?.count || 0 : 0,
      currentDay: Array.isArray(dayResult) ? (dayResult[0] as any)?.count || 0 : 0,
      currentWeek: Array.isArray(weekResult) ? (weekResult[0] as any)?.count || 0 : 0,
    };

    return NextResponse.json({ activities, stats });

  } catch (error) {
    console.error('Fetch activities error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}