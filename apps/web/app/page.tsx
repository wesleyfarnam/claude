import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-athens text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo className="text-3xl" />
        <nav className="flex items-center gap-6 font-heading text-btn uppercase tracking-wide">
          <Link href="/login" className="text-ink/70 hover:text-sapphire">Sign in</Link>
          <Link href="/signup" className="rounded bg-sapphire px-5 py-2 text-white transition hover:bg-paua">Get started</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Retail digital signage</p>
        <h1 className="mt-3 font-display text-6xl font-black leading-none tracking-tight text-paua md:text-[88px]">
          Every screen, every store,<br />one dashboard.
        </h1>
        <p className="mt-6 max-w-2xl text-body text-ink/80">
          Drip TV drives Amazon Signage Sticks across every location you operate.
          Upload images and video, compose displays with weather and headlines,
          schedule playlists by daypart, and remote-manage every TV — all from one place.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/signup" className="rounded bg-sapphire px-8 py-4 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua">Start free trial</Link>
          <Link href="/login" className="rounded border-2 border-sapphire px-8 py-4 font-heading text-btn uppercase tracking-[1px] text-sapphire transition hover:bg-sapphire hover:text-white">Sign in</Link>
        </div>
      </section>

      <section className="bg-paua text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-3">
          <FeatureCard eyebrow="Remote management" title="Reboot, refresh, snapshot" body="Amazon Signage Remote Management API integration lets you reboot a stick, force a refresh, or grab a screenshot without leaving the dashboard." />
          <FeatureCard eyebrow="Drag-and-drop builder" title="Zones that make sense" body="Percentage-based layout editor. Compose media, weather, news tickers and clocks into any display. One schema renders perfectly on every stick." />
          <FeatureCard eyebrow="Role-based access" title="Admins see all. Managers see theirs." body="Corporate admins manage every location. Local managers only see their own stores. Row-level security enforced at the database." />
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-ink/60">
        <div className="flex items-center justify-between">
          <Logo />
          <span>&copy; {new Date().getFullYear()} Drip TV.</span>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-heading text-h5 uppercase tracking-[1px] text-aqua">{eyebrow}</p>
      <h3 className="mt-2 font-sans text-h3 font-black">{title}</h3>
      <p className="mt-3 text-body text-white/70">{body}</p>
    </div>
  );
}
