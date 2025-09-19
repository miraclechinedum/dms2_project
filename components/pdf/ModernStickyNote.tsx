import React, { useState, useEffect, useRef } from "react";
import { X, Palette, Trash2, Save, MessageSquare } from "lucide-react";

interface StickyNoteData {
  id: string;
  content: string;
  x: number;
  y: number;
  pageNumber: number;
  author: string;
  createdAt: string;
  color: string;
}

interface ModernStickyNoteProps {
  stickyNote?: StickyNoteData | null;
  onSave: (
    content: string,
    position?: { x: number; y: number; pageNumber: number }
  ) => void;
  onDelete?: () => void;
  onClose: () => void;
  color?: string;
}

const colorPalette = [
  {
    name: "Yellow",
    value: "#FFE066",
    bg: "bg-yellow-100",
    border: "border-yellow-300",
  },
  {
    name: "Pink",
    value: "#FFB3D9",
    bg: "bg-pink-100",
    border: "border-pink-300",
  },
  {
    name: "Blue",
    value: "#B3D9FF",
    bg: "bg-blue-100",
    border: "border-blue-300",
  },
  {
    name: "Green",
    value: "#B3FFB3",
    bg: "bg-green-100",
    border: "border-green-300",
  },
  {
    name: "Orange",
    value: "#FFCC99",
    bg: "bg-orange-100",
    border: "border-orange-300",
  },
  {
    name: "Purple",
    value: "#D9B3FF",
    bg: "bg-purple-100",
    border: "border-purple-300",
  },
];

export function ModernStickyNote({
  stickyNote,
  onSave,
  onDelete,
  onClose,
  color = "#FFE066",
}: ModernStickyNoteProps) {
  const [content, setContent] = useState(stickyNote?.content || "");
  const [selectedColor, setSelectedColor] = useState(color);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize textarea
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, []);

  useEffect(() => {
    // Auto-resize on content change
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [content]);

  const handleSave = () => {
    if (content.trim()) {
      onSave(
        content,
        stickyNote ? undefined : { x: 100, y: 100, pageNumber: 1 }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const getColorStyle = (colorValue: string) => {
    const colorData = colorPalette.find((c) => c.value === colorValue);
    return colorData || { bg: "bg-yellow-100", border: "border-yellow-300" };
  };

  const currentColorStyle = getColorStyle(selectedColor);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`${currentColorStyle.bg} ${currentColorStyle.border} border-2 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-200 scale-100`}
        style={{
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-800">
              {stickyNote ? "Edit Note" : "New Sticky Note"}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors relative"
              title="Change color"
            >
              <Palette className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Color Picker */}
        {showColorPicker && (
          <div className="p-4 border-b border-gray-200">
            <div className="grid grid-cols-6 gap-2">
              {colorPalette.map((colorOption) => (
                <button
                  key={colorOption.value}
                  onClick={() => {
                    setSelectedColor(colorOption.value);
                    setShowColorPicker(false);
                  }}
                  className={`w-8 h-8 rounded-full border-2 ${
                    selectedColor === colorOption.value
                      ? "border-gray-800 shadow-md"
                      : "border-gray-300 hover:border-gray-500"
                  } transition-all duration-150 hover:scale-110`}
                  style={{ backgroundColor: colorOption.value }}
                  title={colorOption.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your note here... (Ctrl+Enter to save, Esc to close)"
            className="w-full resize-none bg-transparent border-none outline-none text-gray-800 placeholder-gray-500 text-sm leading-relaxed min-h-[100px] max-h-[300px]"
            rows={4}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white bg-opacity-40 rounded-b-xl">
          <div className="text-xs text-gray-600">
            {stickyNote ? (
              <>
                By {stickyNote.author} •{" "}
                {new Date(stickyNote.createdAt).toLocaleDateString()}
              </>
            ) : (
              "Use Ctrl+Enter to save quickly"
            )}
          </div>
          <div className="flex items-center space-x-2">
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Delete note"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="flex items-center space-x-1 px-3 py-1.5 text-xs bg-gray-800 text-white hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              <Save className="h-3 w-3" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
