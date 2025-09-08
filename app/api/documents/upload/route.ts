// app/api/documents/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, rename, unlink } from "fs/promises";
import { join } from "path";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let finalFilePathOnDisk: string | null = null;

  try {
    console.log("=== UPLOAD STARTED ===");

    // --- AUTH (ensure we await verifyToken even if it's sync or async) ---
    const token = request.cookies.get("auth-token")?.value;
    if (!token) {
      console.log("❌ No auth token found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support both sync and async verifyToken
    const decoded = await Promise.resolve(AuthService.verifyToken(token));
    console.log("🔍 Token payload (raw):", decoded);

    const userId =
      decoded?.userId ?? decoded?.id ?? decoded?.sub ?? decoded?.uid ?? null;

    if (!userId) {
      console.log("❌ Token found but no user id in payload:", decoded);
      return NextResponse.json(
        { error: "Unauthorized - invalid token payload" },
        { status: 401 }
      );
    }
    console.log("✅ User authenticated:", userId);

    // --- PARSE FORM DATA ---
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleRaw = formData.get("title");
    const descriptionRaw = formData.get("description");
    const assignmentTypeRaw = formData.get("assignmentType");

    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const description = typeof descriptionRaw === "string" ? descriptionRaw : "";
    const assignmentType =
      typeof assignmentTypeRaw === "string" ? assignmentTypeRaw : "";

    const assignedUsers = formData.getAll("assignedUsers").map((v) => String(v));
    const assignedDepartments = formData
      .getAll("assignedDepartments")
      .map((v) => String(v));

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
      return NextResponse.json(
        { error: "File and title are required" },
        { status: 400 }
      );
    }

    // --- SAVE TO TEMP, THEN MOVE AFTER DB INSERT ---
    // Create temp and final dirs
    const tmpDir = join(process.cwd(), "public", "uploads", "tmp");
    const finalDir = join(process.cwd(), "public", "uploads", "documents");
    await mkdir(tmpDir, { recursive: true });
    await mkdir(finalDir, { recursive: true });

    // Write to a tmp file first
    const tmpName = `tmp-${Date.now()}-${file.name}`;
    const tmpPath = join(tmpDir, tmpName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tmpPath, buffer);
    console.log("🟨 Temp file saved:", tmpPath);

    // Build final file name and move (rename) temp -> final
    const finalName = `${Date.now()}-${file.name}`;
    const finalPath = join(finalDir, finalName);
    await rename(tmpPath, finalPath);
    finalFilePathOnDisk = finalPath; // record to possibly clean up on error
    console.log("🟩 File moved to final location:", finalPath);

    // --- DB INSERT ---
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const assignedToUser =
      assignmentType === "user" && assignedUsers.length > 0 ? assignedUsers[0] : null;
    const assignedToDepartment =
      assignmentType === "department" && assignedDepartments.length > 0
        ? assignedDepartments[0]
        : null;

    console.log("🎯 Assignment details:", {
      assignmentType,
      assignedToUser,
      assignedToDepartment,
    });

    const sql = `
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, assigned_to_department, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    const insertParamsRaw = [
      documentId,
      title,
      `/uploads/documents/${finalName}`,
      typeof (file as any).size === "number" ? (file as any).size : Number(file.size ?? 0),
      file.type ?? "application/octet-stream",
      userId,
      assignedToUser,
      assignedToDepartment,
    ];

    const insertParams = insertParamsRaw.map((v) => (v === undefined ? null : v));
    console.log("🗄️ Inserting document with params:", insertParams);

    await DatabaseService.query(sql, insertParams);
    console.log("✅ Document inserted successfully");

    // --- Activity log (best-effort) ---
    try {
      const activitySql = `
        INSERT INTO activity_logs (id, document_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, 'document_uploaded', ?, NOW())
      `;
      await DatabaseService.query(activitySql, [
        `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        documentId,
        userId,
        JSON.stringify({ title, assignment_type: assignmentType }),
      ].map((v) => (v === undefined ? null : v)));
      console.log("📊 Activity logged");
    } catch (activityError) {
      console.log("⚠️ Activity logging failed (table may not exist):", activityError);
    }

    // --- Notifications for user assignments (best-effort) ---
    if (assignmentType === "user" && assignedUsers.length > 0) {
      try {
        const notificationSql = `
          INSERT INTO notifications (id, user_id, message, created_at)
          VALUES (?, ?, ?, NOW())
        `;
        for (const uId of assignedUsers) {
          await DatabaseService.query(notificationSql, [
            `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            uId,
            `New document "${title}" has been assigned to you`,
          ].map((v) => (v === undefined ? null : v)));
        }
        console.log("🔔 Notifications created");
      } catch (notificationError) {
        console.log("⚠️ Notification creation failed (table may not exist):", notificationError);
      }
    }

    console.log("🎉 Upload completed successfully!");
    return NextResponse.json(
      {
        message: "Document uploaded successfully",
        documentId,
        filePath: `/uploads/documents/${finalName}`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    // If an error happens AFTER the file has been moved to final path, delete it to avoid orphans.
    console.error("💥 Upload error:", error);
    if (finalFilePathOnDisk) {
      try {
        await unlink(finalFilePathOnDisk);
        console.log("🧹 Orphan file removed:", finalFilePathOnDisk);
      } catch (e) {
        console.log("⚠️ Failed to remove orphan file:", e);
      }
    }
    // If auth failed earlier we already returned 401, but general fallback:
    return NextResponse.json(
      { error: error?.message ?? "Failed to upload document" },
      { status: 500 }
    );
  }
}
