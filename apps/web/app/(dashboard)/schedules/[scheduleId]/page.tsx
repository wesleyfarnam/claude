import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import {
  updateScheduleForm,
  addTargetForm,
  removeTargetForm,
  addPlaylistForm,
  removePlaylistForm,
  deleteScheduleForm,
} from "../actions";

type ScheduleRow = {
  id: string;
  name: string;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
};

type TargetRow = {
  id: string;
  device_id: string | null;
  location_id: string | null;
};

type SchedulePlaylistRow = {
  schedule_id: string;
  playlist_id: string;
  position: number;
};

type Lookup = { id: string; name: string };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const LABEL = "block font-heading text-h5 uppercase tracking-[1px] text-paua";
const INPUT =
  "mt-1 block w-full rounded border border-ink/15 bg-white px-3 py-2 text-body text-ink focus:border-sapphire focus:outline-none";
const BTN_PRIMARY =
  "rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-sapphire/90";
const BTN_SECONDARY =
  "rounded border border-ink/15 bg-white px-3 py-1.5 font-heading text-btn uppercase tracking-[1px] text-paua hover:border-sapphire hover:text-sapphire";
const BTN_DANGER =
  "rounded border border-maroon/40 px-3 py-1.5 font-heading text-btn uppercase tracking-[1px] text-maroon hover:bg-maroon hover:text-white";

