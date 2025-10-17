// app/api/documents/[id]/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔐 [AUTH DEBUG] Token found, verifying...");

    const user = await AuthService.verifyToken(token);
    if (!user) {
      console.log("❌ [AUTH DEBUG] Token verification failed");
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    console.log("✅ [AUTH DEBUG] Token verified successfully");
    console.log("👤 [AUTH DEBUG] User from token:", {
      id: user.id,
      userId: user.userId,
      type: typeof user.userId,
      fullUser: user,
    });

    // USE user.userId INSTEAD OF user.id
    const currentUserId = user.userId;
    if (!currentUserId) {
      console.log("❌ No user ID found in token");
      return NextResponse.json(
        { error: "User ID not found in token" },
        { status: 401 }
      );
    }

    const documentId = params.id;
    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const { assigned_to, notify = false } = await request.json();
    if (!assigned_to) {
      return NextResponse.json(
        { error: "assigned_to is required" },
        { status: 400 }
      );
    }

    console.log("🚀 [BACKEND] Starting assignment process");
    console.log("Document ID:", documentId);
    console.log(
      "Current user ID from token:",
      currentUserId,
      typeof currentUserId
    );
    console.log("New assignee ID:", assigned_to, typeof assigned_to);

    // Verify document exists and get current assignment
    const documentCheck = await DatabaseService.query(
      "SELECT id, title, assigned_to_user FROM documents WHERE id = ?",
      [documentId]
    );

    if (!documentCheck || documentCheck.length === 0) {
      console.log("❌ Document not found");
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const document = documentCheck[0];
    const currentAssignee = document?.assigned_to_user;
    const documentTitle = document?.title;

    // Enhanced debug logging
    console.log("🔍 [BACKEND DEBUG] Detailed Assignment Check:");
    console.log("Document record:", document);
    console.log(
      "Current assignee from DB:",
      currentAssignee,
      typeof currentAssignee
    );
    console.log(
      "Current user ID from token:",
      currentUserId,
      typeof currentUserId
    );

    // Convert all IDs to strings for consistent comparison
    const currentAssigneeStr = currentAssignee ? String(currentAssignee) : null;
    const userIdStr = String(currentUserId);

    console.log("After string conversion:");
    console.log("Current assignee (string):", currentAssigneeStr);
    console.log("Current user (string):", userIdStr);
    console.log("Are they equal?", currentAssigneeStr === userIdStr);
    console.log("Is document unassigned?", !currentAssigneeStr);

    // Permission logic:
    // Allow if: document is unassigned OR current user is the assignee
    const hasPermission =
      !currentAssigneeStr || currentAssigneeStr === userIdStr;

    console.log("User has permission to reassign?", hasPermission);

    if (!hasPermission) {
      console.log("❌ Permission denied: User is not the current assignee");
      console.log("Current assignee:", JSON.stringify(currentAssigneeStr));
      console.log("Current user:", JSON.stringify(userIdStr));
      console.log(
        "Length comparison - Assignee:",
        currentAssigneeStr?.length,
        "User:",
        userIdStr.length
      );
      return NextResponse.json(
        {
          error: "Only the current assignee can reassign the document",
        },
        { status: 403 }
      );
    }

    console.log("✅ Permission granted: User can reassign document");

    // Prevent self-assignment
    if (String(assigned_to) === userIdStr) {
      console.log("❌ Cannot assign to self");
      return NextResponse.json(
        { error: "Cannot assign document to yourself" },
        { status: 400 }
      );
    }

    // Update document assignment
    console.log("Updating document assignment...");
    const updateResult = await DatabaseService.query(
      "UPDATE documents SET assigned_to_user = ? WHERE id = ?",
      [assigned_to, documentId]
    );

    console.log("Update result:", updateResult);

    // Create assignment record
    const assignmentId = randomUUID();
    console.log("Creating assignment record...");
    await DatabaseService.query(
      `INSERT INTO document_assignments 
       (id, document_id, assigned_to, assigned_by, roles, status, notified_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        assignmentId,
        documentId,
        assigned_to,
        currentUserId, // Use currentUserId instead of user.id
        "Reviewer",
        "assigned",
        notify ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
      ]
    );

    // Create notification for the assigned user
    try {
      console.log("🔔 Creating notification for assigned user...");

      // Get current user's name for the notification message
      const currentUserResult = await DatabaseService.query(
        "SELECT name FROM users WHERE id = ?",
        [currentUserId]
      );

      let currentUserName = "A user";
      if (Array.isArray(currentUserResult)) {
        const rows = Array.isArray(currentUserResult[0])
          ? currentUserResult[0]
          : currentUserResult;
        currentUserName = rows[0]?.name || "A user";
      }

      // Get assigned user's details for verification
      const assignedUserResult = await DatabaseService.query(
        "SELECT id, name, email FROM users WHERE id = ?",
        [assigned_to]
      );

      let assignedUserName = "the user";
      let assignedUserId = assigned_to;

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
        currentUserId,
        currentUserName,
        assignedUserId: assignedUserId,
        assignedUserName,
        documentTitle,
      });

      const notificationMessage = `${currentUserName} assigned the document "${documentTitle}" to you`;

      // Create notification for the specific assigned user
      const notificationId = randomUUID();
      const notificationSql = `
        INSERT INTO notifications 
        (id, user_id, type, message, related_document_id, sender_id, is_read, created_at)
        VALUES (?, ?, 'document_assigned', ?, ?, ?, 0, NOW())
      `;

      const notificationParams = [
        notificationId,
        assignedUserId, // Send to the specific assigned user
        notificationMessage,
        documentId,
        currentUserId, // Sender is the current user who made the assignment
      ];

      console.log("🔔 Creating notification with params:", notificationParams);

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
      // Don't fail the assignment if notification fails
      console.error("❌ Failed to create notification:", notifyErr);
      console.error("🔔 Notification error context:", {
        assigned_to,
        currentUserId,
        documentId,
        documentTitle,
      });
    }

    // Fetch updated document with user names
    console.log("Fetching updated document...");
    const updatedDocResult = await DatabaseService.query(
      `SELECT 
         d.*, 
         u_assigned.name as assigned_user_name,
         u_uploader.name as uploader_name
       FROM documents d 
       LEFT JOIN users u_assigned ON u_assigned.id = d.assigned_to_user 
       LEFT JOIN users u_uploader ON u_uploader.id = d.uploaded_by
       WHERE d.id = ?`,
      [documentId]
    );

    const updatedDocument = updatedDocResult[0];
    console.log("✅ Assignment successful");
    console.log("New assignment:", updatedDocument.assigned_user_name);

    return NextResponse.json(
      {
        document: updatedDocument,
        message: "Document assigned successfully",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ Assign document error:", err);
    return NextResponse.json(
      {
        error: err?.message ?? "Failed to assign document",
      },
      { status: 500 }
    );
  }
}
