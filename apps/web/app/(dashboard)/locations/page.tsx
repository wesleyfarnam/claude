import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  devices: { count: number }[];
  location_managers: { count: number }[];
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};

  const { data, error } = await supabase
    .from("locations")
    .select(
      "id, name, address, timezone, devices(count), location_managers(count)",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as LocationRow[];

  return (
    <div className="p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            Locations
          </p>
          <h1 className="mt-1 text-h3 font-black text-paua">
            Your retail footprint
          </h1>
        </div>
        <Link
          href="/locations/new"
          className="rounded bg-sapphire px-5 py-2.5 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
        >
          New location
        </Link>
      </header>

      {params.error ? (
        <p className="mb-4 rounded bg-maroon/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-maroon">
          {params.error}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded bg-maroon/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-maroon">
          Could not load locations: {error.message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            No locations yet
          </p>
          <h2 className="mt-2 text-h3 font-black text-paua">
            Add your first location
          </h2>
          <p className="mx-auto mt-3 max-w-md text-body text-ink/70">
            Locations group your Signage Sticks by store. Managers, devices,
            and schedules all attach to a location.
          </p>
          <Link
            href="/locations/new"
            className="mt-6 inline-block rounded bg-sapphire px-6 py-3 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
          >
            Add your first location
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
                  Address
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Timezone
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Devices
                </th>
                <th className="px-6 py-3 font-heading text-sm uppercase tracking-[1px] text-ink/60">
                  Managers
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const deviceCount = l.devices[0]?.count ?? 0;
                const managerCount = l.location_managers[0]?.count ?? 0;
                return (
                  <tr
                    key={l.id}
                    className="border-b border-ink/5 last:border-b-0"
                  >
                    <td className="px-6 py-4 font-semibold text-paua">
                      <Link
                        href={`/locations/${l.id}`}
                        className="hover:text-sapphire"
                      >
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {l.address ?? (
                        <span className="italic text-ink/40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-ink/70">
                      {l.timezone}
                    </td>
                    <td className="px-6 py-4 text-ink/70">{deviceCount}</td>
                    <td className="px-6 py-4 text-ink/70">{managerCount}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/locations/${l.id}`}
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
