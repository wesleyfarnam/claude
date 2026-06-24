import { ComingSoon } from "@/components/ui/ComingSoon";

export default function ProofOfPlayPage() {
  return (
    <ComingSoon
      eyebrow="Reports"
      title="Proof of play"
      milestone="M7"
      body="Per-device, per-asset playback logs. Nightly rollups into `playback_daily`. Filter by date range, export CSV. Built on the partitioned `playback_events` table."
    />
  );
}
