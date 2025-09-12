import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";

export async function POST(request: NextRequest) {
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
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const assignmentType = formData.get("assignmentType") as string;
    const assignedUsers = formData.getAll("assignedUsers") as string[];
    const assignedDepartments = formData.getAll("assignedDepartments") as string[];

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
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate a unique file name
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/\s+/g, "_"); // replace spaces
    const fileName = `${timestamp}-${safeFileName}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file to local disk
    fs.writeFileSync(filePath, buffer);

    // File URL (publicly accessible)
    const fileUrl = `/uploads/documents/${fileName}`;

    // Generate document ID
    const documentId = `doc_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Determine assignment
    const assignedToUser =
      assignmentType === "user" && assignedUsers.length > 0
        ? assignedUsers[0]
        : null;
    const assignedToDepartment =
      assignmentType === "department" && assignedDepartments.length > 0
        ? assignedDepartments[0]
        : null;

    // Insert into database
    const sql = `
      INSERT INTO documents (id, title, file_path, file_size, mime_type, uploaded_by, assigned_to_user, assigned_to_department, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `;

    const insertParams = [
      documentId,
      title,
      fileUrl, // Local file URL
      buffer.length,
      file.type,
      userId,
      assignedToUser,
      assignedToDepartment,
    ];

    await DatabaseService.query(sql, insertParams);

    console.log("✅ Document saved locally:", fileUrl);

    return NextResponse.json(
      {
        message: "Document uploaded successfully",
        documentId,
        fileUrl,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("💥 Upload error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to upload document" },
      { status: 500 }
    );
  }
}
