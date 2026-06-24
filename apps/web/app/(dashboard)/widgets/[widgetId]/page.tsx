import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/rbac";
import { updateWidgetForm, deleteWidgetForm } from "../actions";
import {
  weatherConfigSchema,
  newsConfigSchema,
  type WeatherConfig,
  type NewsConfig,
} from "@drip-tv/shared";

const LABEL = "block font-heading text-h5 uppercase tracking-[1px] text-paua";
const INPUT =
  "mt-1 block w-full rounded border border-ink/15 bg-white px-3 py-2 text-body text-ink focus:border-sapphire focus:outline-none";
const BTN_PRIMARY =
  "rounded bg-sapphire px-4 py-2 font-heading text-btn uppercase tracking-[1px] text-white hover:bg-sapphire/90";
const BTN_DANGER =
  "rounded border border-maroon/40 px-3 py-2 font-heading text-btn uppercase tracking-[1px] text-maroon hover:bg-maroon hover:text-white";

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
    type: "weather" | "news";
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {widget.type === "weather" ? (
            <WeatherForm id={widget.id} name={widget.name} config={widget.config} />
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
