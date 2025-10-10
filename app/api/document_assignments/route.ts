import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await AuthService.verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    console.log("📋 [ASSIGNMENT HISTORY] Fetching for document:", documentId);

    // Get assignments directly
    const assignmentsResult = await DatabaseService.query(
      "SELECT * FROM document_assignments WHERE document_id = ? ORDER BY created_at DESC",
      [documentId]
    );

    console.log(
      "📋 [ASSIGNMENT HISTORY] Raw assignments result:",
      assignmentsResult
    );

    // Handle different database response structures
    let assignments = [];
    if (Array.isArray(assignmentsResult)) {
      if (assignmentsResult.length > 0 && Array.isArray(assignmentsResult[0])) {
        assignments = assignmentsResult[0]; // MySQL2 format [rows, fields]
      } else {
        assignments = assignmentsResult; // Direct rows array
      }
    } else if (assignmentsResult) {
      assignments = [assignmentsResult]; // Single row object
    }

    console.log("📋 [ASSIGNMENT HISTORY] Extracted assignments:", assignments);

    // If we have assignments, get user names
    if (assignments.length > 0) {
      // Extract all user IDs from assignments
      const userIds = [
        ...new Set(
          assignments
            .flatMap((a) => [a.assigned_to, a.assigned_by])
            .filter(Boolean)
        ),
      ];

      console.log("📋 [ASSIGNMENT HISTORY] User IDs to lookup:", userIds);

      if (userIds.length > 0) {
        // Get user names
        const usersResult = await DatabaseService.query(
          `SELECT id, name FROM users WHERE id IN (${userIds
            .map(() => "?")
            .join(",")})`,
          userIds
        );

        let users = [];
        if (Array.isArray(usersResult)) {
          if (usersResult.length > 0 && Array.isArray(usersResult[0])) {
            users = usersResult[0];
          } else {
            users = usersResult;
          }
        } else if (usersResult) {
          users = [usersResult];
        }

        console.log("📋 [ASSIGNMENT HISTORY] Users found:", users);

        // Create user map for easy lookup
        const userMap = new Map(users.map((u) => [u.id, u.name]));

        // Enhance assignments with user names
        assignments = assignments.map((assignment) => ({
          assignment_id: assignment.id,
          document_id: assignment.document_id,
          assigned_to: assignment.assigned_to,
          assigned_to_name: userMap.get(assignment.assigned_to) || null,
          assigned_by: assignment.assigned_by,
          assigned_by_name: userMap.get(assignment.assigned_by) || null,
          roles: assignment.roles || null,
          status: assignment.status || null,
          notified_at: assignment.notified_at
            ? new Date(assignment.notified_at).toISOString()
            : null,
          assigned_at: assignment.created_at
            ? new Date(assignment.created_at).toISOString()
            : null,
          updated_at: assignment.updated_at
            ? new Date(assignment.updated_at).toISOString()
            : null,
        }));
      }
    }

    console.log(
      "📋 [ASSIGNMENT HISTORY] Final processed assignments:",
      assignments
    );

    return NextResponse.json({ assignments }, { status: 200 });
  } catch (err: any) {
    console.error("❌ Fetch assignment history error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}
