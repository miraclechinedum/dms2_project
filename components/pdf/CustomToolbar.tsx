"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const colorPresets = [
  { name: "Yellow", value: "#FFE066" },
  { name: "Green", value: "#4ADE80" },
  { name: "Blue", value: "#60A5FA" },
  { name: "Red", value: "#F87171" },
  { name: "Purple", value: "#A78BFA" },
  { name: "Orange", value: "#FB923C" },
  { name: "Pink", value: "#F472B6" },
  { name: "Cyan", value: "#22D3EE" },
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
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const tools = [
    {
      name: "select",
      icon: MousePointer2,
      label: "Select",
      description: "Select and edit annotations",
    },
    {
      name: "highlight",
      icon: Highlighter,
      label: "Highlight",
      description: "Highlight text",
    },
    {
      name: "sticky_note",
      icon: StickyNote,
      label: "Note",
      description: "Add sticky note",
    },
    {
      name: "drawing",
      icon: PenTool,
      label: "Draw",
      description: "Freehand drawing",
    },
  ];

  return (
    <div className="bg-white border-b shadow-sm p-3">
      <div className="flex items-center justify-between max-w-full">
        {/* Left side - Annotation tools */}
        <div className="flex items-center space-x-1">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            const isSelected = selectedTool === tool.name;

            return (
              <Button
                key={tool.name}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                onClick={() => onToolSelect(tool.name)}
                className={`
                  flex items-center gap-2 h-9 px-3 transition-all duration-200
                  ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-primary/10 hover:text-primary"
                  }
                `}
                title={tool.description}
              >
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium">
                  {tool.label}
                </span>
              </Button>
            );
          })}

          {/* Color Picker */}
          <div className="h-6 w-px bg-border mx-2" />
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 h-9 px-3 hover:bg-primary/10"
                title="Choose color"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border-2 border-white shadow-sm"
                    style={{ backgroundColor: selectedColor }}
                  />
                  <Palette className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  Color
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="start">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Choose Color</h4>
                <div className="grid grid-cols-4 gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color.value}
                      className={`
                        w-12 h-8 rounded border-2 transition-all duration-200 hover:scale-105
                        ${
                          selectedColor === color.value
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-gray-200 hover:border-gray-300"
                        }
                      `}
                      style={{ backgroundColor: color.value }}
                      onClick={() => {
                        onColorChange(color.value);
                        setIsColorPickerOpen(false);
                      }}
                      title={color.name}
                    />
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <label className="text-xs text-muted-foreground">
                    Custom Color
                  </label>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-full h-8 rounded border border-gray-200 cursor-pointer"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right side - Zoom and Export */}
        <div className="flex items-center space-x-1">
          {/* Zoom controls */}
          <div className="flex items-center bg-gray-50 rounded-md p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onZoom("out")}
              className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm"
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <div className="px-3 py-1 text-sm font-medium text-muted-foreground min-w-[50px] text-center">
              {zoomLevel}%
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onZoom("in")}
              className="h-7 w-7 p-0 hover:bg-white hover:shadow-sm"
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onZoom("fit")}
            className="h-9 px-3 hover:bg-primary/10"
            title="Fit to page"
          >
            <Maximize className="h-4 w-4" />
            <span className="hidden sm:inline ml-2 text-sm font-medium">
              Fit
            </span>
          </Button>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Export button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
          >
            <Download className="h-4 w-4" />
            <span className="ml-2 text-sm font-medium">Export PDF</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
