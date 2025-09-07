// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Sidebar } from "@/components/layout/sidebar";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { PdfViewer } from "@/components/pdf/pdf-viewer";
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

  // Add dashboard redirect
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

  const renderActiveView = () => {
    switch (activeView) {
      case "documents":
        return <DocumentList onDocumentSelect={setSelectedDocument} />;
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
        return <DocumentList onDocumentSelect={setSelectedDocument} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto">{renderActiveView()}</main>
      <Toaster position="top-right" />
    </div>
  );
}
