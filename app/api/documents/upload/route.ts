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
    const assignedUsers = formData.getAll("assignedUsers") as string[]; // may be []
    const assignedDepartments = formData.getAll(
      "assignedDepartments"
    ) as string[]; // may be []

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

    // Determine assignment target - use first selected user or current user as fallback
    let assignedToUser = userId; // Default to current user

    if (assignmentType === "user" && assignedUsers.length > 0) {
      assignedToUser = assignedUsers[0];
    }
    // If department assignment, we'll just assign to current user for now
    // since we removed department assignment functionality

    // Prepare SQL for documents insert
    const docSql = `
      INSERT INTO documents
      (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, status, created_at, updated_at, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW(), ?)
    `;
    const docParams = [
      documentId,
      title,
      fileUrl,
      buffer.length,
      file.type,
      userId,
      assignedToUser,
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

    // Prepare assignment insert SQL (REMOVED department_id)
    const assignmentId = randomUUID();
    const assignmentSql = `
      INSERT INTO document_assignments
        (id, document_id, assigned_to, assigned_by, roles, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const assignmentParams = [
      assignmentId,
      documentId,
      assignedToUser,
      userId,
      "Reviewer",
      "assigned",
    ];

    // Insert assignment row
    try {
      await DatabaseService.query(assignmentSql, assignmentParams);
      console.log("✅ Assignment row inserted:", assignmentId);

      // Create notification for the assigned user if they are not the uploader
      if (assignedToUser && assignedToUser !== userId) {
        try {
          const notificationId = randomUUID();

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

          const notificationMessage = `${uploaderName} assigned you the document "${title}"`;

          const notificationSql = `
            INSERT INTO notifications 
            (id, user_id, type, message, related_document_id, sender_id, is_read, created_at)
            VALUES (?, ?, 'document_assigned', ?, ?, ?, 0, NOW())
          `;

          await DatabaseService.query(notificationSql, [
            notificationId,
            assignedToUser,
            notificationMessage,
            documentId,
            userId,
          ]);

          console.log(
            "✅ Notification created for assigned user:",
            assignedToUser
          );
          console.log("📧 Notification message:", notificationMessage);
        } catch (notifyErr) {
          // Don't fail the upload if notification fails
          console.error("❌ Failed to create notification:", notifyErr);
          logDbError("Notification creation error:", notifyErr);
        }
      } else {
        console.log(
          "ℹ️ No notification needed - document assigned to uploader"
        );
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
            assigned_to: assignedToUser,
            assigned_by: userId,
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
