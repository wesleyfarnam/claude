import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatusDot } from "@/components/devices/StatusDot";

export const dynamic = "force-dynamic";

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
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function DevicesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: devices, error } = await supabase
    .from("devices")
    .select(
      "id, name, status, last_seen_at, location_id, locations(name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-8">
        <p className="rounded bg-maroon/10 p-4 font-heading text-maroon">
          Could not load devices: {error.message}
        </p>
      </div>
    );
  }

  const rows = devices ?? [];

  return (
    <div className="p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            Devices
          </p>
          <h1 className="mt-1 text-h3 font-black text-paua">
            Every Signage Stick, live
          </h1>
        </div>
        <Link
          href="/devices/pair"
          className="rounded bg-sapphire px-5 py-2.5 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
        >
          Pair a device
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            No devices yet
          </p>
          <h2 className="mt-2 text-h3 font-black text-paua">
            Pair your first Signage Stick
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body text-ink/70">
            Boot the Drip TV player on your stick, take the 6-character code it
            displays, and enter it on the pairing screen.
          </p>
          <Link
            href="/devices/pair"
            className="mt-6 inline-block rounded bg-sapphire px-6 py-3 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
          >
            Pair a device
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-ink/10 bg-athens">
              <tr className="text-left">
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Name
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Location
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Status
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Last seen
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const loc = d.locations as { name?: string } | { name?: string }[] | null;
                const locName = Array.isArray(loc)
                  ? loc[0]?.name ?? "—"
                  : loc?.name ?? "—";
                return (
                  <tr key={d.id} className="border-b border-ink/5 last:border-b-0">
                    <td className="px-6 py-4 font-semibold text-paua">{d.name}</td>
                    <td className="px-6 py-4 text-ink/70">{locName}</td>
                    <td className="px-6 py-4">
                      <StatusDot status={d.status} />
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {formatRelative(d.last_seen_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/devices/${d.id}`}
                        className="font-heading text-sm uppercase tracking-[1px] text-sapphire hover:text-sapphire/80"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
