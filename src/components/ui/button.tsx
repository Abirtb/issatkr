import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        size === "sm" && "h-9 px-3 text-sm rounded-[8px]",
        size === "md" && "h-10 px-4 text-sm rounded-[10px]",
        size === "lg" && "h-12 px-5 text-[15px] rounded-[10px]",
        variant === "primary" &&
          "bg-navy text-white hover:bg-navy-mid dark:bg-navy-soft dark:hover:bg-navy-mid",
        variant === "gold" && "bg-gold text-navy-deep hover:brightness-105",
        variant === "secondary" &&
          "bg-surface text-ink border border-border hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-[#8f2d2d] text-white hover:bg-[#7a2424]",
        className,
      )}
      {...props}
    />
  );
}
