"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import type { Display, Zone, ZoneContent } from "@drip-tv/shared";

type BuilderState = {
  display: Display;
  selectedZoneId: string | null;
  dirty: boolean;
  setDisplay: (display: Display) => void;
  addZone: (content: ZoneContent) => void;
  updateZone: (id: string, patch: Partial<Omit<Zone, "id" | "content">> & { content?: Partial<ZoneContent> }) => void;
  removeZone: (id: string) => void;
  selectZone: (id: string | null) => void;
  markSaved: () => void;
};

function newZoneId(): string {
  // RFC4122-ish v4 UUID; crypto.randomUUID is available in modern browsers + Node 18+.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (very rough) — should not be reached in practice.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// New zones fill the whole canvas by default; users shrink/reposition from there.
const DEFAULT_ZONE_SIZE = { x: 0, y: 0, w: 100, h: 100 };

export const useBuilderStore = create<BuilderState>()(
  temporal(
    (set) => ({
      display: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Untitled",
        aspect_ratio: "16:9",
        background: { color: "#0b0d12" },
        zones: [],
        version: 1,
      },
      selectedZoneId: null,
      dirty: false,

      setDisplay: (display) =>
        set(() => ({ display, dirty: false, selectedZoneId: null })),

      addZone: (content) =>
        set((state) => {
          const zone: Zone = {
            id: newZoneId(),
            x: DEFAULT_ZONE_SIZE.x,
            y: DEFAULT_ZONE_SIZE.y,
            w: DEFAULT_ZONE_SIZE.w,
            h: DEFAULT_ZONE_SIZE.h,
            z: state.display.zones.length,
            fit: "cover",
            content,
          };
          return {
            display: { ...state.display, zones: [...state.display.zones, zone] },
            selectedZoneId: zone.id,
            dirty: true,
          };
        }),

      updateZone: (id, patch) =>
        set((state) => {
          const zones = state.display.zones.map((z) => {
            if (z.id !== id) return z;
            const { content: contentPatch, ...rest } = patch;
            const next: Zone = { ...z, ...rest };
            if (contentPatch) {
              // Only allow merging compatible content (same `kind`).
              if (!("kind" in contentPatch) || contentPatch.kind === z.content.kind) {
                next.content = { ...z.content, ...contentPatch } as ZoneContent;
              } else {
                next.content = contentPatch as ZoneContent;
              }
            }
            return next;
          });
          return {
            display: { ...state.display, zones },
            dirty: true,
          };
        }),

      removeZone: (id) =>
        set((state) => ({
          display: {
            ...state.display,
            zones: state.display.zones.filter((z) => z.id !== id),
          },
          selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
          dirty: true,
        })),

      selectZone: (id) => set(() => ({ selectedZoneId: id })),

      markSaved: () => set(() => ({ dirty: false })),
    }),
    {
      limit: 50,
      // Only undo display content, not selection state.
      partialize: (state) => ({ display: state.display }),
    },
  ),
);
