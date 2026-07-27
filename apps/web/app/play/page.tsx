"use client";

import { useCallback, useEffect, useState } from "react";
import { clearCreds, getStoredCreds, type DeviceCreds } from "@/lib/player/client";
import { Pairing } from "@/components/player/Pairing";
import { PlayerRuntime } from "@/components/player/PlayerRuntime";

/**
 * Player entry point. The Signage Stick loads /play in kiosk mode. If the
 * device is already paired (credentials in local storage) it goes straight to
 * playback; otherwise it shows the pairing code and waits to be claimed.
 */
export default function PlayPage() {
  const [creds, setCreds] = useState<DeviceCreds | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCreds(getStoredCreds());
    setReady(true);
  }, []);

  const onPaired = useCallback((next: DeviceCreds) => setCreds(next), []);
  const onUnauthorized = useCallback(() => {
    clearCreds();
    setCreds(null);
  }, []);

  // Nothing meaningful to render until we've read local storage (client-only).
  if (!ready) return null;

  return creds ? (
    <PlayerRuntime creds={creds} onUnauthorized={onUnauthorized} />
  ) : (
    <Pairing onPaired={onPaired} />
  );
}
