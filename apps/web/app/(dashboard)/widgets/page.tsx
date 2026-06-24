import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { createWeatherWidgetForm, createNewsWidgetForm } from "./actions";
import {
  weatherConfigSchema,
  newsConfigSchema,
  type WeatherConfig,
  type NewsConfig,
} from "@drip-tv/shared";

type WidgetRow = {
  id: string;
  name: string;
  type: "weather" | "news";
  config: unknown;
  updated_at: string | null;
};

function summarize(row: WidgetRow): string {
  if (row.type === "weather") {
    const parsed = weatherConfigSchema.safeParse(row.config);
    if (!parsed.success) return "Invalid config";
    const c: WeatherConfig = parsed.data;
    const loc = c.zip ? `ZIP ${c.zip} (${c.country})` : "lat/lon";
    return `${loc} · ${c.units === "metric" ? "°C" : "°F"}${c.showForecast ? " · forecast" : ""}`;
  }
  const parsed = newsConfigSchema.safeParse(row.config);
  if (!parsed.success) return "Invalid config";
  const c: NewsConfig = parsed.data;
  const kw = c.keywords.length > 0 ? ` · "${c.keywords.join(", ")}"` : "";
  return `${c.country.toUpperCase()} · ${c.category} · top ${c.max}${kw}`;
}

const LABEL = "block font-heading text-h5 uppercase tracking-[1px] text-paua";
const INPUT =
  "mt-1 block w-full rounded border border-ink/15 bg-white px-3 py-2 text-body text-ink focus:border-sapphire focus:outline-none";
const BTN_PRIMARY =
  "rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-sapphire/90";
const BTN_SECONDARY =
  "rounded border border-ink/15 bg-white px-3 py-1.5 font-heading text-btn uppercase tracking-[1px] text-paua hover:border-sapphire hover:text-sapphire";

export default async function WidgetsPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: widgets } = await supabase
    .from("widgets")
    .select("id, name, type, config, updated_at")
    .order("updated_at", { ascending: false });

  const rows = (widgets ?? []) as WidgetRow[];

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Widgets</p>
        <h1 className="mt-1 text-h3 font-black text-paua">Weather and news cards</h1>
        <p className="mt-2 max-w-2xl text-body text-ink/70">
          Drop these into a display to show live conditions or rotating headlines.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">New weather widget</h2>
          <form action={createWeatherWidgetForm} className="mt-4 space-y-4">
            <div>
              <label className={LABEL} htmlFor="w-name">Name</label>
              <input id="w-name" name="name" required className={INPUT} defaultValue="Storefront weather" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="w-zip">ZIP</label>
                <input id="w-zip" name="zip" className={INPUT} placeholder="10001" />
              </div>
              <div>
                <label className={LABEL} htmlFor="w-country">Country</label>
                <input id="w-country" name="country" className={INPUT} defaultValue="US" maxLength={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="w-units">Units</label>
                <select id="w-units" name="units" className={INPUT} defaultValue="imperial">
                  <option value="imperial">Fahrenheit</option>
                  <option value="metric">Celsius</option>
                </select>
              </div>
              <label className="flex items-end gap-2 pb-2 text-body text-ink">
                <input type="checkbox" name="showForecast" defaultChecked /> Show 5-day forecast
              </label>
            </div>
            <button type="submit" className={BTN_PRIMARY}>Create weather widget</button>
          </form>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">New news widget</h2>
          <form action={createNewsWidgetForm} className="mt-4 space-y-4">
            <div>
              <label className={LABEL} htmlFor="n-name">Name</label>
              <input id="n-name" name="name" required className={INPUT} defaultValue="Top headlines" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="n-country">Country</label>
                <input id="n-country" name="country" className={INPUT} defaultValue="us" maxLength={2} />
              </div>
              <div>
                <label className={LABEL} htmlFor="n-category">Category</label>
                <select id="n-category" name="category" className={INPUT} defaultValue="general">
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
              <label className={LABEL} htmlFor="n-keywords">Keywords (comma-separated)</label>
              <input id="n-keywords" name="keywords" className={INPUT} placeholder="coffee, espresso" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL} htmlFor="n-max">Max headlines</label>
                <input id="n-max" name="max" type="number" min={1} max={20} className={INPUT} defaultValue={5} />
              </div>
              <div>
                <label className={LABEL} htmlFor="n-rotate">Rotation (sec)</label>
                <input id="n-rotate" name="rotateSec" type="number" min={1} className={INPUT} defaultValue={8} />
              </div>
            </div>
            <button type="submit" className={BTN_PRIMARY}>Create news widget</button>
          </form>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-h4 uppercase tracking-[1px] text-paua">Your widgets</h2>
        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white p-6 text-body text-ink/60 shadow-sm">
            No widgets yet. Create one above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-heading text-btn uppercase tracking-[1px] text-maroon">
                    {w.type}
                  </p>
                  <p className="mt-0.5 text-body font-medium text-paua">{w.name}</p>
                  <p className="mt-0.5 text-sm text-ink/60">{summarize(w)}</p>
                </div>
                <Link href={`/widgets/${w.id}`} className={BTN_SECONDARY}>
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
