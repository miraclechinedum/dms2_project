"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Sidebar } from "@/components/layout/sidebar";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
// ⬇️ Dynamically import PdfViewer so it only loads in browser
const PdfViewer = dynamic(() => import("@/components/pdf/pdf-viewer"), {
  ssr: false,
});
import { NotificationCenter } from "@/components/notifications/notification-center";
import { UserManagement } from "@/components/users/user-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "react-hot-toast";
import { DashboardRedirect } from "@/components/auth/dashboard-redirect";

interface Document {
  id: string;
  title: string;
  file_url: string;
}

export default function Home() {
  const [activeView, setActiveView] = useState("documents");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const { user, profile, loading } = useAuth();

  // If logged in, redirect to dashboard component (existing app behavior)
  if (user && profile) {
    return <DashboardRedirect />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <>
        <AuthForm />
        <Toaster position="top-right" />
      </>
    );
  }

  if (selectedDocument) {
    return (
      <>
        <PdfViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
        <Toaster position="top-right" />
      </>
    );
  }

  // Normalize incoming document from DocumentList into our Document shape
  const handleDocumentSelect = (incoming: any) => {
    if (!incoming) {
      setSelectedDocument(null);
      return;
    }

    const normalized: Document = {
      id: String(incoming.id),
      title: String(incoming.title ?? ""),
      file_url: String(incoming.file_url ?? incoming.file_url ?? ""),
    };

    setSelectedDocument(normalized);
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "documents":
        return <DocumentList onDocumentSelect={handleDocumentSelect} />;
      case "upload":
        return <DocumentUpload />;
      case "users":
        return <UserManagement />;
      case "notifications":
        return <NotificationCenter />;
      case "settings":
        return (
          <div className="max-w-2xl mx-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Settings panel coming soon...</p>
              </CardContent>
            </Card>
          </div>
        );
      default:
        return <DocumentList onDocumentSelect={handleDocumentSelect} />;
    }
  };

  // Cast Sidebar to any to avoid prop type mismatch errors
  const SidebarAny = Sidebar as any;

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarAny activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto">{renderActiveView()}</main>
      <Toaster position="top-right" />
    </div>
  );
}
