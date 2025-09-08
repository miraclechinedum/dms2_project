import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { AuthService } from '@/lib/auth';
import { CloudinaryService } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    console.log("=== CLOUDINARY UPLOAD STARTED ===");

    // Authentication
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      console.log("❌ No auth token found");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    const userId = decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      console.log("❌ Token found but no user id in payload:", decoded);
      return NextResponse.json({ error: 'Unauthorized - invalid token payload' }, { status: 401 });
    }
    console.log("✅ User authenticated:", userId);

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const assignmentType = formData.get('assignmentType') as string;
    const assignedUsers = formData.getAll('assignedUsers') as string[];
    const assignedDepartments = formData.getAll('assignedDepartments') as string[];

    console.log("📝 Form data received:", {
      title,
      description,
      assignmentType,
      assignedUsers,
      assignedDepartments,
      fileSize: file?.size,
      fileName: file?.name,
    });

    if (!file || !title) {
      console.log("❌ Missing required fields");
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      console.log("❌ Invalid file type:", file.type);
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Convert file to buffer for Cloudinary upload
    console.log("🔄 Converting file to buffer...");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    console.log("☁️ Uploading to Cloudinary...");
    const cloudinaryResult = await CloudinaryService.uploadFile(
      buffer,
      file.name,
      'documents' // Cloudinary folder
    );
    console.log("✅ Cloudinary upload successful:", {
      public_id: cloudinaryResult.public_id,
      secure_url: cloudinaryResult.secure_url,
      bytes: cloudinaryResult.bytes
    });

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine assignment
    const assignedToUser = assignmentType === 'user' && assignedUsers.length > 0 ? assignedUsers[0] : null;
    const assignedToDepartment = assignmentType === 'department' && assignedDepartments.length > 0 ? assignedDepartments[0] : null;

    console.log("🎯 Assignment details:", {
      assignmentType,
      assignedToUser,
      assignedToDepartment,
    });

    // Insert document into database with Cloudinary URLs
    console.log("🗄️ Inserting document into database...");
    const sql = `
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, assigned_to_department, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    const insertParams = [
      documentId,
      title,
      cloudinaryResult.secure_url, // Store Cloudinary URL instead of local path
      cloudinaryResult.bytes,
      file.type,
      userId,
      assignedToUser,
      assignedToDepartment
    ];

    console.log("📊 Insert parameters:", insertParams);
    await DatabaseService.query(sql, insertParams);
    console.log("✅ Document inserted successfully");

    // Store Cloudinary public_id for future operations (optional - for deletion)
    // You might want to add a cloudinary_public_id column to your documents table
    
    // Log activity (best-effort)
    try {
      const activitySql = `
        INSERT INTO activity_logs (id, document_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, 'document_uploaded', ?, NOW())
      `;
      await DatabaseService.query(activitySql, [
        `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        userId,
        JSON.stringify({ 
          title, 
          assignment_type: assignmentType,
          cloudinary_public_id: cloudinaryResult.public_id 
        })
      ]);
      console.log("📊 Activity logged");
    } catch (activityError) {
      console.log("⚠️ Activity logging failed (table may not exist):", activityError);
    }

    // Create notifications for assigned users (best-effort)
    if (assignmentType === 'user' && assignedUsers.length > 0) {
      try {
        const notificationSql = `
          INSERT INTO notifications (id, user_id, message, created_at)
          VALUES (?, ?, ?, NOW())
        `;
        for (const uId of assignedUsers) {
          await DatabaseService.query(notificationSql, [
            `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            uId,
            `New document "${title}" has been assigned to you`
          ]);
        }
        console.log("🔔 Notifications created");
      } catch (notificationError) {
        console.log("⚠️ Notification creation failed (table may not exist):", notificationError);
      }
    }

    console.log("🎉 Upload completed successfully!");
    return NextResponse.json({
      message: 'Document uploaded successfully',
      documentId,
      cloudinaryUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id
    }, { status: 201 });

  } catch (error: any) {
    console.error("💥 Upload error:", error);
    return NextResponse.json({
      error: error?.message ?? 'Failed to upload document'
    }, { status: 500 });
  }
}