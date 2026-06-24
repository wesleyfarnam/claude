"use client";

import { useState } from "react";

export type MediaPickerItem = {
  id: string;
  name: string;
  type: string;
  thumb_path: string | null;
};

export type WidgetPickerItem = {
  id: string;
  name: string;
  type: string;
};

type Item = { id: string; name: string; subtitle?: string; thumb?: string | null };

export function PickerModal({
  open,
  title,
  items,
  onPick,
  onClose,
  emptyLabel,
}: {
  open: boolean;
  title: string;
  items: Item[];
  onPick: (id: string) => void;
  onClose: () => void;
  emptyLabel?: string;
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
        className="flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
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
                    className="group flex w-full flex-col overflow-hidden rounded-md border border-athens bg-white text-left transition hover:border-sapphire hover:shadow"
                  >
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

export function MediaPickerModal({
  open,
  media,
  filterType,
  onPick,
  onClose,
}: {
  open: boolean;
  media: MediaPickerItem[];
  filterType?: "image" | "video";
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const filtered = filterType ? media.filter((m) => m.type === filterType) : media;
  const items: Item[] = filtered.map((m) => ({
    id: m.id,
    name: m.name,
    subtitle: m.type,
    thumb: m.thumb_path,
  }));
  return (
    <PickerModal
      open={open}
      title={filterType ? `Pick ${filterType}` : "Pick media"}
      items={items}
      onPick={onPick}
      onClose={onClose}
      emptyLabel="Upload media first"
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
