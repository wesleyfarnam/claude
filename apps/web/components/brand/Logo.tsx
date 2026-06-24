import { brand } from "@drip-tv/shared";
import { clsx } from "clsx";

export function Logo({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const textColor = variant === "dark" ? "text-ink" : "text-white";
  return (
    <span
      className={clsx(
        "inline-flex items-baseline font-display uppercase tracking-wide",
        textColor,
        className,
      )}
      aria-label={brand.name}
    >
      <span className="font-black">Drip</span>
      <span
        aria-hidden
        className="mx-1 inline-block h-[0.9em] w-[0.18em] -skew-x-[18deg] rounded-[2px] bg-aqua"
      />
      <span className="font-black">TV</span>
    </span>
  );
}
