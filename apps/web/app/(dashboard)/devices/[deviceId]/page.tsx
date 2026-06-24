import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatusDot } from "@/components/devices/StatusDot";
import { CommandPanel } from "@/components/devices/CommandPanel";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "Unknown";
  const diff = Date.now() - ts;
  if (diff < 0) return "Just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

type HeartbeatRow = {
  ts: string;
  status: string;
  playing_playlist_id: string | null;
  playing_item_id: string | null;
};

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>;
}) {
  const { deviceId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: device, error } = await supabase
    .from("devices")
    .select(
      "id, name, status, last_seen_at, location_id, locations(name), amazon_device_id, firmware_version, player_version, registered_at, created_at",
    )
    .eq("id", deviceId)
    .single();

  if (error || !device) {
    notFound();
  }

  const { data: heartbeats } = await supabase
    .from("device_heartbeats")
    .select("ts, status, playing_playlist_id, playing_item_id")
    .eq("device_id", deviceId)
    .order("ts", { ascending: false })
    .limit(20);

  const locField = device.locations as
    | { name?: string }
    | { name?: string }[]
    | null;
  const locName = Array.isArray(locField)
    ? locField[0]?.name ?? "—"
    : locField?.name ?? "—";

  const meta: { label: string; value: string }[] = [
    { label: "Location", value: locName },
    { label: "Last seen", value: formatRelative(device.last_seen_at) },
    { label: "Registered", value: formatDateTime(device.registered_at) },
    { label: "Amazon device ID", value: device.amazon_device_id ?? "—" },
    { label: "Firmware", value: device.firmware_version ?? "—" },
    { label: "Player version", value: device.player_version ?? "—" },
  ];

  const rows: HeartbeatRow[] = (heartbeats as HeartbeatRow[] | null) ?? [];

  return (
    <div className="p-8">
      <header className="mb-8">
        <Link
          href="/devices"
          className="font-heading text-sm uppercase tracking-[1px] text-ink/60 hover:text-paua"
        >
          ← All devices
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
              Device
            </p>
            <h1 className="mt-1 text-h3 font-black text-paua">{device.name}</h1>
          </div>
          <StatusDot status={device.status} />
        </div>
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Details
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label}>
              <dt className="font-heading text-xs uppercase tracking-[1px] text-ink/50">
                {m.label}
              </dt>
              <dd className="mt-1 text-body text-paua">{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Remote control
        </h2>
        <div className="mt-4">
          <CommandPanel deviceId={device.id} />
        </div>
      </section>

      <section className="mt-8 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Recent activity
        </h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-body text-ink/60">
            No heartbeats yet. Once the stick checks in, you&rsquo;ll see them here.
          </p>
        ) : (
          <table className="mt-4 w-full">
            <thead className="border-b border-ink/10">
              <tr className="text-left">
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Timestamp
                </th>
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Status
                </th>
                <th className="py-2 font-heading text-xs uppercase tracking-[1px] text-ink/50">
                  Playing
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.ts} className="border-b border-ink/5 last:border-b-0">
                  <td className="py-2 text-sm text-ink/70">
                    {formatDateTime(h.ts)}
                  </td>
                  <td className="py-2 text-sm font-semibold text-paua">
                    {h.status}
                  </td>
                  <td className="py-2 font-mono text-xs text-ink/60">
                    {h.playing_item_id ?? h.playing_playlist_id ?? "—"}
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
