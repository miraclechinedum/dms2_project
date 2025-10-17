// app/api/debug/db-test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    console.log("🧪 [DB TEST] Testing database connection");

    // Test 1: Simple query without parameters
    const test1 = await DatabaseService.query("SELECT 1 + 1 as result");
    console.log("🧪 [DB TEST] Test 1 result:", test1);

    // Test 2: Query with string parameter
    const test2 = await DatabaseService.query("SELECT ? as test_param", [
      "hello",
    ]);
    console.log("🧪 [DB TEST] Test 2 result:", test2);

    // Test 3: Query with number parameters
    const test3 = await DatabaseService.query(
      "SELECT ? as limit_val, ? as offset_val",
      [5, 0]
    );
    console.log("🧪 [DB TEST] Test 3 result:", test3);

    // Test 4: Check if we can query notifications table
    const test4 = await DatabaseService.query(
      "SELECT COUNT(*) as count FROM notifications"
    );
    console.log("🧪 [DB TEST] Test 4 result:", test4);

    return NextResponse.json({
      success: true,
      tests: {
        test1,
        test2,
        test3,
        test4,
      },
    });
  } catch (err: any) {
    console.error("🧪 [DB TEST] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        sqlMessage: err.sqlMessage,
      },
      { status: 500 }
    );
  }
}
