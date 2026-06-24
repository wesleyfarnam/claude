import { ComingSoon } from "@/components/ui/ComingSoon";

export default function DevicesPage() {
  return (
    <ComingSoon
      eyebrow="Devices"
      title="Every Signage Stick, live"
      milestone="M3"
      body="Pair a stick with a 6-character code, watch heartbeats stream in via Supabase Realtime, and issue remote commands (reboot, refresh, screenshot) through the Amazon Signage Remote Management API."
    />
  );
}
