"use client";

import { useState, useTransition } from "react";
import { addItem, moveItem, removeItem, updatePlaylist } from "../actions";

export type PlaylistEditorItem = {
  id: string;
  position: number;
  duration_sec: number;
  transition: "cut" | "fade";
  kind: "display" | "media";
  refId: string;
  refName: string;
};

type Playlist = {
  id: string;
  name: string;
  loop: boolean;
  default_item_duration_sec: number;
};

export function PlaylistEditor({
  playlist,
  items,
  displayOptions,
  mediaOptions,
}: {
  playlist: Playlist;
  items: PlaylistEditorItem[];
  displayOptions: { id: string; name: string }[];
  mediaOptions: { id: string; name: string; type: string }[];
}) {
  const [name, setName] = useState(playlist.name);
  const [loop, setLoop] = useState(playlist.loop);
  const [defaultDur, setDefaultDur] = useState(playlist.default_item_duration_sec);
  const [showDisplayPicker, setShowDisplayPicker] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSettingsSave() {
    setError(null);
    startTransition(async () => {
      const result = await updatePlaylist(playlist.id, {
        name,
        loop,
        default_item_duration_sec: defaultDur,
      });
      if (result.error) setError(result.error);
    });
  }

  function addDisplay(displayId: string) {
    setError(null);
    setShowDisplayPicker(false);
    startTransition(async () => {
      const result = await addItem(playlist.id, {
        display_id: displayId,
        duration_sec: defaultDur,
      });
      if (result.error) setError(result.error);
    });
  }

  function addMedia(mediaId: string) {
    setError(null);
    setShowMediaPicker(false);
    startTransition(async () => {
      const result = await addItem(playlist.id, {
        media_id: mediaId,
        duration_sec: defaultDur,
      });
      if (result.error) setError(result.error);
    });
  }

  function move(itemId: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const result = await moveItem(itemId, direction);
      if (result.error) setError(result.error);
    });
  }

  function remove(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeItem(itemId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="font-heading text-h5 uppercase tracking-[1px] text-paua">Settings</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border border-athens bg-white px-3 py-2 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">
              Default duration (s)
            </span>
            <input
              type="number"
              min={1}
              value={defaultDur}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isFinite(next)) setDefaultDur(next);
              }}
              className="rounded border border-athens bg-white px-3 py-2 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />
            <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">Loop</span>
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSettingsSave}
            disabled={isPending}
            className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua disabled:cursor-not-allowed disabled:bg-ink/40"
          >
            {isPending ? "Saving" : "Save settings"}
          </button>
          {error ? (
            <span className="font-heading text-xs uppercase tracking-[1px] text-maroon">
              {error}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-h5 uppercase tracking-[1px] text-paua">Items</h2>
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDisplayPicker((v) => !v);
                setShowMediaPicker(false);
              }}
              className="rounded bg-sapphire px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-paua"
            >
              Add display
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMediaPicker((v) => !v);
                setShowDisplayPicker(false);
              }}
              className="rounded bg-sapphire px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-paua"
            >
              Add media
            </button>
            {showDisplayPicker ? (
              <div className="absolute right-0 top-full z-10 mt-2 max-h-72 w-72 overflow-auto rounded border border-athens bg-white shadow-lg">
                {displayOptions.length === 0 ? (
                  <p className="px-3 py-2 text-body text-ink/50">No displays yet</p>
                ) : (
                  displayOptions.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => addDisplay(d.id)}
                      className="block w-full px-3 py-2 text-left text-body hover:bg-athens"
                    >
                      {d.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}
            {showMediaPicker ? (
              <div className="absolute right-0 top-full z-10 mt-2 max-h-72 w-72 overflow-auto rounded border border-athens bg-white shadow-lg">
                {mediaOptions.length === 0 ? (
                  <p className="px-3 py-2 text-body text-ink/50">No media yet</p>
                ) : (
                  mediaOptions.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => addMedia(m.id)}
                      className="block w-full px-3 py-2 text-left text-body hover:bg-athens"
                    >
                      <span>{m.name}</span>
                      <span className="ml-2 font-heading text-xs uppercase tracking-[1px] text-ink/40">
                        {m.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-6 py-8 text-center font-heading text-sm uppercase tracking-[1px] text-ink/40">
            No items yet
          </p>
        ) : (
          <table className="mt-4 w-full text-left">
            <thead>
              <tr className="border-b border-athens">
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  #
                </th>
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Kind
                </th>
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Name
                </th>
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Duration
                </th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-athens/60">
                  <td className="py-2 text-body text-ink/60">{idx + 1}</td>
                  <td className="py-2 font-heading text-xs uppercase tracking-[1px] text-paua">
                    {item.kind}
                  </td>
                  <td className="py-2 text-body text-ink">{item.refName}</td>
                  <td className="py-2 text-body text-ink/70">{item.duration_sec}s</td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => move(item.id, "up")}
                        disabled={isPending || idx === 0}
                        className="rounded border border-athens px-2 py-1 font-heading text-xs uppercase tracking-[1px] text-paua hover:bg-athens disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => move(item.id, "down")}
                        disabled={isPending || idx === items.length - 1}
                        className="rounded border border-athens px-2 py-1 font-heading text-xs uppercase tracking-[1px] text-paua hover:bg-athens disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        disabled={isPending}
                        className="rounded bg-maroon px-2 py-1 font-heading text-xs uppercase tracking-[1px] text-white hover:bg-maroon/90 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
