import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { DatabaseService } from "./database";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

export interface User {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  role: string;
  role_id: string | null;
  created_at: string;
  updated_at: string;
  department_name?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static async generateToken(
    userId: string,
    role: string = "user",
    roleId: string | null = null
  ): Promise<string> {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const alg = "HS256";

    return new SignJWT({ userId, role, roleId })
      .setProtectedHeader({ alg })
      .setExpirationTime("7d")
      .sign(secret);
  }

  static async verifyToken(
    token: string
  ): Promise<{ userId: string; role: string; roleId: string | null } | null> {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      // Make sure the payload has the expected structure
      if (payload && typeof payload === "object" && "userId" in payload) {
        return {
          userId: payload.userId as string,
          role: (payload.role as string) || "user",
          roleId: (payload.roleId as string) || null,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  static async createUser(
    email: string,
    password: string,
    name: string,
    departmentId: string,
    createdBy: string | null,
    roleId: string | null = null
  ) {
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate UUID in JS so we can return it
    const [userIdRow] = await DatabaseService.query(`SELECT UUID() as uuid`);
    const userId = userIdRow.uuid;

    const sql = `
      INSERT INTO users (id, name, email, password_hash, department_id, role_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await DatabaseService.query(sql, [
      userId,
      name,
      email,
      hashedPassword,
      departmentId,
      roleId,
      createdBy ?? null, // ensures it's never undefined
    ]);

    return { id: userId };
  }

  static async authenticateUser(
    email: string,
    password: string
  ): Promise<{ user: User; token: string } | null> {
    const sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.department_id, 
        u.password_hash, 
        u.role_id,
        r.name as role_name,
        u.created_at, 
        u.updated_at, 
        d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `;

    const users = (await DatabaseService.query(sql, [email])) as any[];

    if (users.length === 0) return null;

    const user = users[0];
    const isValidPassword = await this.verifyPassword(
      password,
      user.password_hash
    );

    if (!isValidPassword) return null;

    const token = await this.generateToken(
      user.id,
      user.role_name || "user",
      user.role_id
    );

    // Remove password hash from response
    delete user.password_hash;
    user.role = user.role_name || "user";
    user.role_id = user.role_id;

    return { user, token };
  }

  static async getUserById(userId: string): Promise<User> {
    const sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.department_id, 
        u.role_id,
        r.name as role,
        u.created_at, 
        u.updated_at, 
        d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `;

    const users = (await DatabaseService.query(sql, [userId])) as any[];

    if (users.length === 0) {
      throw new Error("User not found");
    }

    return users[0];
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.department_id, 
        u.role_id,
        r.name as role,
        u.created_at, 
        u.updated_at, 
        d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `;

    const users = (await DatabaseService.query(sql, [email])) as any[];

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    delete user.password_hash;

    return user;
  }

  static async getUserWithRole(userId: string): Promise<User | null> {
    const sql = `
      SELECT 
        u.*, 
        r.name as role_name, 
        r.id as role_id,
        r.description as role_description
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `;

    const users = await DatabaseService.query(sql, [userId]);
    return users.length > 0 ? users[0] : null;
  }

  static async getUserPermissions(userId: string): Promise<Permission[]> {
    const sql = `
      SELECT p.* FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN users u ON u.role_id = rp.role_id
      WHERE u.id = ?
      ORDER BY p.category, p.name
    `;

    const permissions = await DatabaseService.query(sql, [userId]);
    return permissions;
  }

  static async hasPermission(
    userId: string,
    permission: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some((p: Permission) => p.name === permission);
  }

  static async getUserRoles(): Promise<any[]> {
    const sql = `
      SELECT 
        r.*,
        COUNT(DISTINCT rp.permission_id) as permission_count,
        COUNT(DISTINCT u.id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.name
    `;

    return await DatabaseService.query(sql);
  }

  static async getAllPermissions(): Promise<Permission[]> {
    const sql = `
      SELECT * FROM permissions 
      ORDER BY category, name
    `;

    return await DatabaseService.query(sql);
  }

  static async getRolePermissions(roleId: string): Promise<Permission[]> {
    const sql = `
      SELECT p.* FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.category, p.name
    `;

    return await DatabaseService.query(sql, [roleId]);
  }

  static async createRole(
    name: string,
    description: string | null = null,
    permissions: string[] = []
  ): Promise<string> {
    const roleId = crypto.randomUUID();

    await DatabaseService.query(
      "INSERT INTO roles (id, name, description) VALUES (?, ?, ?)",
      [roleId, name, description]
    );

    // Assign permissions if provided
    if (permissions.length > 0) {
      const permissionValues = permissions.map((permissionId) => [
        roleId,
        permissionId,
      ]);
      await DatabaseService.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
        [permissionValues]
      );
    }

    return roleId;
  }

  static async updateRole(
    roleId: string,
    name: string,
    description: string | null = null,
    permissions: string[] = []
  ): Promise<void> {
    // Update role
    await DatabaseService.query(
      "UPDATE roles SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description, roleId]
    );

    // Update permissions
    await DatabaseService.query(
      "DELETE FROM role_permissions WHERE role_id = ?",
      [roleId]
    );

    if (permissions.length > 0) {
      const permissionValues = permissions.map((permissionId) => [
        roleId,
        permissionId,
      ]);
      await DatabaseService.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
        [permissionValues]
      );
    }
  }

  static async deleteRole(roleId: string): Promise<void> {
    // Check if role has users
    const usersWithRole = await DatabaseService.query(
      "SELECT id FROM users WHERE role_id = ? LIMIT 1",
      [roleId]
    );

    if (usersWithRole.length > 0) {
      throw new Error("Cannot delete role that has users assigned");
    }

    await DatabaseService.query("DELETE FROM roles WHERE id = ?", [roleId]);
  }
}
