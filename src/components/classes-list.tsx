"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type TodaySession = {
  id: string;
  courseName: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
  finalizedAt: string | null;
  class: { id: string; name: string; _count: { students: number } };
  professor?: { name: string } | null;
  window: { opensAt: string; closesAt: string } | null;
};

// Teacher home: today's sessions only. The roll call opens at the start of the
// session and closes at its end (checked again by the server).
export function ClassesList() {
  const [sessions, setSessions] = useState<TodaySession[]>([]);
  const [loading, setLoading] = useState(true);
  // Server clock minus local clock, so a wrong PC/phone time doesn't matter.
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = () =>
      fetch("/api/sessions/today")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data) return;
          setOffset(new Date(data.serverNow).getTime() - Date.now());
          setSessions(data.sessions);
        })
        .finally(() => setLoading(false));
    void load();
    const reload = window.setInterval(load, 5 * 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => {
      window.clearInterval(reload);
      window.clearInterval(tick);
    };
  }, []);

  const serverNow = now + offset;
  const today = new Date(serverNow).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Mes séances du jour</h1>
      <p className="mt-1 text-sm text-muted">
        {today} · l’appel se fait pendant la séance, de l’heure de début à l’heure de fin.
      </p>

      {loading ? <p className="mt-6 text-muted">Chargement…</p> : null}
      {!loading && sessions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-muted">
          Aucune séance aujourd’hui.
        </div>
      ) : null}

      <div className="mt-6 grid gap-3">
        {sessions.map((session) => {
          const opensAt = session.window ? new Date(session.window.opensAt).getTime() : null;
          const closesAt = session.window ? new Date(session.window.closesAt).getTime() : null;
          const state =
            opensAt === null || closesAt === null
              ? "unknown"
              : serverNow < opensAt
                ? "upcoming"
                : serverNow > closesAt
                  ? "closed"
                  : "open";
          const done = Boolean(session.finalizedAt);
          return (
            <div
              key={session.id}
              className={`surface-card flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl p-4 ${state === "open" ? "ring-2 ring-gold/60" : ""}`}
            >
              <div className="w-16 shrink-0">
                <p className="text-lg font-semibold tabular-nums">{session.startTime}</p>
                <p className="text-xs text-muted tabular-nums">
                  {session.endTime ? `→ ${session.endTime}` : ""}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {session.class.name} · {session.courseName}
                </p>
                <p className="text-sm text-muted">
                  {session.class._count.students} étudiants
                  {session.room ? ` · ${session.room}` : ""}
                  {session.professor ? ` · ${session.professor.name}` : ""}
                </p>
              </div>
              {state === "open" ? (
                <Link
                  href={`/session/${session.id}`}
                  className="inline-flex h-11 basis-full items-center justify-center rounded-[10px] bg-gold px-4 text-sm font-semibold text-navy-deep hover:brightness-105 sm:basis-auto"
                >
                  {done ? "Modifier l’appel" : "Faire l’appel"}
                </Link>
              ) : state === "upcoming" ? (
                // The session's own wall-clock time: never shifted by the device's time zone.
                <Badge tone="neutral">Ouvre à {session.startTime}</Badge>
              ) : state === "closed" ? (
                <Badge tone={done ? "ok" : "critical"}>
                  {done ? "Terminée · appel fait" : "Terminée · appel non fait"}
                </Badge>
              ) : (
                <Badge tone="warn">Heure invalide</Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
