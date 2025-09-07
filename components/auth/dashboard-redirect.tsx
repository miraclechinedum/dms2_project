// components/auth/dashboard-redirect.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function DashboardRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Redirect to dashboard if user is authenticated
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  return null;
}
