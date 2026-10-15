import { z } from "zod";

// CIN: 8 digits for Tunisian nationals; letters allowed for foreign documents.
export const CIN_PATTERN = /^[A-Za-z0-9]{4,20}$/;
export const PHONE_PATTERN = /^\+?[0-9 ().-]{6,30}$/;

export function cleanCin(value: string | null | undefined) {
  const compact = (value ?? "").replace(/[\s.-]/g, "");
  return compact && CIN_PATTERN.test(compact) ? compact.toUpperCase() : null;
}

export const cinField = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, "").toUpperCase())
  .refine((value) => value === "" || CIN_PATTERN.test(value), "CIN invalide")
  .nullable()
  .optional();

export const phoneField = z
  .string()
  .trim()
  .refine((value) => value === "" || PHONE_PATTERN.test(value), "Téléphone invalide")
  .nullable()
  .optional();

// For display only: the full CIN is shown in the edit form, not in lists.
export function maskCin(value: string | null | undefined) {
  if (!value) return "—";
  return value.length <= 3 ? "•••" : `${"•".repeat(Math.min(5, value.length - 3))}${value.slice(-3)}`;
}
