"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Drag a file here, or click to choose it. `accept` like ".xls,.xlsx".
export function FileDropZone({
  accept,
  file,
  onFile,
  disabled = false,
  label = "Glissez le fichier ici",
  hint,
  className,
}: {
  accept: string;
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const extensions = accept.split(",").map((value) => value.trim().toLowerCase());

  function take(candidate: File | undefined) {
    if (!candidate) return;
    const ok = extensions.some((extension) => candidate.name.toLowerCase().endsWith(extension));
    if (!ok) {
      setError(`Format accepté : ${extensions.join(", ").toUpperCase()}`);
      return;
    }
    setError("");
    onFile(candidate);
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (!disabled) take(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm transition-colors disabled:opacity-60",
          over ? "border-gold bg-gold/10" : file ? "border-gold/60 bg-surface-2" : "border-border hover:border-gold/60 hover:bg-surface-2",
        )}
      >
        {file ? (
          <>
            <span className="max-w-full truncate font-medium">✓ {file.name}</span>
            <span className="text-xs text-muted">Cliquez ou glissez un autre fichier pour le remplacer</span>
          </>
        ) : (
          <>
            <span aria-hidden className="text-xl text-muted">⬆</span>
            <span className="font-medium">{label}</span>
            <span className="text-xs text-muted">ou cliquez pour le choisir{hint ? ` · ${hint}` : ""}</span>
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
