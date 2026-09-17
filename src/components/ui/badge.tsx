import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "navy" | "ok" | "warn" | "critical";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[7px] px-2 py-0.5 text-[11px] font-medium tracking-tight",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "gold" && "bg-gold/15 text-[#9a6410] dark:text-gold-soft",
        tone === "navy" && "bg-navy/8 text-navy dark:bg-white/8 dark:text-white",
        tone === "ok" && "bg-[#e8f3ee] text-[#1f6b48] dark:bg-[#163328] dark:text-[#8fd4b0]",
        tone === "warn" && "bg-gold/12 text-[#8a5a12] dark:text-gold-soft",
        tone === "critical" && "bg-[#f6e8e8] text-[#8f2d2d] dark:bg-[#3a1c1c] dark:text-[#f0b4b4]",
        className,
      )}
    >
      {children}
    </span>
  );
}
