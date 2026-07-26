"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import {
  PAGE_DEFAULT_DURATION_SEC,
  type Display,
  type Page,
  type Zone,
  type ZoneContent,
} from "@drip-tv/shared";

type PagePatch = Partial<Pick<Page, "name" | "durationSec">> & {
  background?: Partial<Page["background"]>;
};

type BuilderState = {
  display: Display;
  selectedPageId: string | null;
  selectedZoneId: string | null;
  dirty: boolean;
  setDisplay: (display: Display) => void;
  addPage: () => void;
  removePage: (id: string) => void;
  selectPage: (id: string) => void;
  updatePage: (id: string, patch: PagePatch) => void;
  addZone: (content: ZoneContent) => void;
  updateZone: (id: string, patch: Partial<Omit<Zone, "id" | "content">> & { content?: Partial<ZoneContent> }) => void;
  removeZone: (id: string) => void;
  selectZone: (id: string | null) => void;
  markSaved: () => void;
};

function newId(): string {
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

function makePage(name: string): Page {
  return {
    id: newId(),
    name,
    durationSec: PAGE_DEFAULT_DURATION_SEC,
    background: { color: "#0b0d12" },
    zones: [],
  };
}

// The id of the page zone operations should target: the explicit selection,
// falling back to the first page so the store is never in a broken state.
function activePageId(display: Display, selectedPageId: string | null): string | null {
  if (selectedPageId && display.pages.some((p) => p.id === selectedPageId)) {
    return selectedPageId;
  }
  return display.pages[0]?.id ?? null;
}

// Apply a transform to the zones of a single page, returning a new pages array.
function mapPageZones(
  display: Display,
  pageId: string | null,
  fn: (zones: Zone[]) => Zone[],
): Page[] {
  return display.pages.map((p) => (p.id === pageId ? { ...p, zones: fn(p.zones) } : p));
}

export const useBuilderStore = create<BuilderState>()(
  temporal(
    (set) => ({
      display: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Untitled",
        aspect_ratio: "16:9",
        pages: [makePage("Page 1")],
        version: 1,
      },
      selectedPageId: null,
      selectedZoneId: null,
      dirty: false,

      setDisplay: (display) =>
        set(() => ({
          display,
          dirty: false,
          selectedPageId: display.pages[0]?.id ?? null,
          selectedZoneId: null,
        })),

      addPage: () =>
        set((state) => {
          const page = makePage(`Page ${state.display.pages.length + 1}`);
          return {
            display: { ...state.display, pages: [...state.display.pages, page] },
            selectedPageId: page.id,
            selectedZoneId: null,
            dirty: true,
          };
        }),

      removePage: (id) =>
        set((state) => {
          // Never allow deleting the last remaining page.
          if (state.display.pages.length <= 1) return state;
          const pages = state.display.pages.filter((p) => p.id !== id);
          const selectedPageId =
            state.selectedPageId === id ? (pages[0]?.id ?? null) : state.selectedPageId;
          return {
            display: { ...state.display, pages },
            selectedPageId,
            selectedZoneId: null,
            dirty: true,
          };
        }),

      selectPage: (id) => set(() => ({ selectedPageId: id, selectedZoneId: null })),

      updatePage: (id, patch) =>
        set((state) => {
          const pages = state.display.pages.map((p) => {
            if (p.id !== id) return p;
            const { background, ...rest } = patch;
            const next: Page = { ...p, ...rest };
            if (background) next.background = { ...p.background, ...background };
            return next;
          });
          return { display: { ...state.display, pages }, dirty: true };
        }),

      addZone: (content) =>
        set((state) => {
          const pageId = activePageId(state.display, state.selectedPageId);
          if (!pageId) return state;
          const zone: Zone = {
            id: newId(),
            x: DEFAULT_ZONE_SIZE.x,
            y: DEFAULT_ZONE_SIZE.y,
            w: DEFAULT_ZONE_SIZE.w,
            h: DEFAULT_ZONE_SIZE.h,
            z: 0,
            fit: "cover",
            content,
          };
          const pages = mapPageZones(state.display, pageId, (zones) => [
            ...zones,
            { ...zone, z: zones.length },
          ]);
          return {
            display: { ...state.display, pages },
            selectedPageId: pageId,
            selectedZoneId: zone.id,
            dirty: true,
          };
        }),

      updateZone: (id, patch) =>
        set((state) => {
          const pageId = activePageId(state.display, state.selectedPageId);
          const pages = mapPageZones(state.display, pageId, (zones) =>
            zones.map((z) => {
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
            }),
          );
          return { display: { ...state.display, pages }, dirty: true };
        }),

      removeZone: (id) =>
        set((state) => {
          const pageId = activePageId(state.display, state.selectedPageId);
          const pages = mapPageZones(state.display, pageId, (zones) =>
            zones.filter((z) => z.id !== id),
          );
          return {
            display: { ...state.display, pages },
            selectedZoneId: state.selectedZoneId === id ? null : state.selectedZoneId,
            dirty: true,
          };
        }),

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

// Convenience selector: the currently active page object (or the first page).
export function useActivePage(): Page | null {
  return useBuilderStore((s) => {
    const id = s.selectedPageId;
    return s.display.pages.find((p) => p.id === id) ?? s.display.pages[0] ?? null;
  });
}
