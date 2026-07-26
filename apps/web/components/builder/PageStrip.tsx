"use client";

import {
  PAGE_MAX_DURATION_SEC,
  PAGE_MIN_DURATION_SEC,
  type Page,
} from "@drip-tv/shared";
import { useBuilderStore } from "@/lib/builder/store";
import { PageView } from "./PageRender";

const MAX_PAGES = 50;

function PageThumb({
  page,
  index,
  selected,
  aspect,
  canDelete,
  onSelect,
  onDelete,
}: {
  page: Page;
  index: number;
  selected: boolean;
  aspect: "16:9" | "9:16";
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const aspectClass = aspect === "9:16" ? "aspect-[9/16]" : "aspect-[16/9]";
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`group relative ${aspectClass} h-20 overflow-hidden rounded-md ring-1 ring-athens transition ${
          selected ? "outline outline-2 outline-sapphire" : "hover:ring-cornflower"
        }`}
        aria-label={`Select ${page.name}`}
        aria-pressed={selected}
      >
        <PageView page={page} />
        <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 font-heading text-[10px] uppercase tracking-[1px] text-white">
          {index + 1}
        </span>
        {canDelete ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onDelete();
              }
            }}
            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-maroon text-white group-hover:flex hover:bg-maroon/90"
            aria-label={`Delete ${page.name}`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        ) : null}
      </button>
      <span className="max-w-[7rem] truncate font-heading text-[10px] uppercase tracking-[1px] text-ink/60">
        {page.name}
      </span>
    </div>
  );
}

export function PageStrip() {
  const display = useBuilderStore((s) => s.display);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const selectPage = useBuilderStore((s) => s.selectPage);
  const addPage = useBuilderStore((s) => s.addPage);
  const removePage = useBuilderStore((s) => s.removePage);
  const updatePage = useBuilderStore((s) => s.updatePage);

  const pages = display.pages;
  const activeId = selectedPageId ?? pages[0]?.id ?? null;
  const active = pages.find((p) => p.id === activeId) ?? pages[0] ?? null;

  return (
    <div className="flex items-stretch gap-4 border-t border-athens bg-white px-4 py-3">
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {pages.map((page, i) => (
          <PageThumb
            key={page.id}
            page={page}
            index={i}
            selected={page.id === activeId}
            aspect={display.aspect_ratio}
            canDelete={pages.length > 1}
            onSelect={() => selectPage(page.id)}
            onDelete={() => removePage(page.id)}
          />
        ))}
        <button
          type="button"
          onClick={addPage}
          disabled={pages.length >= MAX_PAGES}
          className="flex h-20 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-athens font-heading text-xs uppercase tracking-[1px] text-ink/50 transition hover:border-sapphire hover:text-sapphire disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Add page"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Add page
        </button>
      </div>

      {active ? (
        <div className="ml-auto flex shrink-0 flex-col justify-center gap-2 border-l border-athens pl-4">
          <label className="flex flex-col gap-1">
            <span className="font-heading text-[10px] uppercase tracking-[1px] text-ink/60">
              Page name
            </span>
            <input
              type="text"
              value={active.name}
              onChange={(e) => updatePage(active.id, { name: e.target.value })}
              className="w-40 rounded border border-athens bg-white px-2 py-1 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-heading text-[10px] uppercase tracking-[1px] text-ink/60">
              Duration (sec)
            </span>
            <input
              type="number"
              min={PAGE_MIN_DURATION_SEC}
              max={PAGE_MAX_DURATION_SEC}
              value={active.durationSec}
              onChange={(e) => {
                const next = Math.round(Number(e.target.value));
                if (Number.isFinite(next)) {
                  updatePage(active.id, {
                    durationSec: Math.min(
                      PAGE_MAX_DURATION_SEC,
                      Math.max(PAGE_MIN_DURATION_SEC, next),
                    ),
                  });
                }
              }}
              className="w-40 rounded border border-athens bg-white px-2 py-1 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
