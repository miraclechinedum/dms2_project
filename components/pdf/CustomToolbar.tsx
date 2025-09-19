import React from "react";
import {
  MousePointer2,
  Highlighter,
  StickyNote,
  PenTool,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Palette,
} from "lucide-react";

interface CustomToolbarProps {
  selectedTool: string;
  selectedColor: string;
  zoomLevel: number;
  onToolSelect: (tool: string) => void;
  onColorChange: (color: string) => void;
  onZoom: (direction: "in" | "out" | "fit") => void;
  onExport: () => void;
}

const tools = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "highlight", icon: Highlighter, label: "Highlight" },
  { id: "sticky_note", icon: StickyNote, label: "Sticky Note" },
  { id: "drawing", icon: PenTool, label: "Draw" },
];

const colors = [
  { name: "Yellow", value: "#FFE066" },
  { name: "Pink", value: "#FFB3D9" },
  { name: "Blue", value: "#B3D9FF" },
  { name: "Green", value: "#B3FFB3" },
  { name: "Orange", value: "#FFCC99" },
  { name: "Purple", value: "#D9B3FF" },
  { name: "Red", value: "#FFB3B3" },
  { name: "Cyan", value: "#B3F5FF" },
];

export function CustomToolbar({
  selectedTool,
  selectedColor,
  zoomLevel,
  onToolSelect,
  onColorChange,
  onZoom,
  onExport,
}: CustomToolbarProps) {
  return (
    <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
      {/* Left section - Tools */}
      <div className="flex items-center space-x-1">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                selectedTool === tool.id
                  ? "bg-blue-100 text-blue-700 border border-blue-200 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              }`}
              title={tool.label}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Center section - Color palette */}
      <div className="flex items-center space-x-2">
        <Palette className="h-4 w-4 text-gray-500" />
        <div className="flex items-center space-x-1 p-1 bg-gray-50 rounded-lg">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className={`w-6 h-6 rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                selectedColor === color.value
                  ? "border-gray-800 shadow-md scale-110"
                  : "border-gray-300 hover:border-gray-500"
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Right section - Controls */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 bg-gray-50 rounded-lg p-1">
          <button
            onClick={() => onZoom("out")}
            className="p-2 text-gray-600 hover:bg-white hover:text-gray-800 rounded-md transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="px-2 py-1 text-sm font-medium text-gray-700 min-w-[3rem] text-center">
            {zoomLevel}%
          </div>
          <button
            onClick={() => onZoom("in")}
            className="p-2 text-gray-600 hover:bg-white hover:text-gray-800 rounded-md transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => onZoom("fit")}
          className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
          title="Fit to page"
        >
          <Maximize className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-gray-300" />

        <button
          onClick={onExport}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          title="Export PDF with annotations"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
}
