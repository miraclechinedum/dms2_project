import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // Your Laragon MySQL password
  database: 'document_management',
  port: 3306,
};

// Create connection pool
export const db = mysql.createPool(dbConfig);

// Database helper functions
export class DatabaseService {
  static async query(sql: string, params: any[] = []) {
    try {
      const [rows] = await db.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
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
      throw error;
    } finally {
      connection.release();
    }
  }
}