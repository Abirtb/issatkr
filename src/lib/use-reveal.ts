"use client";

import { useEffect, useRef } from "react";

// Brings a form into view when it opens for a given row. On phones the edit
// form renders below a long list, so without this "Modifier" looks inert.
export function useRevealOnOpen<T extends HTMLElement>(key: string | null | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (key) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [key]);
  return ref;
}
