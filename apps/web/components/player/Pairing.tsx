"use client";

import { useEffect, useRef, useState } from "react";
import {
  getHardwareId,
  pollPairing,
  startPairing,
  storeCreds,
  type DeviceCreds,
} from "@/lib/player/client";

/**
 * First-boot pairing screen. Requests a pairing code, displays it fullscreen,
 * and polls until an operator claims it in the dashboard — then hands the
 * device credentials up to the player runtime.
 */
export function Pairing({ onPaired }: { onPaired: (creds: DeviceCreds) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const activeCode = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function begin() {
      try {
        const { pairing_code } = await startPairing(getHardwareId());
        if (cancelled) return;
        activeCode.current = pairing_code;
        setCode(pairing_code);
        setOffline(false);
        timer = setTimeout(poll, 3000);
      } catch {
        if (cancelled) return;
        setOffline(true);
        timer = setTimeout(begin, 5000);
      }
    }

    async function poll() {
      const current = activeCode.current;
      if (!current || cancelled) return;
      try {
        const result = await pollPairing(current);
        if (cancelled) return;
        if (result.status === "paired") {
          const creds: DeviceCreds = {
            token: result.device_token,
            deviceId: result.device_id,
            orgId: result.org_id,
          };
          storeCreds(creds);
          onPaired(creds);
          return;
        }
        if (result.status === "expired") {
          void begin();
          return;
        }
        timer = setTimeout(poll, 3000);
      } catch {
        setOffline(true);
        timer = setTimeout(poll, 4000);
      }
    }

    void begin();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [onPaired]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-paua text-white">
      <p className="font-heading text-2xl uppercase tracking-[6px] text-white/70">
        DRIP<span className="text-aqua">/</span>TV
      </p>
      <h1 className="mt-8 font-heading text-3xl uppercase tracking-[2px] text-white/90">
        Pair this screen
      </h1>
      <div className="mt-8 rounded-2xl bg-white/5 px-12 py-8 ring-1 ring-white/10">
        <p className="text-center font-display text-7xl font-black tracking-[0.3em] text-aqua">
          {code ?? "······"}
        </p>
      </div>
      <p className="mt-10 max-w-md text-center text-lg text-white/60">
        In the Drip TV dashboard, go to <span className="text-white">Devices → Pair a device</span>{" "}
        and enter this code.
      </p>
      <p className="mt-3 text-sm uppercase tracking-[2px] text-white/40">
        {offline ? "Reconnecting…" : "Waiting for pairing…"}
      </p>
    </div>
  );
}
