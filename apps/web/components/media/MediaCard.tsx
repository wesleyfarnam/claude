"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface MediaCardProps {
  id: string;
  name: string;
  type: "image" | "video";
  status: "uploading" | "processing" | "ready" | "error";
  thumbUrl: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDuration(s: number | null): string {
  if (s == null || !Number.isFinite(s)) return "";
  const total = Math.max(0, Math.round(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MediaCard(props: MediaCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/media/${props.id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Delete failed (${res.status})`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
        setConfirming(false);
      }
    });
  };

  return (
    <article className="group relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-athens">
      <div className="relative aspect-video w-full bg-athens">
        {props.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.thumbUrl}
            alt={props.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <TypeIcon type={props.type} status={props.status} />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-paua/80 px-2 py-0.5 font-heading text-xs uppercase tracking-wide text-white backdrop-blur">
          {props.type}
        </span>
        {props.status !== "ready" && (
          <span className="absolute right-2 top-2 inline-flex rounded-full bg-cornflower/90 px-2 py-0.5 font-heading text-xs uppercase tracking-wide text-white backdrop-blur">
            {props.status}
          </span>
        )}
        {props.type === "video" && props.durationSec != null && (
          <span className="absolute bottom-2 right-2 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-xs text-white">
            {fmtDuration(props.durationSec)}
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate font-medium text-paua" title={props.name}>
          {props.name}
        </p>
        <p className="mt-0.5 text-xs text-ink/50">
          {[
            props.width && props.height ? `${props.width}×${props.height}` : null,
            fmtBytes(props.bytes),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-3 flex items-center justify-end">
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded px-2 py-1 text-xs text-ink/60 hover:text-paua"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded bg-maroon px-3 py-1 font-heading text-xs uppercase tracking-wide text-white hover:bg-maroon/90 disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded px-2 py-1 font-heading text-xs uppercase tracking-wide text-maroon hover:bg-maroon/10"
            >
              Delete
            </button>
          )}
        </div>

        {error && <p className="mt-1 text-xs text-maroon">{error}</p>}
      </div>
    </article>
  );
}

function TypeIcon({ type, status }: { type: "image" | "video"; status: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-ink/40">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-10 w-10"
        aria-hidden="true"
      >
        {type === "video" ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm15 3 3-2v10l-3-2V9Z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm0 12 6-6 4 4 3-3 5 5"
          />
        )}
      </svg>
      <span className="font-heading text-xs uppercase tracking-wide">{status}</span>
    </div>
  );
}
