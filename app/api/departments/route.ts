import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sql = 'SELECT * FROM departments ORDER BY name';
    const departments = await DatabaseService.query(sql);

    return NextResponse.json({ departments });

  } catch (error) {
    console.error('Fetch departments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}