// app/api/documents/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  // Helper: safe logger for DB errors
  const logDbError = (label: string, err: any) => {
    console.error(label);
    try {
      console.error(err);
      if (err?.stack) console.error(err.stack);
      if (err?.sql) console.error("SQL:", err.sql);
      if (err?.message) console.error("Message:", err.message);
    } catch (e) {
      console.error("Failed to log dbErr details:", e);
    }
  };

  let filePath: string | null = null;

  try {
    console.log("=== LOCAL FILE UPLOAD STARTED ===");

    // Authentication
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized - invalid token payload" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) ?? "";
    const description = (formData.get("description") as string) ?? "";
    const assignmentType = (formData.get("assignmentType") as string) ?? "";
    const assignedRole = (formData.get("assignedRole") as string) ?? "";
    const selectedUser = (formData.get("selectedUser") as string) ?? "";

    console.log("📋 Upload form data:", {
      title,
      description,
      assignmentType,
      assignedRole,
      selectedUser,
      file: file ? { name: file.name, size: file.size, type: file.type } : null,
    });

    if (!file || !title) {
      return NextResponse.json(
        { error: "File and title are required" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    if (!selectedUser) {
      return NextResponse.json(
        { error: "User assignment is required" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Define local storage path
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "documents"
    );
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate a unique file name
    const timestamp = Date.now();
    const safeFileName = file.name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const fileName = `${timestamp}-${safeFileName}`;
    filePath = path.join(uploadDir, fileName);

    // Write file to local disk
    fs.writeFileSync(filePath, buffer);

    // File URL (publicly accessible)
    const fileUrl = `/uploads/documents/${fileName}`;

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Prepare SQL for documents insert
    const docSql = `
      INSERT INTO documents
      (id, title, file_path, file_size, mime_type, uploaded_by, status, created_at, updated_at, description)
      VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW(), ?)
    `;
    const docParams = [
      documentId,
      title,
      fileUrl,
      buffer.length,
      file.type,
      userId,
      description,
    ];

    // Insert document row
    try {
      await DatabaseService.query(docSql, docParams);
      console.log("✅ Document row inserted:", documentId);
    } catch (docErr) {
      // Document insert failed — remove uploaded file and return error
      logDbError("Document INSERT failed:", docErr);
      // cleanup file
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(
            "🗑️ Removed uploaded file after document insert failure:",
            filePath
          );
        }
      } catch (unlinkErr) {
        console.error(
          "Failed to remove file after document insert failure:",
          unlinkErr
        );
      }
      return NextResponse.json(
        {
          error: "Failed to insert document",
          detail: String(docErr?.message ?? docErr),
        },
        { status: 500 }
      );
    }

    // Prepare assignment insert SQL with both role_id and assigned_to
    const assignmentId = randomUUID();
    const assignmentSql = `
      INSERT INTO document_assignments
        (id, document_id, assigned_to, assigned_by, role_id, roles, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const assignmentParams = [
      assignmentId,
      documentId,
      selectedUser, // Now using the specific user ID instead of null
      userId,
      assignedRole, // role_id (keeping for reference)
      "Reviewer", // roles field (keeping for backward compatibility)
      "assigned",
    ];

    // Insert assignment row
    try {
      await DatabaseService.query(assignmentSql, assignmentParams);
      console.log("✅ Assignment row inserted with user:", assignmentId);

      // Create notification for the specific assigned user
      try {
        // Get uploader's name for the notification message
        const uploaderResult = await DatabaseService.query(
          "SELECT name FROM users WHERE id = ?",
          [userId]
        );

        let uploaderName = "A user";
        if (Array.isArray(uploaderResult)) {
          const rows = Array.isArray(uploaderResult[0])
            ? uploaderResult[0]
            : uploaderResult;
          uploaderName = rows[0]?.name || "A user";
        }

        // Get assigned user's details for verification
        const assignedUserResult = await DatabaseService.query(
          "SELECT id, name, email FROM users WHERE id = ?",
          [selectedUser]
        );

        let assignedUserName = "the user";
        let assignedUserId = selectedUser;

        if (Array.isArray(assignedUserResult)) {
          const rows = Array.isArray(assignedUserResult[0])
            ? assignedUserResult[0]
            : assignedUserResult;
          if (rows[0]) {
            assignedUserName = rows[0].name || "the user";
            assignedUserId = rows[0].id;
          }
        }

        console.log("🔔 Notification details:", {
          uploaderId: userId,
          uploaderName,
          assignedUserId: assignedUserId,
          assignedUserName,
          selectedUserFromForm: selectedUser,
        });

        const notificationMessage = `${uploaderName} assigned the document "${title}" to you`;

        // Create notification for the specific assigned user
        const notificationId = randomUUID();
        const notificationSql = `
          INSERT INTO notifications 
          (id, user_id, type, message, related_document_id, sender_id, is_read, created_at)
          VALUES (?, ?, 'document_assigned', ?, ?, ?, 0, NOW())
        `;

        const notificationParams = [
          notificationId,
          assignedUserId, // Send to the specific assigned user (using verified ID from DB)
          notificationMessage,
          documentId,
          userId, // Sender is the uploader
        ];

        console.log(
          "🔔 Creating notification with params:",
          notificationParams
        );

        await DatabaseService.query(notificationSql, notificationParams);

        console.log(
          `✅ Notification created for user: ${assignedUserName} (ID: ${assignedUserId})`
        );

        // Verify notification was created
        const verifyNotification = await DatabaseService.query(
          "SELECT id, user_id, message FROM notifications WHERE id = ?",
          [notificationId]
        );
        console.log("🔔 Notification verification:", verifyNotification);
      } catch (notifyErr) {
        // Don't fail the upload if notification fails
        console.error("❌ Failed to create notification:", notifyErr);
        logDbError("Notification creation error:", notifyErr);

        // Log additional debug info
        console.error("🔔 Notification error context:", {
          selectedUser,
          userId,
          documentId,
          title,
        });
      }

      // Success response: return assignment metadata
      return NextResponse.json(
        {
          message: "Document uploaded successfully",
          documentId,
          fileUrl,
          assignment: {
            id: assignmentId,
            document_id: documentId,
            assigned_to: selectedUser,
            assigned_by: userId,
            role_id: assignedRole,
            roles: "Reviewer",
            status: "assigned",
          },
        },
        { status: 201 }
      );
    } catch (assignErr) {
      // Assignment insert failed — log full error, delete the document row and file to avoid orphans
      logDbError("Assignment INSERT failed:", assignErr);

      // attempt to delete the previously inserted document row
      try {
        await DatabaseService.query("DELETE FROM documents WHERE id = ?", [
          documentId,
        ]);
        console.log(
          "🗑️ Deleted document row after assignment insert failure:",
          documentId
        );
      } catch (delErr) {
        logDbError(
          "Failed to delete document row after assignment failure:",
          delErr
        );
      }

      // remove the uploaded file
      try {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(
            "🗑️ Removed uploaded file after assignment failure:",
            filePath
          );
        }
      } catch (unlinkErr) {
        logDbError(
          "Failed to remove file after assignment insert failure:",
          unlinkErr
        );
      }

      return NextResponse.json(
        {
          error: "Failed to create document assignment",
          detail: String(assignErr?.message ?? assignErr),
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("💥 Upload error (outer):", error);
    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("🗑️ Removed uploaded file after outer error:", filePath);
        }
      } catch (e) {
        console.error("Failed to remove file in outer error:", e);
      }
    }
    return NextResponse.json(
      { error: error?.message ?? "Failed to upload document" },
      { status: 500 }
    );
  }
}
