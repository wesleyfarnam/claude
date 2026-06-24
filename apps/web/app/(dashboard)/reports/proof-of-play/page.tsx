import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  playbackSummary,
  playbackByDevice,
} from "@/lib/reports/queries";
import { humanizeDuration, formatDateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  device?: string;
}>;

/**
 * Default to a 7-day window ending today (UTC).
 */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function isIsoDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: string | undefined): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export default async function ProofOfPlayPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await requireUser();
  const params = await searchParams;
  const defaults = defaultRange();
  const from = isIsoDate(params.from) ? params.from : defaults.from;
  const to = isIsoDate(params.to) ? params.to : defaults.to;
  const deviceId = isUuid(params.device) ? params.device : undefined;

  const supabase = await createSupabaseServerClient();

  // Devices for the filter dropdown — RLS-scoped.
  const { data: devicesData } = await supabase
    .from("devices")
    .select("id, name, org_id")
    .order("name", { ascending: true });
  const devices = (devicesData ?? []) as Array<{
    id: string;
    name: string;
    org_id: string;
  }>;

  // Pick an org for the queries — RLS makes this advisory, but the
  // queries accept it for explicit scoping. Prefer the first device's
  // org so super-admins see something coherent.
  const firstDevice = devices[0];
  const orgId = firstDevice?.org_id ?? "";

  const summaryFilters: {
    orgId: string;
    from: string;
    to: string;
    deviceIds?: string[];
  } = { orgId, from, to };
  if (deviceId) summaryFilters.deviceIds = [deviceId];

  const deviceFilters: { orgId: string; from: string; to: string } = {
    orgId,
    from,
    to,
  };

  const [summary, byDevice] = await Promise.all([
    playbackSummary(summaryFilters),
    playbackByDevice(deviceFilters),
  ]);

  // Top-line aggregates from the (already device-filtered) summary.
  const totalPlays = summary.reduce((acc, r) => acc + r.plays, 0);
  const totalDurationMs = summary.reduce(
    (acc, r) => acc + r.total_duration_ms,
    0,
  );
  const uniqueDevices = (() => {
    if (deviceId) return totalPlays > 0 ? 1 : 0;
    // Sum of distinct devices across media rows isn't the right answer
    // — fall back to the count of devices in the per-device breakdown
    // that have plays in this range.
    return byDevice.filter((d) => d.plays > 0).length;
  })();

  const csvHref = (() => {
    const search = new URLSearchParams({ from, to });
    if (deviceId) search.set("device", deviceId);
    return `/api/reports/proof-of-play/csv?${search.toString()}`;
  })();

  return (
    <div className="p-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            Reports
          </p>
          <h1 className="mt-1 text-h3 font-black text-paua">Proof of play</h1>
          <p className="mt-2 text-body text-ink/70">
            {formatDateRange(from, to)}
            {user.email ? ` · ${user.email}` : ""}
          </p>
        </div>
        <Link
          href={csvHref}
          prefetch={false}
          className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-paua"
        >
          Export CSV
        </Link>
      </header>

      {/* Filter form */}
      <form
        method="get"
        className="mb-8 rounded-lg bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="font-heading text-h5 uppercase tracking-[1px] text-paua">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="mt-1 block w-full rounded border border-ink/20 px-3 py-2 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-heading text-h5 uppercase tracking-[1px] text-paua">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="mt-1 block w-full rounded border border-ink/20 px-3 py-2 text-body focus:border-sapphire focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="font-heading text-h5 uppercase tracking-[1px] text-paua">
              Device
            </span>
            <select
              name="device"
              defaultValue={deviceId ?? ""}
              className="mt-1 block w-full rounded border border-ink/20 px-3 py-2 text-body focus:border-sapphire focus:outline-none"
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-paua"
            >
              Apply
            </button>
          </div>
        </div>
      </form>

      {/* Summary cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total plays" value={totalPlays.toLocaleString()} />
        <StatCard
          label="Total duration"
          value={humanizeDuration(totalDurationMs)}
        />
        <StatCard
          label="Unique devices"
          value={uniqueDevices.toLocaleString()}
        />
      </section>

      {/* Per-media breakdown */}
      <section className="mb-8 rounded-lg bg-white shadow-sm">
        <header className="border-b border-ink/10 px-6 py-4">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            By media
          </p>
          <h2 className="mt-1 text-h4 font-black text-paua">
            Per-asset breakdown
          </h2>
        </header>
        {summary.length === 0 ? (
          <p className="px-6 py-8 text-body text-ink/60">
            No playback events in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-ink/10 text-ink/60">
                  <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px]">
                    Media
                  </th>
                  <th className="px-6 py-3 text-right font-heading text-sm uppercase tracking-[1px]">
                    Plays
                  </th>
                  <th className="px-6 py-3 text-right font-heading text-sm uppercase tracking-[1px]">
                    Total duration
                  </th>
                  <th className="px-6 py-3 text-right font-heading text-sm uppercase tracking-[1px]">
                    Devices
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr
                    key={row.media_id ?? "__null__"}
                    className="border-b border-ink/5 last:border-0"
                  >
                    <td className="px-6 py-3 text-paua">{row.media_name}</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {row.plays.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {humanizeDuration(row.total_duration_ms)}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {row.devices_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-device breakdown */}
      <section className="rounded-lg bg-white shadow-sm">
        <header className="border-b border-ink/10 px-6 py-4">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            By device
          </p>
          <h2 className="mt-1 text-h4 font-black text-paua">
            Per-stick breakdown
          </h2>
        </header>
        {byDevice.length === 0 ? (
          <p className="px-6 py-8 text-body text-ink/60">
            No device activity in this range.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-ink/10 text-ink/60">
                  <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px]">
                    Device
                  </th>
                  <th className="px-6 py-3 text-right font-heading text-sm uppercase tracking-[1px]">
                    Plays
                  </th>
                  <th className="px-6 py-3 text-right font-heading text-sm uppercase tracking-[1px]">
                    Total duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {byDevice.map((row) => (
                  <tr
                    key={row.device_id}
                    className="border-b border-ink/5 last:border-0"
                  >
                    <td className="px-6 py-3 text-paua">{row.device_name}</td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {row.plays.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums">
                      {humanizeDuration(row.total_duration_ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
        {label}
      </p>
      <p className="mt-2 text-h3 font-black text-paua tabular-nums">{value}</p>
    </div>
  );
}
