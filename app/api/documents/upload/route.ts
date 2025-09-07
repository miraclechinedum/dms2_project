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
    const description = formData.get('description') as string;
    const assignmentType = formData.get('assignmentType') as string;
    const assignedUsers = formData.getAll('assignedUsers') as string[];
    const assignedDepartments = formData.getAll('assignedDepartments') as string[];

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
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    await DatabaseService.query(sql, [
      documentId,
      title,
      `/uploads/documents/${fileName}`,
      file.size,
      file.type,
      decoded.userId
    ]);

    // Create document assignments
    if (assignmentType === 'user' && assignedUsers.length > 0) {
      for (const userId of assignedUsers) {
        const assignmentSql = `
          INSERT INTO document_assignments (id, document_id, assigned_to_user, created_at)
          VALUES (?, ?, ?, NOW())
        `;
        await DatabaseService.query(assignmentSql, [
          `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          documentId,
          userId
        ]);
      }
    } else if (assignmentType === 'department' && assignedDepartments.length > 0) {
      for (const deptId of assignedDepartments) {
        const assignmentSql = `
          INSERT INTO document_assignments (id, document_id, assigned_to_department, created_at)
          VALUES (?, ?, ?, NOW())
        `;
        await DatabaseService.query(assignmentSql, [
          `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          documentId,
          deptId
        ]);
      }
    }
    // Log activity
    const activitySql = `
      INSERT INTO activity_logs (id, document_id, user_id, action, details)
      VALUES (?, ?, ?, 'document_uploaded', ?)
    `;
    
    await DatabaseService.query(activitySql, [
      `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      decoded.userId,
      JSON.stringify({ title, assignment_type: assignmentType })
    ]);

    // Create notifications for assigned users
    if (assignmentType === 'user' && assignedUsers.length > 0) {
      for (const userId of assignedUsers) {
        const notificationSql = `
          INSERT INTO notifications (id, user_id, type, message, related_document_id, created_at)
          VALUES (?, ?, 'document_assigned', ?, ?, NOW())
        `;
        
        await DatabaseService.query(notificationSql, [
          `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          `New document "${title}" has been assigned to you`,
          documentId
        ]);
      }
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