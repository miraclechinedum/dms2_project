import { useAuth } from "./use-auth";
import { useState, useEffect, useCallback } from "react";

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/permissions");
      if (response.ok) {
        const json = await response.json();
        const perms: string[] = (json?.permissions || []).map(
          (p: any) => p.name
        );
        setPermissions(perms);
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // load permissions for authenticated user
      fetchUserPermissions();
    } else {
      // no user -> clear permissions and mark not loading
      setPermissions([]);
      setLoading(false);
    }
  }, [user, fetchUserPermissions]);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]) => {
    return requiredPermissions.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (requiredPermissions: string[]) => {
    return requiredPermissions.every((p) => permissions.includes(p));
  };

  return {
    permissions,
    loading,
    fetchUserPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } as const;
}
