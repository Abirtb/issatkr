import { cn } from "@/lib/cn";
import { initials } from "@/lib/data";

export function Avatar({
  firstName,
  lastName,
  size = "md",
}: {
  firstName: string;
  lastName: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-navy text-white font-medium tracking-tight",
        size === "sm" && "h-8 w-8 text-[11px]",
        size === "md" && "h-10 w-10 text-xs",
        size === "lg" && "h-14 w-14 text-base",
        size === "xl" && "h-[88px] w-[88px] text-2xl",
      )}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
