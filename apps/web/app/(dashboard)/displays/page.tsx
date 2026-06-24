import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { createDisplay } from "./actions";

type DisplayRow = {
  id: string;
  name: string;
  aspect_ratio: "16:9" | "9:16";
  updated_at: string;
};

export default async function DisplaysPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};

  const { data, error } = await supabase
    .from("displays")
    .select("id, name, aspect_ratio, updated_at")
    .order("updated_at", { ascending: false });

  const displays: DisplayRow[] = (data ?? []) as DisplayRow[];

  return (
    <div className="p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Displays</p>
          <h1 className="mt-1 text-h3 font-black text-paua">Compose the screen, zone by zone</h1>
        </div>
        <form action={createDisplay}>
          <button
            type="submit"
            className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua"
          >
            New display
          </button>
        </form>
      </header>

      {params.error ? (
        <p className="mb-4 rounded bg-maroon/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-maroon">
          {params.error}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded bg-maroon/10 px-4 py-2 font-heading text-sm uppercase tracking-[1px] text-maroon">
          {error.message}
        </p>
      ) : null}

      {displays.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-ink/60">
            No displays yet
          </p>
          <p className="mt-2 text-body text-ink/60">
            Click &ldquo;New display&rdquo; to build your first layout.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displays.map((d) => (
            <li key={d.id}>
              <Link
                href={`/displays/${d.id}/edit`}
                className="block rounded-lg bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <p className="font-heading text-h5 uppercase tracking-[1px] text-paua">
                  {d.name}
                </p>
                <p className="mt-2 text-body text-ink/60">{d.aspect_ratio}</p>
                <p className="mt-3 font-heading text-xs uppercase tracking-[1px] text-ink/40">
                  Edited {new Date(d.updated_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
