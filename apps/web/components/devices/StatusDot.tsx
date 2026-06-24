import clsx from "clsx";

type DeviceStatus = "unpaired" | "active" | "offline" | "error" | "disabled";

const COLORS: Record<DeviceStatus, string> = {
  active: "bg-aqua",
  unpaired: "bg-ink/30",
  offline: "bg-yellow-400",
  error: "bg-maroon",
  disabled: "bg-ink/20",
};

const LABELS: Record<DeviceStatus, string> = {
  active: "Active",
  unpaired: "Unpaired",
  offline: "Offline",
  error: "Error",
  disabled: "Disabled",
};

export function StatusDot({
  status,
  className,
  showLabel = true,
}: {
  status: string;
  className?: string;
  showLabel?: boolean;
}) {
  const normalized: DeviceStatus = (
    ["unpaired", "active", "offline", "error", "disabled"] as const
  ).includes(status as DeviceStatus)
    ? (status as DeviceStatus)
    : "unpaired";

  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={clsx(
          "inline-block h-2.5 w-2.5 rounded-full",
          COLORS[normalized],
          normalized === "active" && "ring-2 ring-aqua/30",
        )}
      />
      {showLabel ? (
        <span className="font-heading text-sm uppercase tracking-[1px] text-ink/70">
          {LABELS[normalized]}
        </span>
      ) : null}
    </span>
  );
}
