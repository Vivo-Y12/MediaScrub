"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { clamp } from "@/lib/utils";

interface CompareSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt?: string;
}

/** Draggable before/after image comparison. Position is % revealed of the AFTER image. */
export default function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original",
  afterLabel = "Processed",
  alt = "comparison",
}: CompareSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromPointer = useCallback((clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) updateFromPointer(e.clientX);
  };

  return (
    <div
      ref={ref}
      className="group relative w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl bg-void"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => clamp(p - 4, 0, 100));
        if (e.key === "ArrowRight") setPos((p) => clamp(p + 4, 0, 100));
      }}
    >
      {/* AFTER (below, full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={`after ${alt}`} className="block max-h-[420px] w-full object-contain" draggable={false} />
      {/* BEFORE (clipped) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={`before ${alt}`} className="block max-h-[420px] w-full object-contain" draggable={false} />
      </div>
      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -left-px w-0.5 bg-acid" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-acid/60 bg-void/90 p-2 text-acid shadow-lg backdrop-blur">
          <ChevronsLeftRight className="size-4" />
        </div>
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-void/70 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-ink backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-void/70 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-widest text-ink backdrop-blur">
        {afterLabel}
      </span>
    </div>
  );
}
