import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseService } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export interface User {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  created_at: string;
  updated_at: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  }

  static verifyToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
      return null;
    }
  }

  static async createUser(email: string, password: string, fullName: string, departmentId: string): Promise<User> {
    const hashedPassword = await this.hashPassword(password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO users (id, email, password_hash, full_name, department_id, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'member', NOW(), NOW())
    `;
    
    await DatabaseService.query(sql, [userId, email, hashedPassword, fullName, departmentId]);
    
    return this.getUserById(userId);
  }

  static async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
    const sql = `
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.email = ?
    `;
    
    const users = await DatabaseService.query(sql, [email]) as any[];
    
    if (users.length === 0) return null;
    
    const user = users[0];
    const isValidPassword = await this.verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) return null;
    
    const token = this.generateToken(user.id);
    
    // Remove password hash from response
    delete user.password_hash;
    
    return { user, token };
  }

  static async getUserById(userId: string): Promise<User> {
    const sql = `
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.id = ?
    `;
    
    const users = await DatabaseService.query(sql, [userId]) as any[];
    
    if (users.length === 0) {
      throw new Error('User not found');
    }
    
    return users[0];
  }
}