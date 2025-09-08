import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD STARTED ===');
    
    // Get user from token
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      console.log('❌ No auth token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      console.log('❌ Invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('✅ User authenticated:', decoded.userId);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const assignmentType = formData.get('assignmentType') as string;
    const assignedUsers = formData.getAll('assignedUsers') as string[];
    const assignedDepartments = formData.getAll('assignedDepartments') as string[];

    console.log('📝 Form data received:', {
      title,
      description,
      assignmentType,
      assignedUsers,
      assignedDepartments,
      fileSize: file?.size,
      fileName: file?.name
    });

    if (!file || !title) {
      console.log('❌ Missing required fields');
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(uploadsDir, { recursive: true });
    console.log('📁 Upload directory ready:', uploadsDir);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);
    
    await writeFile(filePath, buffer);
    console.log('💾 File saved:', fileName);

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine assignment based on type
    const assignedToUser = assignmentType === 'user' && assignedUsers.length > 0 ? assignedUsers[0] : null;
    const assignedToDepartment = assignmentType === 'department' && assignedDepartments.length > 0 ? assignedDepartments[0] : null;

    console.log('🎯 Assignment details:', {
      assignmentType,
      assignedToUser,
      assignedToDepartment
    });

    // Insert document into database using your actual column names
    const sql = `
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, assigned_to_department, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    const insertParams = [
      documentId,
      title,
      `/uploads/documents/${fileName}`,
      file.size,
      file.type,
      decoded.userId,
      assignedToUser,
      assignedToDepartment
    ];

    console.log('🗄️ Inserting document with params:', insertParams);

    await DatabaseService.query(sql, insertParams);
    console.log('✅ Document inserted successfully');

    // Log activity (if activity_logs table exists)
    try {
      const activitySql = `
        INSERT INTO activity_logs (id, document_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, 'document_uploaded', ?, NOW())
      `;
      
      await DatabaseService.query(activitySql, [
        `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        decoded.userId,
        JSON.stringify({ title, assignment_type: assignmentType })
      ]);
      console.log('📊 Activity logged');
    } catch (activityError) {
      console.log('⚠️ Activity logging failed (table may not exist):', activityError);
    }

    // Create notifications for assigned users (if notifications table exists)
    if (assignmentType === 'user' && assignedUsers.length > 0) {
      try {
        for (const userId of assignedUsers) {
          const notificationSql = `
            INSERT INTO notifications (id, user_id, message, created_at)
            VALUES (?, ?, ?, NOW())
          `;
          
          await DatabaseService.query(notificationSql, [
            `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            `New document "${title}" has been assigned to you`
          ]);
        }
        console.log('🔔 Notifications created');
      } catch (notificationError) {
        console.log('⚠️ Notification creation failed (table may not exist):', notificationError);
      }
    }

    console.log('🎉 Upload completed successfully!');

    return NextResponse.json({ 
      message: 'Document uploaded successfully',
      documentId 
    });

  } catch (error) {
    console.error('💥 Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}