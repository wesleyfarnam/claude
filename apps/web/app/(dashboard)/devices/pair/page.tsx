"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PairDevicePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/devices/pair/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairing_code: code.trim().toUpperCase(),
          name: name.trim(),
        }),
      });
      const json = (await res.json()) as { device_id?: string; error?: string };
      if (!res.ok || !json.device_id) {
        setError(json.error ?? "Pairing failed");
        setSubmitting(false);
        return;
      }
      router.push(`/devices/${json.device_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">
          Devices
        </p>
        <h1 className="mt-1 text-h3 font-black text-paua">Pair a Signage Stick</h1>
      </header>

      <div className="mx-auto max-w-xl rounded-lg bg-white p-8 shadow-sm">
        <p className="text-body text-ink/70">
          Boot the Drip TV player on your Signage Stick. It will display a 6-character
          pairing code. Enter it below to attach the stick to your organization.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="pairing_code"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              Pairing code
            </label>
            <input
              id="pairing_code"
              name="pairing_code"
              type="text"
              autoComplete="off"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 font-display text-3xl uppercase tracking-[0.4em] text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block font-heading text-sm uppercase tracking-[1px] text-maroon"
            >
              Device name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front Window — Stick 1"
              className="mt-2 w-full rounded border border-ink/15 px-4 py-3 text-body text-paua focus:border-sapphire focus:outline-none focus:ring-2 focus:ring-sapphire/30"
            />
          </div>

          {error ? (
            <p className="rounded bg-maroon/10 px-4 py-3 text-sm text-maroon">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/devices"
              className="font-heading text-sm uppercase tracking-[1px] text-ink/60 hover:text-paua"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || code.length !== 6 || name.length === 0}
              className="rounded bg-sapphire px-6 py-3 font-heading text-btn uppercase tracking-[1px] text-white shadow-sm hover:bg-sapphire/90 disabled:opacity-50"
            >
              {submitting ? "Pairing…" : "Pair device"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
