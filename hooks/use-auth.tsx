"use client";

import { useEffect, useState, createContext, useContext } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  department_id: string | null;
  role: "admin" | "manager" | "member";
  created_at: string;
  updated_at: string;
  department_name?: string;
  /** ✅ Added below line */
  permissions?: string[]; // Optional permissions array
}

interface AuthContextType {
  user: User | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    departmentId: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount and on focus
  useEffect(() => {
    checkAuth();

    const handleFocus = () => {
      checkAuth();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.ok) {
        const { user: fetchedUser } = await response.json();
        setUser((prev) =>
          JSON.stringify(prev) === JSON.stringify(fetchedUser)
            ? prev
            : fetchedUser
        );
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        return {};
      } else {
        return { error: data.error || "Invalid credentials" };
      }
    } catch {
      return { error: "Network error" };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    departmentId: string
  ) => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, fullName, departmentId }),
      });

      const data = await response.json();

      if (response.ok) {
        const signInResult = await signIn(email, password);
        if (signInResult.error) {
          return { error: signInResult.error };
        }
        return {};
      } else {
        return { error: data.error || "Signup failed" };
      }
    } catch {
      return { error: "Network error" };
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
