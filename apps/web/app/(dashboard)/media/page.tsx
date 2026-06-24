import { requireUser } from "@/lib/auth/rbac";
import { MediaUploader } from "@/components/media/MediaUploader";
import { MediaCard, type MediaCardProps } from "@/components/media/MediaCard";
import { publicThumbUrl, signedReadUrl } from "@/lib/media/storage";

interface MediaRow {
  id: string;
  name: string;
  type: "image" | "video";
  status: "uploading" | "processing" | "ready" | "error";
  storage_path: string;
  thumb_path: string | null;
  duration_sec: number | string | null;
  width: number | null;
  height: number | null;
  bytes: number | string | null;
  created_at: string;
}

function toNumber(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function MediaPage() {
  const { supabase } = await requireUser();

  const { data: assets, error } = await supabase
    .from("media_assets")
    .select(
      "id, name, type, status, storage_path, thumb_path, duration_sec, width, height, bytes, created_at",
    )
    .order("created_at", { ascending: false })
    .returns<MediaRow[]>();

  if (error) {
    return (
      <div className="p-8">
        <header className="mb-8">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Media library</p>
          <h1 className="mt-1 text-h3 font-black text-paua">Couldn&rsquo;t load your media</h1>
        </header>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <p className="text-body text-maroon">{error.message}</p>
        </div>
      </div>
    );
  }

  const rows = assets ?? [];

  const cards: MediaCardProps[] = await Promise.all(
    rows.map(async (row): Promise<MediaCardProps> => {
      let thumbUrl: string | null = null;
      if (row.thumb_path) {
        thumbUrl = await publicThumbUrl(row.thumb_path);
      } else if (row.type === "image" && row.storage_path) {
        thumbUrl = await signedReadUrl(supabase, row.storage_path, 60 * 60);
      }
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        thumbUrl,
        durationSec: toNumber(row.duration_sec),
        width: row.width,
        height: row.height,
        bytes: toNumber(row.bytes),
      };
    }),
  );

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Media library</p>
        <h1 className="mt-1 text-h3 font-black text-paua">
          Images &amp; video, ready for any screen
        </h1>
        <p className="mt-2 max-w-2xl text-body text-ink/60">
          Upload PNGs, JPGs, MP4s, and more. Videos transcode through Mux and play back as HLS;
          images get a 640px webp thumbnail generated automatically.
        </p>
      </header>

      <MediaUploader />

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-athens bg-white p-12 text-center shadow-sm">
          <p className="font-heading text-h5 uppercase tracking-[1px] text-cornflower">
            Empty library
          </p>
          <h2 className="mt-2 text-h4 font-black text-paua">No media yet</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-ink/60">
            Drag a file onto the uploader above or click <span className="font-semibold">Choose files</span>{" "}
            to start building your library. We&rsquo;ll handle thumbnails, dimensions, and video
            transcoding for you.
          </p>
        </div>
      ) : (
        <section>
          <h2 className="mb-3 font-heading text-h5 uppercase tracking-[1px] text-paua">
            Your media
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <MediaCard key={card.id} {...card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
