"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybackEvent, Program, ProgramItem } from "@drip-tv/shared";
import {
  ackCommand,
  cacheProgram,
  fetchSchedule,
  PLAYER_VERSION,
  readCachedProgram,
  sendHeartbeat,
  sendPlaybackEvents,
  UnauthorizedError,
  type DeviceCreds,
  type ScheduleCommand,
} from "@/lib/player/client";
import { PlayerPageView, type MediaUrlMap } from "./PlayerRenderer";

const HEARTBEAT_MS = 30_000;
const EVENT_FLUSH_MS = 15_000;
const MIN_REFRESH_MS = 30_000;

type Pos = { item: number; page: number };

function currentUnitDurationMs(program: Program, pos: Pos): number {
  const item = program.items[pos.item];
  if (!item) return 10_000;
  if (item.type === "display") {
    const page = item.display.pages[pos.page];
    return Math.max(1, page?.durationSec ?? 10) * 1000;
  }
  return Math.max(1, item.durationSec) * 1000;
}

export function PlayerRuntime({
  creds,
  onUnauthorized,
}: {
  creds: DeviceCreds;
  onUnauthorized: () => void;
}) {
  const [program, setProgram] = useState<Program | null>(() => readCachedProgram());
  const [pos, setPos] = useState<Pos>({ item: 0, page: 0 });
  const [booting, setBooting] = useState(true);

  // Refs mirror state so long-lived timers always see the latest values.
  const programRef = useRef<Program | null>(program);
  const posRef = useRef<Pos>(pos);
  const itemStartRef = useRef<number>(Date.now());
  const eventsRef = useRef<PlaybackEvent[]>([]);
  const inflightCmds = useRef<Set<string>>(new Set());
  const advanceRef = useRef<() => void>(() => {});
  programRef.current = program;
  posRef.current = pos;

  const mediaMap: MediaUrlMap = useMemo(() => {
    const map: MediaUrlMap = {};
    for (const m of program?.media ?? []) map[m.mediaId] = m;
    return map;
  }, [program]);

  const recordEvent = useCallback((item: ProgramItem, reason: string) => {
    const durationMs = Math.max(0, Date.now() - itemStartRef.current);
    eventsRef.current.push({
      device_id: creds.deviceId,
      ts: new Date(itemStartRef.current).toISOString(),
      playlist_id: item.playlistId,
      playlist_item_id: item.itemId,
      media_id: item.type === "media" ? item.mediaId : null,
      display_id: item.type === "display" ? item.displayId : null,
      duration_ms: durationMs,
      completed: true,
      reason,
    });
  }, [creds.deviceId]);

  // Advance one unit (display page, then item; media → next item). Wraps.
  advanceRef.current = () => {
    const prog = programRef.current;
    if (!prog || prog.items.length === 0) return;
    const { item: iIdx, page: pIdx } = posRef.current;
    const item = prog.items[iIdx];
    if (!item) {
      setPos({ item: 0, page: 0 });
      return;
    }
    if (item.type === "display" && pIdx < item.display.pages.length - 1) {
      setPos({ item: iIdx, page: pIdx + 1 });
      return;
    }
    // Leaving this item — log it and move on.
    recordEvent(item, "advance");
    setPos({ item: (iIdx + 1) % prog.items.length, page: 0 });
  };

  // Timer that fires the current unit's advance. Re-armed on every pos change.
  useEffect(() => {
    const prog = programRef.current;
    if (!prog || prog.items.length === 0) return;
    // Reset the per-item clock when the item (not just the page) changes.
    if (pos.page === 0) itemStartRef.current = Date.now();
    const ms = currentUnitDurationMs(prog, pos);
    const id = setTimeout(() => advanceRef.current(), ms);
    return () => clearTimeout(id);
  }, [pos, program]);

  // Process any queued commands from a schedule response (best-effort).
  const handleCommands = useCallback(
    async (commands: ScheduleCommand[], refresh: () => void) => {
      for (const cmd of commands) {
        if (inflightCmds.current.has(cmd.id)) continue;
        inflightCmds.current.add(cmd.id);
        try {
          switch (cmd.type) {
            case "force_refresh":
            case "reload_config":
            case "clear_cache":
              refresh();
              await ackCommand(creds.token, creds.deviceId, cmd.id, "ack");
              break;
            case "reboot":
              await ackCommand(creds.token, creds.deviceId, cmd.id, "ack");
              window.location.reload();
              break;
            default:
              // screenshot / power / factory_reset need OS hooks the web
              // player doesn't have yet — ack so they don't re-queue forever.
              await ackCommand(creds.token, creds.deviceId, cmd.id, "ack", {
                note: "not supported by web player",
              });
          }
        } catch {
          inflightCmds.current.delete(cmd.id); // allow a later retry
        }
      }
    },
    [creds.token, creds.deviceId],
  );

  // Schedule polling loop: fetch now, then re-fetch on each program's validity.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const res = await fetchSchedule(creds.token);
        if (cancelled) return;
        setProgram(res.program);
        cacheProgram(res.program);
        setPos((prev) => {
          // Keep position if still in range, else restart.
          const maxItem = res.program.items.length - 1;
          return prev.item > maxItem ? { item: 0, page: 0 } : prev;
        });
        setBooting(false);
        void handleCommands(res.commands, () => void load());
        const validMs = new Date(res.program.validUntil).getTime() - Date.now();
        timer = setTimeout(load, Math.max(MIN_REFRESH_MS, validMs));
      } catch (err) {
        if (cancelled) return;
        setBooting(false);
        if (err instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }
        // Offline — keep playing the cached program, retry soon.
        timer = setTimeout(load, MIN_REFRESH_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [creds.token, handleCommands, onUnauthorized]);

  // Heartbeat loop.
  useEffect(() => {
    const beat = () => {
      const prog = programRef.current;
      const item = prog?.items[posRef.current.item];
      void sendHeartbeat(creds.token, {
        device_id: creds.deviceId,
        ts: new Date().toISOString(),
        status: prog && prog.items.length > 0 ? "playing" : "idle",
        playing_playlist_id: item?.playlistId ?? null,
        playing_item_id: item?.itemId ?? null,
        player_version: PLAYER_VERSION,
        errors: [],
      });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [creds.token, creds.deviceId]);

  // Playback-event flush loop.
  useEffect(() => {
    const flush = () => {
      const batch = eventsRef.current.splice(0, eventsRef.current.length);
      if (batch.length > 0) void sendPlaybackEvents(creds.token, batch);
    };
    const id = setInterval(flush, EVENT_FLUSH_MS);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [creds.token]);

  // ── Render ─────────────────────────────────────────────────────────
  if (booting && !program) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-ink text-white/60">
        <span className="font-heading uppercase tracking-[3px]">Starting…</span>
      </div>
    );
  }

  if (!program || program.items.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-ink text-white/50">
        <p className="font-heading text-2xl uppercase tracking-[3px]">Drip TV</p>
        <p className="mt-3 text-white/40">No content scheduled for this screen.</p>
      </div>
    );
  }

  const item = program.items[Math.min(pos.item, program.items.length - 1)];
  if (!item) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {item.type === "display" ? (
        (() => {
          const page = item.display.pages[Math.min(pos.page, item.display.pages.length - 1)];
          return page ? <PlayerPageView page={page} media={mediaMap} /> : null;
        })()
      ) : item.mediaType === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={item.itemId}
          src={item.url}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={item.itemId} src={item.url} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
