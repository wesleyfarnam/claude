"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Display } from "@drip-tv/shared";
import { PageView } from "./PageRender";

export function PreviewModal({
  display,
  open,
  onClose,
}: {
  display: Display;
  open: boolean;
  onClose: () => void;
}) {
  const pages = display.pages;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset to the first page whenever the preview is (re)opened.
  useEffect(() => {
    if (open) {
      setIndex(0);
      setPlaying(true);
    }
  }, [open]);

  // Auto-advance through the deck on each page's duration, looping.
  useEffect(() => {
    clearTimer();
    if (!open || !playing || pages.length <= 1) return;
    const current = pages[index] ?? pages[0];
    const ms = Math.max(1, current?.durationSec ?? 10) * 1000;
    timerRef.current = setTimeout(() => {
      setIndex((i) => (i + 1) % pages.length);
    }, ms);
    return clearTimer;
  }, [open, playing, index, pages, clearTimer]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % pages.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + pages.length) % pages.length);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pages.length]);

  if (!open) return null;

  const safeIndex = Math.min(index, Math.max(0, pages.length - 1));
  const page = pages[safeIndex] ?? pages[0];
  const aspectClass = display.aspect_ratio === "9:16" ? "aspect-[9/16]" : "aspect-[16/9]";
  const sizeClass = display.aspect_ratio === "9:16" ? "h-[80vh]" : "w-[80vw] max-w-6xl";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/90 p-6">
      <div className="flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-heading text-h4 uppercase tracking-[1px] text-white">
            {display.name || "Preview"}
          </span>
          <span className="font-heading text-xs uppercase tracking-[1px] text-white/50">
            {page?.name} · {safeIndex + 1}/{pages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-white/10 px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-white/20"
        >
          Close
        </button>
      </div>

      <div className={`relative overflow-hidden rounded-lg shadow-2xl ${aspectClass} ${sizeClass}`}>
        {page ? <PageView page={page} /> : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => (i - 1 + pages.length) % pages.length)}
          className="rounded bg-white/10 px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-white/20"
          aria-label="Previous page"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % pages.length)}
          className="rounded bg-white/10 px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-white/20"
          aria-label="Next page"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {pages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === safeIndex ? "w-8 bg-aqua" : "w-4 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to ${p.name}`}
          />
        ))}
      </div>
    </div>
  );
}
