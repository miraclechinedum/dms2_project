// app/api/document_assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

/**
 * Normalize various DB return shapes into an array of rows.
 * - Handles: [rows, fields], [[rows]], rows, objects with rows property
 */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && result !== null) {
    if (Array.isArray((result as any).rows)) return (result as any).rows;
    const maybeArray = Object.values(result);
    if (maybeArray.length > 0 && Array.isArray(maybeArray[0]))
      return maybeArray[0];
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // resolve canonical userId (not used further here but good to validate token)
    const requesterId = AuthService.extractUserId(decoded);
    if (!requesterId) {
      return NextResponse.json(
        { error: "Invalid token: missing user id" },
        { status: 401 }
      );
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

    // Get assignments directly (handle different DB response shapes)
    const assignmentsResult = await DatabaseService.query(
      "SELECT * FROM document_assignments WHERE document_id = ? ORDER BY created_at DESC",
      [documentId]
    );
    console.log(
      "📋 [ASSIGNMENT HISTORY] Raw assignments result:",
      assignmentsResult
    );

    // Explicitly type assignments so TS knows it's an array
    let assignments: any[] = normalizeRows(assignmentsResult);

    console.log("📋 [ASSIGNMENT HISTORY] Extracted assignments:", assignments);

    // If we have assignments, get user names
    if (assignments.length > 0) {
      // Build a flat array of user ids (assigned_to and assigned_by) in an ES5-compatible way
      const rawUserIds: any[] = assignments.reduce((acc: any[], a: any) => {
        if (a && a.assigned_to) acc.push(a.assigned_to);
        if (a && a.assigned_by) acc.push(a.assigned_by);
        return acc;
      }, []);

      // Remove falsy values and dedupe
      const filteredIds = rawUserIds.filter(Boolean);
      const uniqueUserIds: any[] = Array.from(new Set(filteredIds));

      console.log("📋 [ASSIGNMENT HISTORY] User IDs to lookup:", uniqueUserIds);

      let users: any[] = [];
      if (uniqueUserIds.length > 0) {
        const usersResult = await DatabaseService.query(
          `SELECT id, name FROM users WHERE id IN (${uniqueUserIds
            .map(() => "?")
            .join(",")})`,
          uniqueUserIds
        );

        users = normalizeRows(usersResult);
        console.log("📋 [ASSIGNMENT HISTORY] Users found:", users);
      }

      // Create user map for easy lookup
      const userMap = new Map(users.map((u) => [u.id, u.name]));

      // Enhance assignments with user names and normalize fields
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
