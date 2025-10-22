import { DatabaseService } from "./database";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

// ✅ Expanded interface to include all possible JWT ID fields
export interface DecodedToken {
  userId?: string;
  id?: string;
  sub?: string;
  uid?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role_id: string;
  role?: string;
}

interface Permission {
  id: string;
  name: string;
  slug: string;
  category?: string;
}

export class AuthService {
  // ✅ Get JWT secret key
  private static getJwtSecret(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is not set");
    }
    return new TextEncoder().encode(secret);
  }

  // ✅ Register user
  static async registerUser(data: {
    name: string;
    email: string;
    password: string;
    roleId: string;
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const sql = `
      INSERT INTO users (name, email, password, role_id)
      VALUES (?, ?, ?, ?)
    `;
    await DatabaseService.query(sql, [
      data.name,
      data.email,
      hashedPassword,
      data.roleId,
    ]);
  }

  // ✅ Authenticate user and return token
  static async authenticateUser(email: string, password: string) {
    const sql = `
      SELECT u.*, r.name AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
      LIMIT 1
    `;

    const users = (await DatabaseService.query(sql, [email])) as User[];
    const user = users.length > 0 ? users[0] : null;

    if (!user || !user.password) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error("Invalid credentials");

    // Create JWT token using jose
    const token = await new SignJWT({
      userId: user.id,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.getJwtSecret());

    return { user, token };
  }

  // ✅ Get user by ID
  static async getUserById(userId: string): Promise<User | null> {
    const sql = `
      SELECT u.*, r.name AS role
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `;

    const users = (await DatabaseService.query(sql, [userId])) as User[];
    return users.length > 0 ? users[0] : null;
  }

  // ✅ Get all permissions assigned to user (direct or via role)
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    const sql = `
      SELECT DISTINCT p.id, p.name, p.slug, p.category
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      INNER JOIN users u ON u.role_id = rp.role_id
      WHERE u.id = ?

      UNION

      SELECT DISTINCT p.id, p.name, p.slug, p.category
      FROM permissions p
      INNER JOIN user_permissions up ON up.permission_id = p.id
      WHERE up.user_id = ?
    `;

    const permissions = (await DatabaseService.query(sql, [
      userId,
      userId,
    ])) as Permission[];
    return permissions;
  }

  // ✅ Verify JWT token — typed safely for all token variations
  static async verifyToken(token: string): Promise<DecodedToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.getJwtSecret());
      return payload as DecodedToken;
    } catch {
      return null;
    }
  }

  // ✅ Return user with permissions (for session initialization)
  static async getUserWithPermissions(
    userId: string
  ): Promise<{ user: User | null; permissions: Permission[] }> {
    const user = await this.getUserById(userId);
    if (!user) return { user: null, permissions: [] };

    const permissions = await this.getUserPermissions(userId);
    return { user, permissions };
  }
}
