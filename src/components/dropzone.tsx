"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  children?: ReactNode;
}

export default function Dropzone({
  accept,
  multiple = true,
  disabled,
  onFiles,
  title = "Drop files here",
  subtitle = "or click to browse — files stay in this tab",
  compact,
  children,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const dragging = dragDepth > 0;
  useEffect(() => { inputRef.current?.setAttribute("data-ready", "true"); }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragDepth(0);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length) onFiles(files);
    },
    [disabled, onFiles]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled) setDragDepth((d) => d + 1);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragDepth((d) => Math.max(0, d - 1));
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed transition-all duration-300",
        compact ? "p-5" : "p-10 sm:p-14",
        dragging
          ? "border-acid bg-acid/[0.06] shadow-[0_0_60px_-15px] shadow-acid/40"
          : "border-ink/15 bg-panel hover:border-ink/30",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3 text-center">
        <span
          className={cn(
            "grid place-items-center rounded-2xl border border-ink/10 bg-panel2 transition-all duration-300",
            compact ? "size-10" : "size-14",
            dragging && "scale-110 border-acid/40 text-acid"
          )}
        >
          <UploadCloud className={compact ? "size-5" : "size-6"} strokeWidth={1.6} />
        </span>
        <div>
          <p className={cn("font-display font-medium", compact ? "text-sm" : "text-lg")}>
            {dragging ? "Release to load" : title}
          </p>
          <p className={cn("text-dim", compact ? "text-xs" : "mt-1 text-sm")}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
