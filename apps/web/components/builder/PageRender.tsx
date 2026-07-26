"use client";

import type { Page, Zone } from "@drip-tv/shared";

/**
 * Read-only preview of a single zone's content. Shared by the editable Canvas
 * and the non-interactive page thumbnails / full-screen Preview so they always
 * render zones the same way.
 */
export function ZoneContentPreview({ zone }: { zone: Zone }) {
  const c = zone.content;
  const fitClass =
    zone.fit === "contain"
      ? "object-contain"
      : zone.fit === "stretch"
        ? "object-fill"
        : "object-cover";

  switch (c.kind) {
    case "text":
      return (
        <div
          className="flex h-full w-full items-center justify-center p-2"
          style={{
            color: c.color,
            fontSize: c.fontSize,
            textAlign: c.align,
            justifyContent:
              c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
          }}
        >
          <span className="break-words">{c.text || "Text"}</span>
        </div>
      );
    case "clock":
      return (
        <div className="flex h-full w-full items-center justify-center font-display text-3xl text-white">
          <span>00:00</span>
        </div>
      );
    case "media":
      return (
        <div className={`flex h-full w-full items-center justify-center bg-black/40 ${fitClass}`}>
          <span className="font-heading uppercase tracking-[1px] text-white/70">Media</span>
        </div>
      );
    case "playlist":
      return (
        <div className="flex h-full w-full items-center justify-center bg-paua/40">
          <span className="font-heading uppercase tracking-[1px] text-white/70">Playlist</span>
        </div>
      );
    case "weather":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-cornflower/30 text-white">
          <span className="font-heading uppercase tracking-[1px] text-white/80">Weather</span>
          <span className="mt-1 text-xs text-white/60">Uses device location</span>
        </div>
      );
    case "sports":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-maroon/30 text-white">
          <span className="font-heading uppercase tracking-[1px] text-white/80">Sports</span>
          <span className="mt-1 text-xs text-white/60">
            {c.leagues.length > 0 ? c.leagues.join(" · ") : "All leagues"}
          </span>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Renders a whole page's zones read-only, filling its (absolutely-positioned)
 * container. Zones are placed by percent so it scales to any thumbnail size.
 */
export function PageView({ page }: { page: Page }) {
  return (
    <div className="absolute inset-0" style={{ background: page.background.color }}>
      {page.zones.map((zone) => (
        <div
          key={zone.id}
          className="absolute overflow-hidden"
          style={{
            left: `${zone.x}%`,
            top: `${zone.y}%`,
            width: `${zone.w}%`,
            height: `${zone.h}%`,
            zIndex: zone.z,
            background: zone.background ?? undefined,
          }}
        >
          <ZoneContentPreview zone={zone} />
        </div>
      ))}
    </div>
  );
}
