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

  const locations = locCount ?? 0;
  const devices = devCount ?? 0;
  const media = mediaCount ?? 0;
  const displays = displayCount ?? 0;

  const stats = [
    { label: "Locations", value: locations },
    { label: "Devices", value: devices },
    { label: "Media assets", value: media },
    { label: "Displays", value: displays },
  ];

  // Surface the next useful action based on what the account has set up so far.
  const steps = [
    {
      done: media > 0,
      title: "Upload your media",
      body: "Add the images and videos you want to show on screen.",
      href: "/media",
      cta: "Go to Media",
    },
    {
      done: displays > 0,
      title: "Build a display",
      body: "Arrange media, weather, sports, and text into a multi-page display.",
      href: "/displays",
      cta: "Go to Displays",
    },
    {
      done: devices > 0,
      title: "Pair a screen",
      body: "Connect an Amazon Signage Stick and assign it a display.",
      href: "/devices/pair",
      cta: "Pair a device",
    },
  ];
  const nextStep = steps.find((s) => !s.done) ?? null;

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
        {nextStep ? (
          <>
            <p className="mt-3 max-w-2xl text-body text-ink/70">
              Get your screens live in three steps. Here&rsquo;s what to do next:
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((s) => {
                const isNext = s.title === nextStep.title;
                return (
                  <div
                    key={s.title}
                    className={`rounded-lg border p-5 ${
                      s.done
                        ? "border-aqua/40 bg-aqua/5"
                        : isNext
                          ? "border-sapphire bg-sapphire/5"
                          : "border-athens"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-black text-white ${
                          s.done ? "bg-aqua" : isNext ? "bg-sapphire" : "bg-ink/30"
                        }`}
                        aria-hidden="true"
                      >
                        {s.done ? "✓" : ""}
                      </span>
                      <p className="font-heading text-h5 uppercase tracking-[1px] text-paua">
                        {s.title}
                      </p>
                    </div>
                    <p className="mt-2 text-body text-ink/70">{s.body}</p>
                    {!s.done ? (
                      <a
                        href={s.href}
                        className="mt-3 inline-block font-heading text-btn uppercase tracking-[1px] text-sapphire hover:text-paua"
                      >
                        {s.cta} &rarr;
                      </a>
                    ) : (
                      <p className="mt-3 font-heading text-btn uppercase tracking-[1px] text-aqua">
                        Done
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-3 max-w-2xl text-body text-ink/70">
            You&rsquo;re all set up. Head to{" "}
            <a href="/displays" className="text-sapphire hover:text-paua">
              Displays
            </a>{" "}
            to keep your content fresh, or check{" "}
            <a href="/reports/proof-of-play" className="text-sapphire hover:text-paua">
              Reports
            </a>{" "}
            to see what&rsquo;s playing.
          </p>
        )}
      </section>
    </div>
  );
}
