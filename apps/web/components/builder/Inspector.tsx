"use client";

import { useBuilderStore } from "@/lib/builder/store";
import type { Zone, ZoneContent } from "@drip-tv/shared";

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="rounded border border-athens bg-white px-2 py-1 text-body focus:border-sapphire focus:outline-none"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-athens bg-white px-2 py-1 text-body focus:border-sapphire focus:outline-none"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-athens bg-white px-2 py-1 text-body focus:border-sapphire focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ContentEditor({ zone }: { zone: Zone }) {
  const updateZone = useBuilderStore((s) => s.updateZone);
  const c = zone.content;

  if (c.kind === "text") {
    return (
      <div className="flex flex-col gap-3">
        <TextField
          label="Text"
          value={c.text}
          onChange={(text) =>
            updateZone(zone.id, { content: { kind: "text", text } as Partial<ZoneContent> })
          }
        />
        <NumberField
          label="Font size"
          value={c.fontSize}
          min={8}
          onChange={(fontSize) =>
            updateZone(zone.id, { content: { kind: "text", fontSize } as Partial<ZoneContent> })
          }
        />
        <TextField
          label="Color (hex)"
          value={c.color}
          onChange={(color) =>
            updateZone(zone.id, { content: { kind: "text", color } as Partial<ZoneContent> })
          }
        />
        <SelectField
          label="Align"
          value={c.align}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
          onChange={(align) =>
            updateZone(zone.id, { content: { kind: "text", align } as Partial<ZoneContent> })
          }
        />
      </div>
    );
  }

  if (c.kind === "clock") {
    return (
      <div className="flex flex-col gap-3">
        <TextField
          label="Format"
          value={c.format}
          onChange={(format) =>
            updateZone(zone.id, { content: { kind: "clock", format } as Partial<ZoneContent> })
          }
        />
        <TextField
          label="Timezone"
          value={c.tz}
          onChange={(tz) =>
            updateZone(zone.id, { content: { kind: "clock", tz } as Partial<ZoneContent> })
          }
        />
      </div>
    );
  }

  if (c.kind === "media") {
    return (
      <div className="flex flex-col gap-3 text-body text-ink/70">
        <p>
          Media id: <span className="font-mono text-xs">{c.mediaId}</span>
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={c.loop}
            onChange={(e) =>
              updateZone(zone.id, {
                content: { kind: "media", loop: e.target.checked } as Partial<ZoneContent>,
              })
            }
          />
          <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">Loop</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={c.muted}
            onChange={(e) =>
              updateZone(zone.id, {
                content: { kind: "media", muted: e.target.checked } as Partial<ZoneContent>,
              })
            }
          />
          <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">Muted</span>
        </label>
      </div>
    );
  }

  if (c.kind === "widget") {
    return (
      <p className="text-body text-ink/70">
        Widget id: <span className="font-mono text-xs">{c.widgetId}</span>
      </p>
    );
  }

  if (c.kind === "playlist") {
    return (
      <p className="text-body text-ink/70">
        Playlist id: <span className="font-mono text-xs">{c.playlistId}</span>
      </p>
    );
  }

  return null;
}

export function Inspector() {
  const display = useBuilderStore((s) => s.display);
  const selectedZoneId = useBuilderStore((s) => s.selectedZoneId);
  const updateZone = useBuilderStore((s) => s.updateZone);
  const removeZone = useBuilderStore((s) => s.removeZone);
  const zone = selectedZoneId ? display.zones.find((z) => z.id === selectedZoneId) : null;

  return (
    <aside className="flex w-72 flex-col gap-4 overflow-y-auto border-l border-athens bg-white p-4">
      <p className="font-heading text-h5 uppercase tracking-[1px] text-ink/60">Inspector</p>
      {!zone ? (
        <p className="text-body text-ink/50">Select a zone to edit.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-heading text-xs uppercase tracking-[1px] text-paua">
            {zone.content.kind} zone
          </p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="X %"
              value={zone.x}
              min={0}
              max={100}
              onChange={(x) => updateZone(zone.id, { x })}
            />
            <NumberField
              label="Y %"
              value={zone.y}
              min={0}
              max={100}
              onChange={(y) => updateZone(zone.id, { y })}
            />
            <NumberField
              label="W %"
              value={zone.w}
              min={1}
              max={100}
              onChange={(w) => updateZone(zone.id, { w })}
            />
            <NumberField
              label="H %"
              value={zone.h}
              min={1}
              max={100}
              onChange={(h) => updateZone(zone.id, { h })}
            />
          </div>
          <NumberField
            label="Z-index"
            value={zone.z}
            onChange={(z) => updateZone(zone.id, { z })}
          />
          <SelectField
            label="Fit"
            value={zone.fit}
            options={[
              { value: "contain", label: "Contain" },
              { value: "cover", label: "Cover" },
              { value: "stretch", label: "Stretch" },
            ]}
            onChange={(fit) => updateZone(zone.id, { fit })}
          />
          <div className="border-t border-athens pt-3">
            <ContentEditor zone={zone} />
          </div>
          <button
            type="button"
            onClick={() => removeZone(zone.id)}
            className="mt-4 rounded bg-maroon px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-maroon/90"
          >
            Delete zone
          </button>
        </div>
      )}
    </aside>
  );
}
