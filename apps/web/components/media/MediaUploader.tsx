"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface UploadItem {
  id: string;
  filename: string;
  bytes: number;
  status: "preparing" | "uploading" | "finalizing" | "done" | "error";
  progress: number;
  error?: string;
}

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const uploadFile = useCallback(
    async (file: File): Promise<void> => {
      const localId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: UploadItem = {
        id: localId,
        filename: file.name,
        bytes: file.size,
        status: "preparing",
        progress: 0,
      };
      setItems((prev) => [item, ...prev]);

      if (!ALLOWED.has(file.type)) {
        updateItem(localId, { status: "error", error: `Unsupported file type: ${file.type || "unknown"}` });
        return;
      }

      // 1. Ask the server for a signed upload URL.
      let assetId: string;
      let signedUrl: string;
      try {
        const res = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: file.name, mime: file.type, bytes: file.size }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Upload prep failed (${res.status})`);
        }
        const data = (await res.json()) as { assetId: string; signedUploadUrl: string };
        assetId = data.assetId;
        signedUrl = data.signedUploadUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        updateItem(localId, { status: "error", error: message });
        return;
      }

      // 2. PUT the file bytes to the signed Supabase Storage URL with progress.
      updateItem(localId, { status: "uploading" });
      try {
        await putWithProgress(signedUrl, file, (pct) => {
          updateItem(localId, { progress: pct });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "upload failed";
        updateItem(localId, { status: "error", error: message });
        return;
      }

      // 3. Finalize — image gets dimensions + thumbnail; video kicks off Mux.
      updateItem(localId, { status: "finalizing", progress: 100 });
      try {
        const res = await fetch(`/api/media/${assetId}/finalize`, { method: "POST" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Finalize failed (${res.status})`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "finalize failed";
        updateItem(localId, { status: "error", error: message });
        return;
      }

      updateItem(localId, { status: "done" });
      router.refresh();
    },
    [router, updateItem],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        // Fire each upload in parallel — they only contend on signed-URL prep.
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  return (
    <section className="mb-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-sapphire bg-sapphire/5" : "border-athens bg-white"
        }`}
      >
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">Upload</p>
        <h2 className="mt-1 text-h4 font-black text-paua">Drop files or pick from your computer</h2>
        <p className="mt-2 text-sm text-ink/60">
          PNG, JPG, WEBP, GIF, MP4, MOV, or WEBM. Up to 1 GB each.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex items-center rounded-md bg-sapphire px-5 py-2.5 font-heading uppercase tracking-[1px] text-white shadow-sm transition-colors hover:bg-royal"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-athens bg-white p-3 text-sm shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-paua">{item.filename}</p>
                  <p className="text-xs text-ink/50">{fmtBytes(item.bytes)}</p>
                </div>
                <StatusBadge item={item} />
              </div>
              {(item.status === "uploading" || item.status === "finalizing") && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-athens">
                  <div
                    className="h-full bg-sapphire transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              {item.error && (
                <p className="mt-1 text-xs text-maroon">{item.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusBadge({ item }: { item: UploadItem }) {
  const label =
    item.status === "preparing"
      ? "Preparing"
      : item.status === "uploading"
        ? `${item.progress}%`
        : item.status === "finalizing"
          ? "Processing"
          : item.status === "done"
            ? "Done"
            : "Error";
  const tone =
    item.status === "done"
      ? "bg-aqua/20 text-paua"
      : item.status === "error"
        ? "bg-maroon/10 text-maroon"
        : "bg-cornflower/20 text-paua";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-heading text-xs uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}

/**
 * PUTs the file to a signed Supabase Storage URL using XHR so we can report
 * upload progress (fetch in browsers still doesn't expose upload progress).
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) {
      xhr.setRequestHeader("content-type", file.type);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
        onProgress(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage upload failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
