"use client";

import { useBuilderStore } from "@/lib/builder/store";
import { SPORTS_LEAGUES, type SportsLeague, type Zone, type ZoneContent } from "@drip-tv/shared";

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

  if (c.kind === "weather") {
    return (
      <div className="flex flex-col gap-3">
        <SelectField
          label="Units"
          value={c.units}
          options={[
            { value: "imperial", label: "Imperial °F" },
            { value: "metric", label: "Metric °C" },
          ]}
          onChange={(units) =>
            updateZone(zone.id, {
              content: { kind: "weather", units } as Partial<ZoneContent>,
            })
          }
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={c.showForecast}
            onChange={(e) =>
              updateZone(zone.id, {
                content: { kind: "weather", showForecast: e.target.checked } as Partial<ZoneContent>,
              })
            }
          />
          <span className="font-heading text-xs uppercase tracking-[1px] text-ink/60">
            Show forecast
          </span>
        </label>
        <p className="rounded border border-athens bg-athens/40 p-2 text-body text-ink/60">
          Location is pulled automatically from the device&apos;s assigned location.
        </p>
      </div>
    );
  }

  if (c.kind === "sports") {
    const selected = c.leagues;
    function toggleLeague(league: SportsLeague, on: boolean) {
      const next = on
        ? [...selected.filter((l) => l !== league), league]
        : selected.filter((l) => l !== league);
      // Keep the schema's canonical league order for stable output.
      const ordered = SPORTS_LEAGUES.filter((l) => next.includes(l));
      updateZone(zone.id, {
        content: { kind: "sports", leagues: ordered } as Partial<ZoneContent>,
      });
    }
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-aqua/20 px-3 py-1 font-heading text-xs uppercase tracking-[1px] text-paua">
            <span className="h-2 w-2 rounded-full bg-aqua" />
            On
          </span>
          <span className="font-heading text-xs uppercase tracking-[1px] text-ink/50">
            Sports scores
          </span>
        </div>
        {selected.length === 0 ? (
          <p className="rounded border border-athens bg-athens/40 p-2 text-body text-ink/60">
            Showing all major leagues by default.
          </p>
        ) : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="font-heading text-xs uppercase tracking-[1px] text-ink/60">
            Advanced: leagues
          </legend>
          {SPORTS_LEAGUES.map((league) => (
            <label key={league} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(league)}
                onChange={(e) => toggleLeague(league, e.target.checked)}
              />
              <span className="text-body text-ink/80">{league}</span>
            </label>
          ))}
          <p className="text-body text-ink/50">Uncheck all to show every default league.</p>
        </fieldset>
        <TextField
          label="Advanced: specific teams (optional)"
          value={c.teams.join(", ")}
          onChange={(raw) => {
            const teams = raw
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0);
            updateZone(zone.id, {
              content: { kind: "sports", teams } as Partial<ZoneContent>,
            });
          }}
        />
      </div>
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
