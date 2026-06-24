import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { createPlaylist } from "./actions";

type PlaylistRow = {
  id: string;
  name: string;
  loop: boolean;
  default_item_duration_sec: number;
  updated_at: string | null;
  created_at: string;
};

export default async function PlaylistsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};

  const { data, error } = await supabase
    .from("playlists")
    .select("id, name, loop, default_item_duration_sec, updated_at, created_at")
    .order("created_at", { ascending: false });

  const playlists: PlaylistRow[] = (data ?? []) as PlaylistRow[];

  return (
    <div className="p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Playlists</p>
          <h1 className="mt-1 text-h3 font-black text-paua">Sequence your content</h1>
        </div>
        <form action={createPlaylist} className="flex items-center gap-2">
          <input
            type="text"
            name="name"
            placeholder="New playlist name"
            className="rounded border border-athens bg-white px-3 py-2 text-body focus:border-sapphire focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua"
          >
            New playlist
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

      {playlists.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-ink/60">
            No playlists yet
          </p>
          <p className="mt-2 text-body text-ink/60">
            Name and create your first playlist to chain content together.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <li key={p.id}>
              <Link
                href={`/playlists/${p.id}`}
                className="block rounded-lg bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <p className="font-heading text-h5 uppercase tracking-[1px] text-paua">
                  {p.name}
                </p>
                <p className="mt-2 text-body text-ink/60">
                  {p.loop ? "Loops" : "Plays once"} - default {p.default_item_duration_sec}s
                </p>
                <p className="mt-3 font-heading text-xs uppercase tracking-[1px] text-ink/40">
                  Created {new Date(p.created_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
