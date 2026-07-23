import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { updateWidgetForm, deleteWidgetForm } from "../actions";
import {
  weatherConfigSchema,
  newsConfigSchema,
  sportsConfigSchema,
  type WeatherConfig,
  type NewsConfig,
  type SportsConfig,
  type WeatherPayload,
  type NewsPayload,
  type SportsPayload,
} from "@drip-tv/shared";
import { fetchWeather } from "@/lib/widgets/weather";
import { fetchNews } from "@/lib/widgets/news";
import { fetchSports } from "@/lib/widgets/sports";

const LABEL = "block font-heading text-h5 uppercase tracking-[1px] text-paua";
const INPUT =
  "mt-1 block w-full rounded border border-ink/15 bg-white px-3 py-2 text-body text-ink focus:border-sapphire focus:outline-none";
const BTN_PRIMARY =
  "rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-sapphire/90";
const BTN_DANGER =
  "rounded border border-maroon/40 px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-maroon hover:bg-maroon hover:text-white";

type WidgetKind = "weather" | "news" | "sports";

export default async function WidgetEditPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  await requireUser();
  const { widgetId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("widgets")
    .select("id, name, type, config")
    .eq("id", widgetId)
    .maybeSingle();

  if (!data) notFound();
  const widget = data as {
    id: string;
    name: string;
    type: WidgetKind;
    config: unknown;
  };

  const previewUrl = `/api/widgets/${widget.type}?widgetId=${widget.id}`;

  return (
    <div className="p-8">
      <header className="mb-8">
        <Link
          href="/widgets"
          className="font-heading text-btn uppercase tracking-[1px] text-sapphire hover:underline"
        >
          ← All widgets
        </Link>
        <p className="mt-4 font-heading text-h5 uppercase tracking-[1px] text-maroon">
          {widget.type} widget
        </p>
        <h1 className="mt-1 text-h3 font-black text-paua">{widget.name}</h1>
      </header>

      <LivePreview type={widget.type} config={widget.config} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {widget.type === "weather" ? (
            <WeatherForm id={widget.id} name={widget.name} config={widget.config} />
          ) : widget.type === "sports" ? (
            <SportsForm id={widget.id} name={widget.name} config={widget.config} />
          ) : (
            <NewsForm id={widget.id} name={widget.name} config={widget.config} />
          )}

          <form action={deleteWidgetForm} className="mt-8 border-t border-ink/10 pt-6">
            <input type="hidden" name="id" value={widget.id} />
            <button type="submit" className={BTN_DANGER}>Delete widget</button>
          </form>
        </div>

        <aside className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="font-heading text-h5 uppercase tracking-[1px] text-paua">Player URL</h2>
          <p className="mt-2 text-sm text-ink/60">
            The player fetches this endpoint to render the widget.
          </p>
          <code className="mt-3 block break-all rounded bg-athens p-3 text-sm text-paua">
            {previewUrl}
          </code>
        </aside>
      </div>
    </div>
  );
}

// ── Live preview ─────────────────────────────────────────────────────

async function LivePreview({
  type,
  config,
}: {
  type: WidgetKind;
  config: unknown;
}) {
  if (type === "weather") return <WeatherPreview config={config} />;
  if (type === "news") return <NewsPreview config={config} />;
  return <SportsPreview config={config} />;
}

function PreviewShell({
  title,
  status,
  statusTone,
  diagnostic,
  children,
}: {
  title: string;
  status?: string;
  statusTone?: "ok" | "warn" | "err";
  diagnostic?: string | null;
  children: React.ReactNode;
}) {
  const tone =
    statusTone === "err"
      ? "text-maroon"
      : statusTone === "warn"
        ? "text-maroon/80"
        : "text-aqua";
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Live preview</p>
        {status ? (
          <p className={`font-heading text-btn uppercase tracking-[1px] ${tone}`}>{status}</p>
        ) : null}
      </div>
      <div className="mt-2 rounded-lg border-2 border-aqua bg-black p-6 text-white shadow-sm">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-aqua">{title}</p>
        {children}
      </div>
      {diagnostic ? (
        <p className="mt-2 rounded border border-maroon/50 bg-maroon/10 px-3 py-2 text-sm text-maroon">
          {diagnostic}
        </p>
      ) : null}
    </section>
  );
}

