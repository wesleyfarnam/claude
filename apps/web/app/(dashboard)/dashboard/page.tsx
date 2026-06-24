import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardOverview() {
  const supabase = await createSupabaseServerClient();

  const [
    { count: locCount },
    { count: devCount },
    { count: mediaCount },
    { count: displayCount },
  ] = await Promise.all([
    supabase.from("locations").select("*", { count: "exact", head: true }),
    supabase.from("devices").select("*", { count: "exact", head: true }),
    supabase.from("media_assets").select("*", { count: "exact", head: true }).eq("status", "ready"),
    supabase.from("displays").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Locations", value: locCount ?? 0 },
    { label: "Devices", value: devCount ?? 0 },
    { label: "Media assets", value: mediaCount ?? 0 },
    { label: "Displays", value: displayCount ?? 0 },
  ];

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Overview</p>
        <h1 className="mt-1 text-h3 font-black text-paua">Your signage fleet at a glance</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-6 shadow-sm">
            <p className="font-heading text-h5 uppercase tracking-[1px] text-ink/60">{s.label}</p>
            <p className="mt-2 font-display text-5xl font-black text-sapphire">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-lg bg-white p-8 shadow-sm">
        <h2 className="font-heading text-h2 uppercase tracking-[1.25px] text-paua">
          Welcome to Drip TV
        </h2>
        <p className="mt-3 max-w-2xl text-body text-ink/70">
          You&rsquo;re on the M1 scaffold. Up next: invite your team, then we build the
          media library (M2) and Vega player + pairing (M3).
        </p>
      </section>
    </div>
  );
}
