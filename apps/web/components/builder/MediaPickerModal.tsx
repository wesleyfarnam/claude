"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MediaUploader } from "@/components/media/MediaUploader";

export type MediaStatus = "uploading" | "processing" | "ready" | "error";

export type MediaPickerItem = {
  id: string;
  name: string;
  type: string;
  /**
   * Optional so callers that only pass 'ready' assets (e.g. the display editor
   * page's SSR query) keep compiling — missing status is treated as 'ready'.
   */
  status?: MediaStatus;
  thumb_path: string | null;
};

export type WidgetPickerItem = {
  id: string;
  name: string;
  type: string;
};

type Item = {
  id: string;
  name: string;
  subtitle?: string;
  thumb?: string | null;
  disabled?: boolean;
  badge?: { label: string; tone: "muted" | "danger" };
  disabledReason?: string;
};

/**
 * Generic modal used by both the media picker and widget picker. Renders a
 * grid of pickable tiles with a search box and optional slot content above
 * the grid (used by the media picker to embed the uploader).
 */
export function PickerModal({
  open,
  title,
  items,
  onPick,
  onClose,
  emptyLabel,
  above,
}: {
  open: boolean;
  title: string;
  items: Item[];
  onPick: (id: string) => void;
  onClose: () => void;
  emptyLabel?: string;
  above?: React.ReactNode;
}) {
  const [filter, setFilter] = useState("");
  if (!open) return null;

  const filtered = filter
    ? items.filter((i) => i.name.toLowerCase().includes(filter.toLowerCase()))
    : items;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-athens px-6 py-4">
          <h2 className="font-heading text-h5 uppercase tracking-[1px] text-paua">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-heading text-sm uppercase tracking-[1px] text-ink/50 hover:text-paua"
          >
            Close
          </button>
        </div>
        {above ? <div className="border-b border-athens px-6 py-4">{above}</div> : null}
        <div className="px-6 pt-4">
          <input
            type="search"
            placeholder="Search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded border border-athens bg-athens/40 px-3 py-2 text-body focus:border-sapphire focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center font-heading uppercase tracking-[1px] text-ink/40">
              {emptyLabel ?? "Nothing here yet"}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item.id)}
                    disabled={item.disabled}
                    title={item.disabled ? item.disabledReason : undefined}
                    aria-disabled={item.disabled || undefined}
                    className={`group relative flex w-full flex-col overflow-hidden rounded-md border border-athens bg-white text-left transition ${
                      item.disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:border-sapphire hover:shadow"
                    }`}
                  >
                    {item.badge ? (
                      <span
                        className={`absolute right-2 top-2 z-10 inline-block rounded-full px-2 py-0.5 font-heading text-[10px] uppercase tracking-wide shadow-sm ${
                          item.badge.tone === "danger"
                            ? "bg-maroon/90 text-white"
                            : "bg-white/90 text-paua"
                        }`}
                      >
                        {item.badge.label}
                      </span>
                    ) : null}
                    <div className="flex aspect-video items-center justify-center bg-athens">
                      {item.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumb}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-heading text-xs uppercase tracking-[1px] text-ink/40">
                          No preview
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-body text-ink">{item.name}</p>
                      {item.subtitle ? (
                        <p className="mt-1 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MediaPickerModal — used by the builder Toolbox when adding a media zone.
 *
 * SSR-seeds the grid from the `media` prop (fetched by the edit page), then
 * once the modal opens polls `/api/media` every 3s so a freshly-uploaded asset
 * from the embedded uploader appears (and becomes selectable) as soon as it
 * finalizes.
 */
export function MediaPickerModal({
  open,
  media,
  filterType,
  onPick,
  onClose,
}: {
  open: boolean;
  media: MediaPickerItem[];
  /** Restrict the grid to a specific media kind. Undefined shows both. */
  filterType?: "image" | "video";
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  // Live list, seeded from SSR props so the first paint has content and swapped
  // out with the polled response once it lands.
  const [live, setLive] = useState<MediaPickerItem[]>(media);

  // Re-seed when the parent passes a new media list (e.g. after router.refresh
  // completes) or when the modal reopens.
  useEffect(() => {
    setLive(media);
  }, [media]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Poll while open. Also fetch immediately on open so the SSR thumb paths
  // (raw storage paths from the edit page query) get replaced with signed URLs.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function refresh(): Promise<void> {
      try {
        const res = await fetch("/api/media", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { media?: MediaPickerItem[] };
        if (cancelled || !isMountedRef.current) return;
        if (Array.isArray(body.media)) {
          setLive(body.media);
        }
      } catch {
        // Transient network errors are fine — the next tick retries.
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open]);

  const filtered = useMemo(
    () => (filterType ? live.filter((m) => m.type === filterType) : live),
    [live, filterType],
  );

  const items: Item[] = useMemo(
    () =>
      filtered.map((m) => {
        const status: MediaStatus = m.status ?? "ready";
        const isReady = status === "ready";
        const isError = status === "error";
        return {
          id: m.id,
          name: m.name,
          subtitle: m.type,
          thumb: m.thumb_path,
          disabled: !isReady,
          disabledReason: isError
            ? "Upload failed — try re-uploading"
            : "Still processing — available in a few seconds",
          badge: isReady
            ? undefined
            : isError
              ? { label: "Failed", tone: "danger" as const }
              : { label: "Processing", tone: "muted" as const },
        };
      }),
    [filtered],
  );

  // Guard onPick so a disabled tile (a not-yet-ready asset) can't slip through
  // even if a caller re-uses PickerModal without wiring disabled state.
  function handlePick(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.disabled) return;
    onPick(id);
  }

  return (
    <PickerModal
      open={open}
      title={filterType ? `Pick ${filterType}` : "Pick media"}
      items={items}
      onPick={handlePick}
      onClose={onClose}
      emptyLabel="Upload a file above to get started"
      above={
        <div>
          <p className="mb-3 font-heading text-xs uppercase tracking-[1px] text-ink/60">
            Upload new
          </p>
          <MediaUploader />
        </div>
      }
    />
  );
}

export function WidgetPickerModal({
  open,
  widgets,
  onPick,
  onClose,
}: {
  open: boolean;
  widgets: WidgetPickerItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const items: Item[] = widgets.map((w) => ({
    id: w.id,
    name: w.name,
    subtitle: w.type,
    thumb: null,
  }));
  return (
    <PickerModal
      open={open}
      title="Pick widget"
      items={items}
      onPick={onPick}
      onClose={onClose}
      emptyLabel="No widgets configured"
    />
  );
}
