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
    } catch (docErr: unknown) {
      // 🔧 FIXED: Properly typed error access
      const err = docErr as { message?: string } | string;
      logDbError("Document INSERT failed:", err);

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
          detail:
            typeof err === "string" ? err : err?.message ?? "Unknown error",
        },
        { status: 500 }
      );
    }

    // (Assignment + notification code unchanged)
    // ...
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
