import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import {
  addManagerForm,
  removeManagerForm,
  updateLocationForm,
} from "../actions";
import { DeleteLocationButton } from "./DeleteLocationButton";

export const dynamic = "force-dynamic";

type LocationDetail = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  org_id: string;
};

type ManagerUser = { email: string; display_name: string | null };

type ManagerRow = {
  user_id: string;
  granted_at: string;
  users: ManagerUser | ManagerUser[] | null;
};

type DeviceRow = {
  id: string;
  name: string;
  status: string;
};

function pickUser(u: ManagerRow["users"]): ManagerUser | null {
  if (!u) return null;
  if (Array.isArray(u)) return u[0] ?? null;
  return u;
}

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams?: Promise<{
    error?: string;
    updated?: string;
    added?: string;
  }>;
}) {
  const { locationId } = await params;
  const search = (await searchParams) ?? {};
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: locData, error: locErr } = await supabase
    .from("locations")
    .select("id, name, address, timezone, org_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !locData) {
    notFound();
  }
  const location = locData as LocationDetail;

  const [managersRes, devicesRes] = await Promise.all([
    supabase
      .from("location_managers")
      .select("user_id, granted_at, users(email, display_name)")
      .eq("location_id", locationId)
      .order("granted_at", { ascending: true }),
    supabase
      .from("devices")
      .select("id, name, status")
      .eq("location_id", locationId)
      .order("name", { ascending: true }),
  ]);

  const managers = (managersRes.data ?? []) as ManagerRow[];
  const devices = (devicesRes.data ?? []) as DeviceRow[];

  return (
    <div className="p-8">
      <header className="mb-6">
        <Link
          href="/locations"
          className="font-heading text-xs uppercase tracking-[1px] text-ink/50 hover:text-paua"
        >
          {"<-"} All locations
        </Link>
        <div className="mt-3">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
            Location
          </p>
          <h1 className="mt-1 text-h3 font-black text-paua">{location.name}</h1>
          <p className="mt-2 text-body text-ink/70">
            {location.address ? (
              location.address
            ) : (
              <span className="italic text-ink/40">No address on file</span>
            )}
            <span className="mx-2 text-ink/30">•</span>
            <span className="font-mono text-sm">{location.timezone}</span>
          </p>
        </div>
      </header>

      {search.error ? (
        <p className="mb-4 rounded bg-maroon/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-maroon">
          {search.error}
        </p>
      ) : null}
      {search.updated ? (
        <p className="mb-4 rounded bg-sapphire/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-sapphire">
          Location updated
        </p>
      ) : null}
      {search.added ? (
        <p className="mb-4 rounded bg-sapphire/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-sapphire">
          Manager added
        </p>
      ) : null}

      {/* Managers */}
      <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <p className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Managers
        </p>
        <h2 className="mt-1 text-h5 font-black uppercase text-paua">
          Who can run this location
        </h2>

        {managers.length === 0 ? (
          <p className="mt-4 text-body text-ink/60">
            No managers assigned yet. Add someone by email below.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/5">
            {managers.map((m) => {
              const u = pickUser(m.users);
              const email = u?.email ?? "(unknown user)";
              const name = u?.display_name;
              return (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="font-semibold text-paua">{email}</p>
                    {name ? (
                      <p className="text-sm text-ink/60">{name}</p>
                    ) : null}
                  </div>
                  <form action={removeManagerForm}>
                    <input
                      type="hidden"
                      name="location_id"
                      value={locationId}
                    />
                    <input
                      type="hidden"
                      name="user_id"
                      value={m.user_id}
                    />
                    <button
                      type="submit"
                      className="rounded border border-maroon/40 px-3 py-1.5 font-heading text-xs uppercase tracking-[1px] text-maroon hover:bg-maroon hover:text-white"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <form
          action={addManagerForm}
          className="mt-6 flex flex-col gap-3 border-t border-ink/5 pt-6 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="location_id" value={locationId} />
          <div className="flex-1">
            <label
              htmlFor="add-manager-email"
              className="block font-heading text-xs uppercase tracking-[1px] text-ink/50"
            >
              Add manager by email
            </label>
            <input
              id="add-manager-email"
              name="email"
              type="email"
              required
              placeholder="teammate@example.com"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-2.5 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-sapphire px-5 py-2.5 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
          >
            Add manager
          </button>
        </form>
        <p className="mt-2 text-xs text-ink/50">
          The person must already have a Drip TV account. Invites are coming
          later.
        </p>
      </section>

      {/* Devices */}
      <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <p className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Devices
        </p>
        <h2 className="mt-1 text-h5 font-black uppercase text-paua">
          Signage Sticks here
        </h2>

        {devices.length === 0 ? (
          <p className="mt-4 text-body text-ink/60">
            No devices assigned to this location.{" "}
            <Link
              href="/devices"
              className="font-heading text-sm uppercase tracking-[1px] text-sapphire hover:text-sapphire/80"
            >
              Manage devices
            </Link>
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink/5">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="font-semibold text-paua">{d.name}</p>
                  <p className="text-sm text-ink/60">Status: {d.status}</p>
                </div>
                <Link
                  href={`/devices/${d.id}`}
                  className="font-heading text-sm uppercase tracking-[1px] text-sapphire hover:text-sapphire/80"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Update details */}
      <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
        <p className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Update details
        </p>
        <h2 className="mt-1 text-h5 font-black uppercase text-paua">
          Edit name, address, timezone
        </h2>

        <form
          action={updateLocationForm}
          className="mt-4 max-w-xl space-y-4"
        >
          <input type="hidden" name="id" value={locationId} />
          <div>
            <label
              htmlFor="upd-name"
              className="block font-heading text-xs uppercase tracking-[1px] text-ink/50"
            >
              Name
            </label>
            <input
              id="upd-name"
              name="name"
              type="text"
              required
              maxLength={120}
              defaultValue={location.name}
              className="mt-2 w-full rounded border border-ink/15 px-4 py-2.5 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>
          <div>
            <label
              htmlFor="upd-address"
              className="block font-heading text-xs uppercase tracking-[1px] text-ink/50"
            >
              Address
            </label>
            <input
              id="upd-address"
              name="address"
              type="text"
              defaultValue={location.address ?? ""}
              placeholder="Optional"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-2.5 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>
          <div>
            <label
              htmlFor="upd-timezone"
              className="block font-heading text-xs uppercase tracking-[1px] text-ink/50"
            >
              Timezone
            </label>
            <input
              id="upd-timezone"
              name="timezone"
              type="text"
              defaultValue={location.timezone}
              className="mt-2 w-full rounded border border-ink/15 px-4 py-2.5 font-mono text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>
          <div>
            <button
              type="submit"
              className="rounded bg-sapphire px-5 py-2.5 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section className="rounded-lg border border-maroon/30 bg-maroon/5 p-6">
        <p className="font-heading text-sm uppercase tracking-[1px] text-maroon">
          Danger zone
        </p>
        <h2 className="mt-1 text-h5 font-black uppercase text-paua">
          Delete this location
        </h2>
        <p className="mt-2 max-w-xl text-body text-ink/70">
          Devices tied to this location will be unlinked (not deleted).
          Manager assignments will be removed. Schedules targeting this
          location will lose their target.
        </p>
        <div className="mt-4">
          <DeleteLocationButton locationId={locationId} />
        </div>
      </section>
    </div>
  );
}
