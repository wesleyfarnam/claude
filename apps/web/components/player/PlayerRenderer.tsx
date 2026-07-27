"use client";

import { useEffect, useState } from "react";
import type { Page, ResolvedMedia, Zone } from "@drip-tv/shared";

export type MediaUrlMap = Record<string, ResolvedMedia>;

function fitClass(fit: Zone["fit"]): string {
  if (fit === "contain") return "object-contain";
  if (fit === "stretch") return "object-fill";
  return "object-cover";
}

function LiveClock({ format, tz }: { format: string; tz: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  let text = "--:--";
  if (now) {
    const wants24 = /H/.test(format) && !/h/.test(format);
    const wantsSeconds = /s/.test(format);
    try {
      text = new Intl.DateTimeFormat("en-US", {
        timeZone: tz || "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        second: wantsSeconds ? "2-digit" : undefined,
        hour12: !wants24,
      }).format(now);
    } catch {
      text = now.toLocaleTimeString();
    }
  }
  return <span suppressHydrationWarning>{text}</span>;
}

function WidgetCard({
  label,
  detail,
  tint,
}: {
  label: string;
  detail: string;
  tint: string;
}) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center ${tint} text-white`}>
      <span className="font-heading text-2xl uppercase tracking-[2px] text-white/90">{label}</span>
      <span className="mt-1 text-sm text-white/60">{detail}</span>
    </div>
  );
}

function PlayerZoneContent({ zone, media }: { zone: Zone; media: MediaUrlMap }) {
  const c = zone.content;

  switch (c.kind) {
    case "media": {
      const resolved = media[c.mediaId];
      if (!resolved) {
        return (
          <div className="flex h-full w-full items-center justify-center bg-black/60 text-white/40">
            <span className="font-heading text-sm uppercase tracking-[1px]">Media unavailable</span>
          </div>
        );
      }
      if (resolved.mediaType === "video") {
        return (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={resolved.url}
            className={`h-full w-full ${fitClass(zone.fit)}`}
            autoPlay
            muted={c.muted}
            loop={c.loop}
            playsInline
          />
        );
      }
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved.url}
          alt=""
          className={`h-full w-full ${fitClass(zone.fit)}`}
        />
      );
    }
    case "text":
      return (
        <div
          className="flex h-full w-full items-center p-4"
          style={{
            color: c.color,
            fontSize: c.fontSize,
            textAlign: c.align,
            justifyContent:
              c.align === "left" ? "flex-start" : c.align === "right" ? "flex-end" : "center",
          }}
        >
          <span className="break-words leading-tight">{c.text}</span>
        </div>
      );
    case "clock":
      return (
        <div className="flex h-full w-full items-center justify-center font-display text-6xl text-white">
          <LiveClock format={c.format} tz={c.tz} />
        </div>
      );
    case "weather":
      return (
        <WidgetCard label="Weather" detail="Live data pending setup" tint="bg-cornflower/40" />
      );
    case "sports":
      return (
        <WidgetCard
          label="Sports"
          detail={c.leagues.length > 0 ? c.leagues.join(" · ") : "All leagues"}
          tint="bg-maroon/40"
        />
      );
    case "playlist":
      return <WidgetCard label="Playlist" detail="" tint="bg-paua/50" />;
    default:
      return null;
  }
}

/** Renders one page of a display, filling its absolutely-positioned container. */
export function PlayerPageView({ page, media }: { page: Page; media: MediaUrlMap }) {
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
          <PlayerZoneContent zone={zone} media={media} />
        </div>
      ))}
    </div>
  );
}
