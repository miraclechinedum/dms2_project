// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";
import { AuthService } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get("auth-token")?.value ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await AuthService.verifyToken(token);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Extract user ID - try different possible property names
    const userId = payload.id || payload.userId || payload.user_id || payload.sub;
    
    if (!userId) {
      console.error("User ID not found in token payload:", payload);
      return NextResponse.json({ error: "User ID not found in token" }, { status: 400 });
    }

    console.log("Fetching stats for user:", userId);

    // Get total documents the user is associated with
    const totalDocumentsQuery = `
      SELECT COUNT(DISTINCT d.id) as total_count
      FROM documents d
      LEFT JOIN document_assignments da ON d.id = da.document_id
      WHERE d.uploaded_by = ? OR da.assigned_to = ?
    `;

    // Get documents currently assigned to the user
    const assignedToUserQuery = `
      SELECT COUNT(DISTINCT da1.document_id) as assigned_count
      FROM document_assignments da1
      WHERE da1.assigned_to = ?
      AND da1.created_at = (
        SELECT MAX(da2.created_at)
        FROM document_assignments da2
        WHERE da2.document_id = da1.document_id
      )
    `;

    // Get recent activity count (assignments from today)
    const recentActivityQuery = `
      SELECT COUNT(*) as activity_count
      FROM document_assignments 
      WHERE assigned_to = ? 
      AND DATE(created_at) = CURDATE()
    `;

    // Execute all queries
    const [totalResult, assignedResult, activityResult] = await Promise.all([
      DatabaseService.query(totalDocumentsQuery, [userId, userId]),
      DatabaseService.query(assignedToUserQuery, [userId]),
      DatabaseService.query(recentActivityQuery, [userId])
    ]);

    // Extract counts from results - handle different MySQL result formats
    const extractCount = (result: any, fieldName: string): number => {
      if (!result || !Array.isArray(result)) return 0;
      
      // Handle MySQL2 result format
      if (Array.isArray(result[0]) && result[0].length > 0) {
        return result[0][0]?.[fieldName] || 0;
      }
      
      // Handle direct array format
      if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') {
        return result[0][fieldName] || 0;
      }
      
      return 0;
    };

    const totalDocuments = extractCount(totalResult, 'total_count');
    const assignedToUser = extractCount(assignedResult, 'assigned_count');
    const recentActivity = extractCount(activityResult, 'activity_count');

    console.log("Dashboard stats:", { totalDocuments, assignedToUser, recentActivity });

    return NextResponse.json({
      totalDocuments,
      assignedToUser,
      recentActivity
    }, { status: 200 });

  } catch (err: any) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch dashboard stats" }, 
      { status: 500 }
    );
  }
}