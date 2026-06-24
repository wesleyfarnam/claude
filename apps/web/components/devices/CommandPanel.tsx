"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeviceCommandType } from "@drip-tv/shared";

/**
 * Per-device remote-control panel.
 *
 * Shows action buttons (sapphire for benign actions, maroon for destructive)
 * and the last ten commands with their live status. While anything is
 * `queued` or `sent`, we poll every 5s; otherwise polling is paused to keep
 * the dashboard quiet.
 *
 * Owned by this file: action surface + history list. The parent device page
 * (M3) just renders <CommandPanel deviceId=... /> and is otherwise untouched.
 */

type CommandStatus = "queued" | "sent" | "ack" | "failed";

type CommandRow = {
  id: string;
  device_id: string;
  type: DeviceCommandType;
  payload: Record<string, unknown> | null;
  status: CommandStatus;
  created_at: string;
  sent_at: string | null;
  acked_at: string | null;
  result: Record<string, unknown> | null;
};

type ActionDef = {
  type: DeviceCommandType;
  label: string;
  /** sapphire = benign, maroon = destructive */
  tone: "sapphire" | "maroon";
  hint?: string;
};

const ACTIONS: ActionDef[] = [
  { type: "force_refresh", label: "Force refresh", tone: "sapphire", hint: "Reload current playlist" },
  { type: "screenshot", label: "Screenshot", tone: "sapphire", hint: "Capture what's on screen" },
  { type: "clear_cache", label: "Clear cache", tone: "sapphire", hint: "Wipe local media cache" },
  { type: "reboot", label: "Reboot", tone: "maroon", hint: "Hardware reboot via Amazon" },
];

const POLL_MS = 5000;
const HISTORY_LIMIT = 10;

export function CommandPanel({ deviceId }: { deviceId: string }) {
  const [history, setHistory] = useState<CommandRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<DeviceCommandType | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aborted = useRef(false);

  const hasActiveCommand = useMemo(
    () =>
      history?.some((c) => c.status === "queued" || c.status === "sent") ?? false,
    [history],
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(deviceId)}/commands?limit=${HISTORY_LIMIT}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        // GET isn't implemented in this scope (POST-only here); fall back to
        // whatever we already have. Don't surface this as a user-facing error.
        return;
      }
      const data = (await res.json()) as { commands?: CommandRow[] } | CommandRow[];
      if (aborted.current) return;
      const list = Array.isArray(data) ? data : (data.commands ?? []);
      setHistory(list.slice(0, HISTORY_LIMIT));
    } catch {
      // Silent — polling will try again.
    }
  }, [deviceId]);

  // Bootstrap from local state — since we don't have a GET endpoint in scope,
  // start empty and let POST responses populate the list.
  useEffect(() => {
    aborted.current = false;
    setHistory((curr) => curr ?? []);
    return () => {
      aborted.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [deviceId]);

  // Polling loop: only runs while something is in-flight.
  useEffect(() => {
    if (!hasActiveCommand) return;
    let cancelled = false;
    const tick = async () => {
      await loadHistory();
      if (cancelled || aborted.current) return;
      pollTimer.current = setTimeout(tick, POLL_MS);
    };
    pollTimer.current = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [hasActiveCommand, loadHistory]);

  const runCommand = useCallback(
    async (type: DeviceCommandType) => {
      setError(null);
      setBusy(type);
      try {
        const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}/commands`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type }),
        });
        const data = (await res.json()) as CommandRow & { error?: string };
        if (!res.ok) {
          setError(data.error ?? `Failed: HTTP ${res.status}`);
          return;
        }
        setHistory((curr) => {
          const next = [data, ...(curr ?? [])];
          return next.slice(0, HISTORY_LIMIT);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [deviceId],
  );

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <header className="mb-4">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Remote control</p>
        <h2 className="mt-1 text-h3 font-black text-paua">Commands</h2>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <ActionButton
            key={action.type}
            action={action}
            busy={busy === action.type}
            disabled={busy !== null}
            onClick={() => runCommand(action.type)}
          />
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded border border-maroon/30 bg-maroon/5 p-3 text-sm text-maroon">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <p className="font-heading text-sm uppercase tracking-[1px] text-ink/60">Recent</p>
        {history === null || history.length === 0 ? (
          <p className="mt-2 text-sm text-ink/50">No commands yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-athens">
            {history.map((cmd) => (
              <CommandRowItem key={cmd.id} cmd={cmd} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ActionButton({
  action,
  busy,
  disabled,
  onClick,
}: {
  action: ActionDef;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const tone =
    action.tone === "maroon"
      ? "bg-maroon hover:bg-maroon/90 text-white"
      : "bg-sapphire hover:bg-sapphire/90 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={action.hint}
      className={clsx(
        "flex flex-col items-start gap-1 rounded p-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        tone,
      )}
    >
      <span className="font-heading text-btn uppercase">
        {busy ? "Sending..." : action.label}
      </span>
      {action.hint ? (
        <span className="text-xs opacity-80">{action.hint}</span>
      ) : null}
    </button>
  );
}

function CommandRowItem({ cmd }: { cmd: CommandRow }) {
  const screenshotUrl =
    cmd.type === "screenshot" && cmd.result && typeof cmd.result === "object"
      ? ((cmd.result as Record<string, unknown>).screenshot_url as string | undefined)
      : undefined;

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-heading text-sm uppercase tracking-[1px] text-paua">
          {cmd.type.replaceAll("_", " ")}
        </p>
        <p className="truncate text-xs text-ink/50">
          {new Date(cmd.created_at).toLocaleString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {screenshotUrl ? (
          <a
            href={screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-heading text-xs uppercase tracking-[1px] text-aqua hover:underline"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full bg-aqua ring-2 ring-aqua/30"
            />
            Ready
          </a>
        ) : null}
        <StatusPill status={cmd.status} />
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: CommandStatus }) {
  const map: Record<CommandStatus, string> = {
    queued: "bg-ink/10 text-ink/70",
    sent: "bg-sapphire/15 text-sapphire",
    ack: "bg-aqua/20 text-paua",
    failed: "bg-maroon/15 text-maroon",
  };
  const label: Record<CommandStatus, string> = {
    queued: "Queued",
    sent: "Sent",
    ack: "Done",
    failed: "Failed",
  };
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 font-heading text-xs uppercase tracking-[1px]",
        map[status],
      )}
    >
      {label[status]}
    </span>
  );
}
