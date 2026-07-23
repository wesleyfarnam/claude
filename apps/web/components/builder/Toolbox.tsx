"use client";

import { useState } from "react";
import { useBuilderStore } from "@/lib/builder/store";
import { MediaPickerModal, type MediaPickerItem } from "./MediaPickerModal";

type PickerMode = "image" | "video" | null;

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
      <path d="M4 17l5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function WeatherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 2.5v1.6M3.5 8H2m2.4-3.6l-1-1M12.6 4.4l-1 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9 18.5a3 3 0 010-6 4 4 0 017.7 1.2A2.9 2.9 0 0116 18.5H9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function SportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M7 4h10v3a5 5 0 01-10 0V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 5H4v1.5A2.5 2.5 0 006.5 9M17 5h3v1.5A2.5 2.5 0 0117.5 9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 12v3m-3 5h6m-5 0l.6-2.4a2.5 2.5 0 014.8 0L16 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M5 6h14M12 6v12M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Toolbox({ media }: { media: MediaPickerItem[] }) {
  const addZone = useBuilderStore((s) => s.addZone);
  const [picker, setPicker] = useState<PickerMode>(null);

  const baseBtn =
    "flex w-full items-center gap-2 rounded bg-sapphire px-3 py-3 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua";

  function handleMediaPick(mediaId: string) {
    addZone({ kind: "media", mediaId, loop: true, muted: true });
    setPicker(null);
  }

  function addWeather() {
    addZone({ kind: "weather", units: "imperial", showForecast: true });
  }

  function addSports() {
    addZone({ kind: "sports", leagues: [], teams: [] });
  }

  function addText() {
    addZone({
      kind: "text",
      text: "Headline",
      fontSize: 32,
      color: "#ffffff",
      align: "center",
    });
  }

  function addClock() {
    addZone({ kind: "clock", format: "h:mm A", tz: "America/New_York" });
  }

  return (
    <aside className="flex w-56 flex-col gap-3 border-r border-athens bg-white p-4">
      <p className="font-heading text-h5 uppercase tracking-[1px] text-ink/60">Add zone</p>
      <button type="button" onClick={() => setPicker("image")} className={baseBtn}>
        <ImageIcon />
        <span>Image</span>
      </button>
      <button type="button" onClick={() => setPicker("video")} className={baseBtn}>
        <VideoIcon />
        <span>Video</span>
      </button>
      <button type="button" onClick={addWeather} className={baseBtn}>
        <WeatherIcon />
        <span>Weather</span>
      </button>
      <button type="button" onClick={addSports} className={baseBtn}>
        <SportsIcon />
        <span>Sports</span>
      </button>
      <button type="button" onClick={addText} className={baseBtn}>
        <TextIcon />
        <span>Text</span>
      </button>
      <button type="button" onClick={addClock} className={baseBtn}>
        <ClockIcon />
        <span>Clock</span>
      </button>

      <MediaPickerModal
        open={picker === "image" || picker === "video"}
        media={media}
        filterType={picker === "image" || picker === "video" ? picker : undefined}
        onPick={handleMediaPick}
        onClose={() => setPicker(null)}
      />
    </aside>
  );
}
