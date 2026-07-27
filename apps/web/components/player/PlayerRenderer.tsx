"use client";

import { useEffect, useState } from "react";
import type { Page, ResolvedMedia, Zone } from "@drip-tv/shared";
import type { WidgetData } from "@/lib/player/client";

export type MediaUrlMap = Record<string, ResolvedMedia>;

const EMPTY_WIDGETS: WidgetData = { weather: null, sports: null };

function owmIcon(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

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

function WeatherView({
  weather,
  units,
  showForecast,
}: {
  weather: WidgetData["weather"];
  units: "imperial" | "metric";
  showForecast: boolean;
}) {
  if (!weather) {
    return <WidgetCard label="Weather" detail="Loading…" tint="bg-cornflower/40" />;
  }
  const temp = units === "metric" ? weather.tempC : weather.tempF;
  const deg = units === "metric" ? "°C" : "°F";
  return (
    <div className="flex h-full w-full flex-col justify-center bg-cornflower/40 px-[6%] text-white">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={owmIcon(weather.icon)} alt="" className="h-20 w-20 object-contain" />
        <div className="leading-none">
          <div className="font-display text-6xl font-black">
            {temp}
            {deg}
          </div>
          <div className="mt-1 text-lg capitalize text-white/80">{weather.condition}</div>
        </div>
      </div>
      <div className="mt-2 font-heading text-sm uppercase tracking-[2px] text-white/70">
        {weather.location}
      </div>
      {showForecast && weather.forecast.length > 0 ? (
        <div className="mt-4 flex gap-4">
          {weather.forecast.slice(0, 5).map((f) => (
            <div key={f.day} className="flex flex-col items-center text-white/80">
              <span className="text-xs uppercase tracking-[1px]">{f.day}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={owmIcon(f.icon)} alt="" className="h-8 w-8 object-contain" />
              <span className="text-xs">
                {f.hi}° / {f.lo}°
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SportsView({
  sports,
  leagues,
}: {
  sports: WidgetData["sports"];
  leagues: string[];
}) {
  if (!sports) {
    return <WidgetCard label="Sports" detail="Loading…" tint="bg-maroon/40" />;
  }
  const filtered =
    leagues.length > 0
      ? sports.events.filter((e) => leagues.includes(e.league))
      : sports.events;
  const rows = filtered.slice(0, 5);
  if (rows.length === 0) {
    return (
      <WidgetCard
        label="Sports"
        detail={sports.warning ?? "No recent games"}
        tint="bg-maroon/40"
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col justify-center bg-maroon/40 px-[6%] text-white">
      <div className="mb-2 font-heading text-sm uppercase tracking-[2px] text-white/70">
        Latest scores
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-lg">
            <span className="truncate text-white/90">
              {e.away} @ {e.home}
            </span>
            <span className="ml-3 shrink-0 font-display font-black">
              {e.awayScore ?? "–"} : {e.homeScore ?? "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayerZoneContent({
  zone,
  media,
  widgets,
}: {
  zone: Zone;
  media: MediaUrlMap;
  widgets: WidgetData;
}) {
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
        <WeatherView weather={widgets.weather} units={c.units} showForecast={c.showForecast} />
      );
    case "sports":
      return <SportsView sports={widgets.sports} leagues={c.leagues} />;
    case "playlist":
      return <WidgetCard label="Playlist" detail="" tint="bg-paua/50" />;
    default:
      return null;
  }
}

/** Renders one page of a display, filling its absolutely-positioned container. */
export function PlayerPageView({
  page,
  media,
  widgets = EMPTY_WIDGETS,
}: {
  page: Page;
  media: MediaUrlMap;
  widgets?: WidgetData;
}) {
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
          <PlayerZoneContent zone={zone} media={media} widgets={widgets} />
        </div>
      ))}
    </div>
  );
}
