import type { AlertLevel } from "@prisma/client";

export function resolveAlertLevel(
  absenceCount: number,
  eliminationCount: number,
): AlertLevel {
  if (absenceCount >= eliminationCount) return "ELIMINATED";
  if (absenceCount >= Math.max(1, eliminationCount - 1)) return "WARNING";
  return "NORMAL";
}

export function resolveAlertEpisode(
  currentLevel: AlertLevel | null,
  nextLevel: AlertLevel,
  currentEpisode: number,
) {
  return nextLevel !== "NORMAL" &&
    (!currentLevel || currentLevel === "NORMAL")
    ? currentEpisode + 1
    : currentEpisode;
}

export function shouldCreateNotification(
  currentLevel: AlertLevel | null,
  nextLevel: AlertLevel,
) {
  return nextLevel !== "NORMAL" && currentLevel !== nextLevel;
}
