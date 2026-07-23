import Link from "next/link";
import { requireUser } from "@/lib/auth/rbac";
import { createLocation } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireUser();
  const params = (await searchParams) ?? {};

  return (
    <div className="p-8">
      <header className="mb-8">
        <Link
          href="/locations"
          className="font-heading text-xs uppercase tracking-[1px] text-ink/50 hover:text-paua"
        >
          {"<-"} All locations
        </Link>
        <p className="mt-3 font-heading text-h5 uppercase tracking-[1px] text-maroon">
          Locations
        </p>
        <h1 className="mt-1 text-h3 font-black text-paua">New location</h1>
      </header>

      <div className="mx-auto max-w-xl rounded-lg bg-white p-8 shadow-sm">
        <p className="text-body text-ink/70">
          Give this location a name and (optionally) an address. Timezone
          controls how schedules for its devices are interpreted.
        </p>

        {params.error ? (
          <p className="mt-6 rounded bg-maroon/10 px-4 py-3 text-sm text-maroon">
            {params.error}
          </p>
        ) : null}

        <form action={createLocation} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="Front Street Store"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              Address <span className="text-ink/40">(optional)</span>
            </label>
            <input
              id="address"
              name="address"
              type="text"
              placeholder="123 Main St, Brooklyn, NY"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>

          <div>
            <label
              htmlFor="postal_code"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              ZIP / Postal code <span className="text-ink/40">(optional)</span>
            </label>
            <input
              id="postal_code"
              name="postal_code"
              type="text"
              maxLength={16}
              placeholder="11201"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
            <p className="mt-2 text-xs text-ink/50">
              Used by weather zones on displays shown at this location.
            </p>
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              Timezone
            </label>
            <input
              id="timezone"
              name="timezone"
              type="text"
              defaultValue="America/New_York"
              placeholder="America/New_York"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 font-mono text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
            <p className="mt-2 text-xs text-ink/50">
              IANA timezone (e.g. America/New_York, Europe/London).
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/locations"
              className="font-heading text-sm uppercase tracking-[1px] text-ink/60 hover:text-paua"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded bg-sapphire px-6 py-3 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90"
            >
              Create location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
