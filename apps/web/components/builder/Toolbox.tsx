"use client";

import { useState } from "react";
import { useBuilderStore } from "@/lib/builder/store";
import {
  MediaPickerModal,
  WidgetPickerModal,
  type MediaPickerItem,
  type WidgetPickerItem,
} from "./MediaPickerModal";

type PickerMode = "image" | "video" | "widget" | null;

export function Toolbox({
  media,
  widgets,
}: {
  media: MediaPickerItem[];
  widgets: WidgetPickerItem[];
}) {
  const addZone = useBuilderStore((s) => s.addZone);
  const [picker, setPicker] = useState<PickerMode>(null);

  const baseBtn =
    "flex w-full items-center justify-center rounded bg-sapphire px-3 py-3 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua";

  function pickMedia(type: "image" | "video") {
    setPicker(type);
  }

  function handleMediaPick(mediaId: string) {
    addZone({ kind: "media", mediaId, loop: true, muted: true });
    setPicker(null);
  }

  function handleWidgetPick(widgetId: string) {
    addZone({ kind: "widget", widgetId });
    setPicker(null);
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
      <button type="button" onClick={() => pickMedia("image")} className={baseBtn}>
        Image
      </button>
      <button type="button" onClick={() => pickMedia("video")} className={baseBtn}>
        Video
      </button>
      <button type="button" onClick={() => setPicker("widget")} className={baseBtn}>
        Widget
      </button>
      <button type="button" onClick={addText} className={baseBtn}>
        Text
      </button>
      <button type="button" onClick={addClock} className={baseBtn}>
        Clock
      </button>

      <MediaPickerModal
        open={picker === "image" || picker === "video"}
        media={media}
        filterType={picker === "image" || picker === "video" ? picker : undefined}
        onPick={handleMediaPick}
        onClose={() => setPicker(null)}
      />
      <WidgetPickerModal
        open={picker === "widget"}
        widgets={widgets}
        onPick={handleWidgetPick}
        onClose={() => setPicker(null)}
      />
    </aside>
  );
}