async function WeatherPreview({ config }: { config: unknown }) {
  const parsed = weatherConfigSchema.safeParse(config);
  const missingKey = !process.env.OPENWEATHER_API_KEY;
  if (!parsed.success) {
    return (
      <PreviewShell
        title="Weather"
        status="Config error"
        statusTone="err"
        diagnostic="Widget config failed validation."
      >
        <p className="mt-2 text-sm text-white/70">Fix the fields below and save to see live data.</p>
      </PreviewShell>
    );
  }
  const payload: WeatherPayload = await fetchWeather(parsed.data);
  const usingCelsius = parsed.data.units === "metric";
  const temp = usingCelsius ? payload.tempC : payload.tempF;
  const unit = usingCelsius ? "°C" : "°F";
  const stale = payload.tempF === 0 && payload.tempC === 0 && payload.icon === "01d";
  return (
    <PreviewShell
      title={payload.location || "Weather"}
      status={stale ? "Stubbed" : "Live"}
      statusTone={stale ? "warn" : "ok"}
      diagnostic={
        missingKey ? "OPENWEATHER_API_KEY not set on this deploy" : null
      }
    >
      <div className="mt-3 flex items-center gap-4">
        <img
          src={`https://openweathermap.org/img/wn/${payload.icon}@2x.png`}
          alt=""
          className="h-16 w-16"
        />
        <div>
          <p className="text-4xl font-black">
            {temp}
            {unit}
          </p>
          <p className="text-sm capitalize text-white/70">{payload.condition}</p>
        </div>
      </div>
      {payload.forecast.length > 0 ? (
        <div className="mt-4 grid grid-cols-5 gap-2 border-t border-white/10 pt-3">
          {payload.forecast.map((d) => (
            <div key={d.day} className="text-center">
              <p className="font-heading text-xs uppercase tracking-[1px] text-aqua">{d.day}</p>
              <img
                src={`https://openweathermap.org/img/wn/${d.icon}.png`}
                alt=""
                className="mx-auto h-8 w-8"
              />
              <p className="text-xs text-white">
                <span className="font-bold">{d.hi}°</span>
                <span className="text-white/50"> / {d.lo}°</span>
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-4 text-[10px] uppercase tracking-[1px] text-white/40">
        Fetched {new Date(payload.fetched_at).toLocaleTimeString()}
      </p>
    </PreviewShell>
  );
}

async function NewsPreview({ config }: { config: unknown }) {
  const parsed = newsConfigSchema.safeParse(config);
  const missingKey = !process.env.NEWSAPI_KEY;
  if (!parsed.success) {
    return (
      <PreviewShell
        title="News"
        status="Config error"
        statusTone="err"
        diagnostic="Widget config failed validation."
      >
        <p className="mt-2 text-sm text-white/70">Fix the fields below and save to see live data.</p>
      </PreviewShell>
    );
  }
  const payload: NewsPayload = await fetchNews(parsed.data);
  const looksStubbed =
    payload.headlines.length === 1 &&
    payload.headlines[0]?.source === "Drip TV";
  return (
    <PreviewShell
      title={`Top headlines · ${parsed.data.country.toUpperCase()} · ${parsed.data.category}`}
      status={looksStubbed ? "Stubbed" : "Live"}
      statusTone={looksStubbed ? "warn" : "ok"}
      diagnostic={missingKey ? "NEWSAPI_KEY not set on this deploy" : null}
    >
      <ul className="mt-3 space-y-2">
        {payload.headlines.map((h, i) => (
          <li key={`${i}-${h.title}`} className="border-b border-white/10 pb-2 last:border-b-0">
            <p className="text-sm font-medium text-white">{h.title}</p>
            <p className="text-[10px] uppercase tracking-[1px] text-aqua">
              {h.source}
              <span className="text-white/40">
                {" · "}
                {new Date(h.published_at).toLocaleString()}
              </span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[10px] uppercase tracking-[1px] text-white/40">
        Fetched {new Date(payload.fetched_at).toLocaleTimeString()}
      </p>
    </PreviewShell>
  );
}

async function SportsPreview({ config }: { config: unknown }) {
  const parsed = sportsConfigSchema.safeParse(config);
  if (!parsed.success) {
    return (
      <PreviewShell
        title="Sports"
        status="Config error"
        statusTone="err"
        diagnostic="Set a league name to see live scores."
      >
        <p className="mt-2 text-sm text-white/70">Fix the fields below and save to see live data.</p>
      </PreviewShell>
    );
  }
  const payload: SportsPayload = await fetchSports(parsed.data);
  const hasEvents = payload.events.length > 0;
  const status = payload.warning ? "No data" : hasEvents ? "Live" : "Empty";
  const statusTone: "ok" | "warn" | "err" =
    payload.warning ? "warn" : hasEvents ? "ok" : "warn";
  const heading = payload.team
    ? `${payload.league} · ${payload.team}`
    : `${payload.league} · recent results`;
  return (
    <PreviewShell
      title={heading}
      status={status}
      statusTone={statusTone}
      diagnostic={payload.warning ?? null}
    >
      {hasEvents ? (
        <ul className="mt-3 space-y-2">
          {payload.events.map((ev) => {
            const isFinal = ev.status === "final";
            const scoreLine = isFinal && ev.homeScore !== null && ev.awayScore !== null
              ? `${ev.homeScore} – ${ev.awayScore}`
              : "vs";
            return (
              <li key={ev.id} className="border-b border-white/10 pb-2 last:border-b-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{ev.home}</span>
                  <span className="mx-3 font-heading uppercase tracking-[1px] text-aqua">
                    {scoreLine}
                  </span>
                  <span className="font-medium text-white">{ev.away}</span>
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-[1px] text-white/50">
                  {new Date(ev.date).toLocaleString()}
                  {" · "}
                  {isFinal ? "Final" : "Scheduled"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-white/70">No events to show yet.</p>
      )}
      <p className="mt-4 text-[10px] uppercase tracking-[1px] text-white/40">
        Fetched {new Date(payload.fetched_at).toLocaleTimeString()}
        {" · "}
        Cached 30 min
      </p>
    </PreviewShell>
  );
}

// ── Config forms ─────────────────────────────────────────────────────

function WeatherForm({ id, name, config }: { id: string; name: string; config: unknown }) {
  const parsed = weatherConfigSchema.safeParse(config);
  const c: WeatherConfig = parsed.success
    ? parsed.data
    : weatherConfigSchema.parse({ kind: "weather" });
  return (
    <form action={updateWidgetForm} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value="weather" />
      <div>
        <label className={LABEL} htmlFor="name">Name</label>
        <input id="name" name="name" required className={INPUT} defaultValue={name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="zip">ZIP</label>
          <input id="zip" name="zip" className={INPUT} defaultValue={c.zip ?? ""} />
        </div>
        <div>
          <label className={LABEL} htmlFor="country">Country</label>
          <input id="country" name="country" className={INPUT} defaultValue={c.country} maxLength={2} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="units">Units</label>
          <select id="units" name="units" className={INPUT} defaultValue={c.units}>
            <option value="imperial">Fahrenheit</option>
            <option value="metric">Celsius</option>
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-body text-ink">
          <input type="checkbox" name="showForecast" defaultChecked={c.showForecast} /> 5-day forecast
        </label>
      </div>
      <button type="submit" className={BTN_PRIMARY}>Save</button>
    </form>
  );
}

function NewsForm({ id, name, config }: { id: string; name: string; config: unknown }) {
  const parsed = newsConfigSchema.safeParse(config);
  const c: NewsConfig = parsed.success
    ? parsed.data
    : newsConfigSchema.parse({ kind: "news" });
  return (
    <form action={updateWidgetForm} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value="news" />
      <div>
        <label className={LABEL} htmlFor="name">Name</label>
        <input id="name" name="name" required className={INPUT} defaultValue={name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="country">Country</label>
          <input id="country" name="country" className={INPUT} defaultValue={c.country} maxLength={2} />
        </div>
        <div>
          <label className={LABEL} htmlFor="category">Category</label>
          <select id="category" name="category" className={INPUT} defaultValue={c.category}>
            <option value="general">General</option>
            <option value="business">Business</option>
            <option value="health">Health</option>
            <option value="science">Science</option>
            <option value="sports">Sports</option>
            <option value="technology">Technology</option>
            <option value="entertainment">Entertainment</option>
          </select>
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="keywords">Keywords (comma-separated)</label>
        <input
          id="keywords"
          name="keywords"
          className={INPUT}
          defaultValue={c.keywords.join(", ")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL} htmlFor="max">Max headlines</label>
          <input
            id="max"
            name="max"
            type="number"
            min={1}
            max={20}
            className={INPUT}
            defaultValue={c.max}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="rotateSec">Rotation (sec)</label>
          <input
            id="rotateSec"
            name="rotateSec"
            type="number"
            min={1}
            className={INPUT}
            defaultValue={c.rotateSec}
          />
        </div>
      </div>
      <button type="submit" className={BTN_PRIMARY}>Save</button>
    </form>
  );
}

function SportsForm({ id, name, config }: { id: string; name: string; config: unknown }) {
  const parsed = sportsConfigSchema.safeParse(config);
  const c: SportsConfig = parsed.success
    ? parsed.data
    : { kind: "sports", league: "", team: undefined, units: "imperial" };
  return (
    <form action={updateWidgetForm} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value="sports" />
      <div>
        <label className={LABEL} htmlFor="name">Name</label>
        <input id="name" name="name" required className={INPUT} defaultValue={name} />
      </div>
      <div>
        <label className={LABEL} htmlFor="league">League</label>
        <input
          id="league"
          name="league"
          required
          className={INPUT}
          defaultValue={c.league}
          placeholder="English Premier League"
        />
        <p className="mt-1 text-xs text-ink/60">
          Full league name as listed by TheSportsDB (e.g. &quot;NBA&quot;, &quot;NFL&quot;, &quot;English Premier League&quot;).
        </p>
      </div>
      <div>
        <label className={LABEL} htmlFor="team">Team (optional)</label>
        <input
          id="team"
          name="team"
          className={INPUT}
          defaultValue={c.team ?? ""}
          placeholder="Arsenal"
        />
        <p className="mt-1 text-xs text-ink/60">
          Leave blank for recent league results, or specify a team for their next fixtures.
        </p>
      </div>
      <div>
        <label className={LABEL} htmlFor="units">Units</label>
        <select id="units" name="units" className={INPUT} defaultValue={c.units}>
          <option value="imperial">Imperial</option>
          <option value="metric">Metric</option>
        </select>
      </div>
      <button type="submit" className={BTN_PRIMARY}>Save</button>
    </form>
  );
}
