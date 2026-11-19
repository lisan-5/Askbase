import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        "display inline-flex items-baseline text-[22px] font-bold tracking-[-0.04em]",
        inverted ? "text-bg" : "text-ink",
        className,
      )}
    >
      <span className="mark !text-[#0e0f13]">ask</span>
      <span>base</span>
    </span>
  );
}
