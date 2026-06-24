import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { createScheduleForm } from "./actions";

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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function summarize(s: ScheduleRow): string {
  const parts: string[] = [];
  if (s.start_date || s.end_date) {
    parts.push(`${s.start_date ?? "—"} → ${s.end_date ?? "—"}`);
  }
  if (s.days_of_week && s.days_of_week.length > 0) {
    parts.push(
      s.days_of_week
        .slice()
        .sort()
        .map((d) => DAY_LABELS[d] ?? "?")
        .join(" "),
    );
  }
  if (s.start_time || s.end_time) {
    parts.push(`${s.start_time ?? "00:00"}–${s.end_time ?? "23:59"} ${s.timezone}`);
  }
  parts.push(`priority ${s.priority}`);
  return parts.join(" · ");
}

const LABEL = "block font-heading text-h5 uppercase tracking-[1px] text-paua";
const INPUT =
  "mt-1 block w-full rounded border border-ink/15 bg-white px-3 py-2 text-body text-ink focus:border-sapphire focus:outline-none";
const BTN_PRIMARY =
  "rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-sapphire/90";
const BTN_SECONDARY =
  "rounded border border-ink/15 bg-white px-3 py-1.5 font-heading text-btn uppercase tracking-[1px] text-paua hover:border-sapphire hover:text-sapphire";

export default async function SchedulesPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("schedules")
    .select(
      "id, name, priority, start_date, end_date, days_of_week, start_time, end_time, timezone",
    )
    .order("priority", { ascending: false })
    .order("name", { ascending: true });

  const rows = (data ?? []) as ScheduleRow[];

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Schedules</p>
        <h1 className="mt-1 text-h3 font-black text-paua">Right content, right time</h1>
        <p className="mt-2 max-w-2xl text-body text-ink/70">
          Day-parting, date ranges, per-location time zones, priority overrides. The server
          computes the currently-playing playlist for each device on demand.
        </p>
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">New schedule</h2>
        <form action={createScheduleForm} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={LABEL} htmlFor="s-name">Name</label>
            <input id="s-name" name="name" required className={INPUT} placeholder="Lunch promo" />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-priority">Priority</label>
            <input
              id="s-priority"
              name="priority"
              type="number"
              defaultValue={0}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-timezone">Time zone</label>
            <input
              id="s-timezone"
              name="timezone"
              defaultValue="America/New_York"
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-start-date">Start date</label>
            <input id="s-start-date" name="start_date" type="date" className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-end-date">End date</label>
            <input id="s-end-date" name="end_date" type="date" className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-start-time">Start time</label>
            <input id="s-start-time" name="start_time" type="time" className={INPUT} />
          </div>
          <div>
            <label className={LABEL} htmlFor="s-end-time">End time</label>
            <input id="s-end-time" name="end_time" type="time" className={INPUT} />
          </div>
          <fieldset className="md:col-span-2">
            <legend className={LABEL}>Days of week</legend>
            <div className="mt-2 flex flex-wrap gap-3 text-body text-ink">
              {DAY_LABELS.map((d, i) => (
                <label key={d} className="flex items-center gap-1.5">
                  <input type="checkbox" name={`dow_${i}`} /> {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <button type="submit" className={BTN_PRIMARY}>Create schedule</button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">All schedules</h2>
        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white p-6 text-body text-ink/60 shadow-sm">
            No schedules yet. Create one above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-heading text-btn uppercase tracking-[1px] text-maroon">
                    Schedule
                  </p>
                  <p className="mt-0.5 text-body font-medium text-paua">{s.name}</p>
                  <p className="mt-0.5 text-sm text-ink/60">{summarize(s)}</p>
                </div>
                <Link href={`/schedules/${s.id}`} className={BTN_SECONDARY}>
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
