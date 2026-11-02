"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kindLabel } from "@/lib/session-kind";

type Row = {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string | null;
  courseName: string;
  courseCode: string | null;
  room: string | null;
  kind: string;
  subgroup: string;
  className: string;
  professorId: string | null;
  professorName: string | null;
};

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const NONE = "none";

// Teacher absences: planned sessions that are over without roll call.
export function TeacherAbsencesAdmin() {
  const [from, setFrom] = useState(() => {
    const today = new Date();
    return iso(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [to, setTo] = useState(() => iso(new Date()));
  const [teacher, setTeacher] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/teacher-absences?${new URLSearchParams({ from, to })}`);
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    setRows(data.rows);
  }, [from, to]);

  useEffect(() => {
    void load();
    // Only on first display; later loads come from the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teachers = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const row of rows) {
      const id = row.professorId ?? NONE;
      const entry = counts.get(id) ?? { name: row.professorName ?? "Enseignant non affecté", count: 0 };
      entry.count++;
      counts.set(id, entry);
    }
    return [...counts].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, "fr"));
  }, [rows]);
  const shown = teacher ? rows.filter((row) => (row.professorId ?? NONE) === teacher) : rows;
  const exportParams = new URLSearchParams({ from, to, format: "xlsx" });
  if (teacher && teacher !== NONE) exportParams.set("professorId", teacher);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Absences enseignants</h1>
      <p className="mt-1 text-sm text-muted">
        Séances prévues à l’emploi du temps, terminées, pour lesquelles l’appel n’a pas
        été fait. Un récapitulatif est envoyé chaque soir par e-mail aux administrateurs.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted">Du</span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Au</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <Button type="submit" variant="secondary">
          Afficher
        </Button>
        <a
          href={`/api/admin/teacher-absences?${exportParams}`}
          className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-medium text-navy-deep"
        >
          Exporter (Excel)
        </a>
      </form>

      {error ? <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">{error}</p> : null}

      {loading ? (
        <p className="mt-6 text-muted">Chargement...</p>
      ) : !rows.length ? (
        <p className="mt-6 rounded-lg bg-surface-2 p-4 text-sm text-muted">
          Aucune séance sans appel sur cette période.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="surface-card h-fit rounded-xl p-2">
            <button
              type="button"
              onClick={() => setTeacher("")}
              className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm ${teacher ? "" : "bg-surface-2 font-medium"}`}
            >
              <span>Tous les enseignants</span>
              <span className="tabular-nums">{rows.length}</span>
            </button>
            {teachers.map(([id, entry]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTeacher(id)}
                className={`flex w-full justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${teacher === id ? "bg-surface-2 font-medium" : ""}`}
              >
                <span>{entry.name}</span>
                <span className="tabular-nums text-red-600">{entry.count}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {shown.map((row) => (
              <div key={row.sessionId} className="surface-card rounded-xl p-3 text-sm">
                <p className="font-medium">
                  {new Date(row.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {" · "}
                  {row.courseName}
                  {row.kind ? ` (${kindLabel(row.kind)})` : ""}
                </p>
                <p className="text-muted">
                  {row.professorName ?? "Enseignant non affecté"} · {row.startTime}
                  {row.endTime ? `–${row.endTime}` : ""} · {row.className}
                  {row.subgroup ? ` (${row.subgroup})` : ""}
                  {row.room ? ` · salle ${row.room}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
