import mysql from "mysql2/promise";

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "", // Your Laragon MySQL password
  database: process.env.DB_NAME || "document_management",
  port: parseInt(process.env.DB_PORT || "3306"),
  // Connection pool settings
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10"),
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  // Enable keep-alive to prevent connection timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool with enhanced error handling
let db: mysql.Pool;

try {
  db = mysql.createPool(dbConfig);

  // Test the connection
  db.getConnection()
    .then((connection) => {
      console.log("✅ Database connected successfully");
      connection.release();
    })
    .catch((error) => {
      console.error("❌ Database connection failed:", error.message);
    });

  // Handle pool errors
  db.on("error", (err) => {
    console.error("Database pool error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      console.log("Database connection was closed.");
    }
    if (err.code === "ER_CON_COUNT_ERROR") {
      console.log("Database has too many connections.");
    }
    if (err.code === "ECONNREFUSED") {
      console.log("Database connection was refused.");
    }
  });

  // Handle process termination
  process.on("SIGINT", async () => {
    console.log("Closing database pool...");
    await db.end();
    process.exit(0);
  });
} catch (error) {
  console.error("Failed to create database pool:", error);
  throw error;
}

// Database helper functions with enhanced error handling
export class DatabaseService {
  static async query(sql: string, params: any[] = []) {
    let connection;
    try {
      connection = await db.getConnection();
      const [rows] = await connection.execute(sql, params);
      return rows;
    } catch (error) {
      console.error("Database query error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        sql,
        params: params.map((p) =>
          typeof p === "string"
            ? p.substring(0, 100) + (p.length > 100 ? "..." : "")
            : p
        ),
      });

      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes("ER_CON_COUNT_ERROR")) {
          throw new Error(
            "Database connection limit exceeded. Please try again later."
          );
        }
        if (error.message.includes("ECONNREFUSED")) {
          throw new Error(
            "Cannot connect to database. Please check if MySQL is running."
          );
        }
        if (error.message.includes("ER_ACCESS_DENIED_ERROR")) {
          throw new Error(
            "Database access denied. Please check your credentials."
          );
        }
      }

      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  static async transaction(queries: Array<{ sql: string; params: any[] }>) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const results = [];
      for (const query of queries) {
        const [result] = await connection.execute(query.sql, query.params);
        results.push(result);
      }

      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      console.error("Database transaction error:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getConnection() {
    return await db.getConnection();
  }

  // Health check for database connection
  static async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query("SELECT 1 as health_check");
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  // Get pool statistics
  static async getPoolStats() {
    return {
      totalConnections: db.pool?.connectionLimit || 0,
      activeConnections: (db.pool as any)?._acquiringConnections?.length || 0,
      idleConnections: (db.pool as any)?._freeConnections?.length || 0,
      waitingConnections: (db.pool as any)?._connectionQueue?.length || 0,
    };
  }
}

// Export the pool for direct use if needed
export { db };

// Utility functions for common operations
export const dbUtils = {
  // Safe string formatting for LIKE queries
  escapeLike: (str: string) =>
    `%${str.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`,

  // Convert JavaScript date to MySQL datetime
  toMySQLDateTime: (date: Date) =>
    date.toISOString().slice(0, 19).replace("T", " "),

  // Pagination helper
  paginate: (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return { limit, offset };
  },

  // Build WHERE clause with multiple conditions
  buildWhereClause: (
    conditions: Record<string, any>,
    operator: "AND" | "OR" = "AND"
  ) => {
    const keys = Object.keys(conditions).filter(
      (key) => conditions[key] !== undefined && conditions[key] !== null
    );
    if (keys.length === 0) return { whereClause: "", params: [] };

    const whereClause = keys.map((key) => `${key} = ?`).join(` ${operator} `);
    const params = keys.map((key) => conditions[key]);

    return { whereClause: `WHERE ${whereClause}`, params };
  },
};

// Graceful shutdown
process.on("beforeExit", async () => {
  try {
    await db.end();
    console.log("Database pool closed gracefully");
  } catch (error) {
    console.error("Error closing database pool:", error);
  }
});

export default db;
