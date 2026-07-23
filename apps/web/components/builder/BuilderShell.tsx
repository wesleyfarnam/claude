"use client";

import { useEffect, useState, useTransition } from "react";
import type { Display } from "@drip-tv/shared";
import { useBuilderStore } from "@/lib/builder/store";
import { saveDisplay } from "@/app/(dashboard)/displays/actions";
import { Canvas } from "./Canvas";
import { Toolbox } from "./Toolbox";
import { Inspector } from "./Inspector";
import type { MediaPickerItem } from "./MediaPickerModal";

export function BuilderShell({
  initialDisplay,
  media,
}: {
  initialDisplay: Display;
  media: MediaPickerItem[];
}) {
  const display = useBuilderStore((s) => s.display);
  const dirty = useBuilderStore((s) => s.dirty);
  const setDisplay = useBuilderStore((s) => s.setDisplay);
  const markSaved = useBuilderStore((s) => s.markSaved);
  const [name, setName] = useState(initialDisplay.name);
  const [aspect, setAspect] = useState<Display["aspect_ratio"]>(initialDisplay.aspect_ratio);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDisplay(initialDisplay);
    setName(initialDisplay.name);
    setAspect(initialDisplay.aspect_ratio);
  }, [initialDisplay, setDisplay]);

  function handleAspectChange(next: Display["aspect_ratio"]) {
    setAspect(next);
    setDisplay({ ...display, aspect_ratio: next });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const payload: Display = { ...display, name, aspect_ratio: aspect };
      const result = await saveDisplay(initialDisplay.id, payload, name, aspect);
      if (result?.error) {
        setError(result.error);
        return;
      }
      markSaved();
    });
  }

  return (
    <div className="flex h-screen flex-col bg-athens">
      <header className="flex items-center justify-between gap-4 border-b border-athens bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-1 items-center gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDisplay({ ...display, name: e.target.value });
            }}
            placeholder="Display name"
            className="w-72 rounded border border-transparent bg-transparent px-2 py-1 font-heading text-h3 uppercase tracking-[1px] text-paua focus:border-sapphire focus:bg-white focus:outline-none"
          />
          <select
            value={aspect}
            onChange={(e) => handleAspectChange(e.target.value as Display["aspect_ratio"])}
            className="rounded border border-athens bg-white px-2 py-1 font-heading text-sm uppercase tracking-[1px] text-paua focus:border-sapphire focus:outline-none"
          >
            <option value="16:9">16:9 landscape</option>
            <option value="9:16">9:16 portrait</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="font-heading text-xs uppercase tracking-[1px] text-maroon">
              {error}
            </span>
          ) : null}
          {dirty ? (
            <span className="font-heading text-xs uppercase tracking-[1px] text-ink/40">
              Unsaved
            </span>
          ) : (
            <span className="font-heading text-xs uppercase tracking-[1px] text-ink/40">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua disabled:cursor-not-allowed disabled:bg-ink/40"
          >
            {isPending ? "Saving" : "Save"}
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Toolbox media={media} />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}