export default async function ScheduleEditPage({
  params,
}: {
  params: Promise<{ scheduleId: string }>;
}) {
  await requireUser();
  const { scheduleId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: scheduleData } = await supabase
    .from("schedules")
    .select(
      "id, name, priority, start_date, end_date, days_of_week, start_time, end_time, timezone",
    )
    .eq("id", scheduleId)
    .maybeSingle();

  if (!scheduleData) notFound();
  const schedule = scheduleData as ScheduleRow;

  const [
    { data: targetData },
    { data: playlistAssignments },
    { data: devicesData },
    { data: locationsData },
    { data: playlistsData },
  ] = await Promise.all([
    supabase
      .from("schedule_targets")
      .select("id, device_id, location_id")
      .eq("schedule_id", scheduleId),
    supabase
      .from("schedule_playlists")
      .select("schedule_id, playlist_id, position")
      .eq("schedule_id", scheduleId)
      .order("position", { ascending: true }),
    supabase.from("devices").select("id, name").order("name"),
    supabase.from("locations").select("id, name").order("name"),
    supabase.from("playlists").select("id, name").order("name"),
  ]);

  const targets = (targetData ?? []) as TargetRow[];
  const playlistRows = (playlistAssignments ?? []) as SchedulePlaylistRow[];
  const devices = (devicesData ?? []) as Lookup[];
  const locations = (locationsData ?? []) as Lookup[];
  const allPlaylists = (playlistsData ?? []) as Lookup[];

  const deviceById = new Map(devices.map((d) => [d.id, d.name]));
  const locationById = new Map(locations.map((l) => [l.id, l.name]));
  const playlistById = new Map(allPlaylists.map((p) => [p.id, p.name]));
  const usedPlaylistIds = new Set(playlistRows.map((p) => p.playlist_id));
  const availablePlaylists = allPlaylists.filter((p) => !usedPlaylistIds.has(p.id));

  const checkedDays = new Set(schedule.days_of_week ?? []);

  return (
    <div className="p-8">
      <header className="mb-8">
        <Link
          href="/schedules"
          className="font-heading text-btn uppercase tracking-[1px] text-sapphire hover:underline"
        >
          ← All schedules
        </Link>
        <p className="mt-4 font-heading text-h5 uppercase tracking-[1px] text-maroon">Schedule</p>
        <h1 className="mt-1 text-h3 font-black text-paua">{schedule.name}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">Details</h2>
          <form action={updateScheduleForm} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={schedule.id} />
            <div className="md:col-span-2">
              <label className={LABEL} htmlFor="name">Name</label>
              <input id="name" name="name" required className={INPUT} defaultValue={schedule.name} />
            </div>
            <div>
              <label className={LABEL} htmlFor="priority">Priority</label>
              <input
                id="priority"
                name="priority"
                type="number"
                defaultValue={schedule.priority}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="timezone">Time zone</label>
              <input
                id="timezone"
                name="timezone"
                defaultValue={schedule.timezone}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="start_date">Start date</label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={schedule.start_date ?? ""}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="end_date">End date</label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={schedule.end_date ?? ""}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="start_time">Start time</label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                defaultValue={schedule.start_time ?? ""}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="end_time">End time</label>
              <input
                id="end_time"
                name="end_time"
                type="time"
                defaultValue={schedule.end_time ?? ""}
                className={INPUT}
              />
            </div>
            <fieldset className="md:col-span-2">
              <legend className={LABEL}>Days of week</legend>
              <div className="mt-2 flex flex-wrap gap-3 text-body text-ink">
                {DAY_LABELS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name={`dow_${i}`}
                      defaultChecked={checkedDays.has(i)}
                    />{" "}
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="md:col-span-2">
              <button type="submit" className={BTN_PRIMARY}>Save schedule</button>
            </div>
          </form>

          <form action={deleteScheduleForm} className="mt-8 border-t border-ink/10 pt-6">
            <input type="hidden" name="id" value={schedule.id} />
            <button type="submit" className={BTN_DANGER}>Delete schedule</button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">Targets</h2>
            {targets.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No targets yet. Add one below.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {targets.map((t) => {
                  const label = t.device_id
                    ? `Device · ${deviceById.get(t.device_id) ?? t.device_id}`
                    : t.location_id
                      ? `Location · ${locationById.get(t.location_id) ?? t.location_id}`
                      : "Unknown target";
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded border border-ink/10 px-3 py-2"
                    >
                      <span className="text-sm text-paua">{label}</span>
                      <form action={removeTargetForm}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className={BTN_DANGER}>Remove</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <form action={addTargetForm} className="mt-4 space-y-3">
              <input type="hidden" name="schedule_id" value={schedule.id} />
              <div>
                <label className={LABEL} htmlFor="target_kind">Target type</label>
                <select id="target_kind" name="target_kind" className={INPUT}>
                  <option value="device">Device</option>
                  <option value="location">Location</option>
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="target_value">Select</label>
                <select id="target_value" name="target_value" className={INPUT}>
                  <optgroup label="Devices">
                    {devices.map((d) => (
                      <option key={`d-${d.id}`} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Locations">
                    {locations.map((l) => (
                      <option key={`l-${l.id}`} value={l.id}>{l.name}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-ink/50">
                  Pick the matching kind above, then the entity here.
                </p>
              </div>
              <button type="submit" className={BTN_SECONDARY}>Add target</button>
            </form>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">Playlists</h2>
            {playlistRows.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No playlists attached.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {playlistRows.map((p, idx) => (
                  <li
                    key={p.playlist_id}
                    className="flex items-center justify-between rounded border border-ink/10 px-3 py-2"
                  >
                    <span className="text-sm text-paua">
                      {idx + 1}. {playlistById.get(p.playlist_id) ?? p.playlist_id}
                    </span>
                    <form action={removePlaylistForm}>
                      <input type="hidden" name="schedule_id" value={schedule.id} />
                      <input type="hidden" name="playlist_id" value={p.playlist_id} />
                      <button type="submit" className={BTN_DANGER}>Remove</button>
                    </form>
                  </li>
                ))}
              </ol>
            )}

            {availablePlaylists.length > 0 && (
              <form action={addPlaylistForm} className="mt-4 space-y-3">
                <input type="hidden" name="schedule_id" value={schedule.id} />
                <div>
                  <label className={LABEL} htmlFor="playlist_id">Add playlist</label>
                  <select id="playlist_id" name="playlist_id" className={INPUT}>
                    {availablePlaylists.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className={BTN_SECONDARY}>Attach playlist</button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
