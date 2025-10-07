import React from "react";
import { Download } from "lucide-react";

interface CustomToolbarProps {
  onExport: () => void;
}

export function CustomToolbar({ onExport }: CustomToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-end">
      <button
        onClick={onExport}
        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        title="Export PDF with annotations"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );
}
