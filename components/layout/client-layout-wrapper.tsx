"use client";

import { usePathname } from "next/navigation";
import AppLayout from "./app-layout";

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const noLayoutRoutes = ["/", "/register"]; // extend as needed

  const shouldUseLayout = !noLayoutRoutes.includes(pathname);

  return shouldUseLayout ? <AppLayout>{children}</AppLayout> : <>{children}</>;
}
