import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const assignmentType = formData.get('assignmentType') as string;
    const assignedToUser = formData.get('assignedToUser') as string;
    const assignedToDepartment = formData.get('assignedToDepartment') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);

    // Save to database
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sql = `
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, assigned_to_department, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    await DatabaseService.query(sql, [
      documentId,
      title,
      `/uploads/documents/${fileName}`,
      file.size,
      file.type,
      decoded.userId,
      assignmentType === 'user' ? assignedToUser : null,
      assignmentType === 'department' ? assignedToDepartment : null
    ]);

    // Log activity
    const activitySql = `
      INSERT INTO activity_logs (id, document_id, user_id, action, details)
      VALUES (?, ?, ?, 'document_uploaded', JSON_OBJECT('title', ?, 'assignment_type', ?))
    `;
    
    await DatabaseService.query(activitySql, [
      `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      decoded.userId,
      title,
      assignmentType
    ]);

    // Create notifications
    if (assignmentType === 'user' && assignedToUser) {
      const notificationSql = `
        INSERT INTO notifications (id, user_id, type, message, related_document_id)
        VALUES (?, ?, 'document_assigned', ?, ?)
      `;
      
      await DatabaseService.query(notificationSql, [
        `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        assignedToUser,
        `New document "${title}" has been assigned to you`,
        documentId
      ]);
    }

    return NextResponse.json({ 
      message: 'Document uploaded successfully',
      documentId 
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}