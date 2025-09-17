// components/layout/header.tsx (ensure it fits headerHeight used in AppLayout)
"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Bell, ChevronDown } from "lucide-react";
import { useSidebarContext } from "./sidebar-context";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const { isCollapsed } = useSidebarContext();
  const [menuOpen, setMenuOpen] = useState(false);

  const headerClass =
    "h-16 bg-white border-b border-gray-200 flex items-center px-6"; // height 64px

  if (!user) return null;

  return (
    <div className={headerClass}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          {/* brand left - optional */}
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-primary">DocuFlow</h1>
            <p className="text-xs text-gray-500">Document Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* notifications */}
          <Button
            variant="ghost"
            onClick={() => router.push("/notifications")}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {/* badge code */}
          </Button>

          {/* profile */}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3">
                <Avatar className="h-8 w-8 bg-primary">
                  <AvatarFallback>
                    {(user.name || "U").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {profile?.role ?? "member"}
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    menuOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 data-[state=open]:animate-fade-in-down"
            >
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                className="text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
