"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Session = {
  id: string;
  courseName: string;
  courseCode: string | null;
  date: string;
  startTime: string;
  room: string | null;
};

export function ClassSessions() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/classes/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setName(d.name);
        setSessions(d.sessions ?? []);
        setHistory(d.history ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-muted">Chargement...</p>;

  return (
    <div>
      <Link href="/classes" className="text-sm text-muted hover:text-ink">
        ← Classes
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">{name}</h1>
      <p className="text-sm text-muted">Choisissez la séance du jour.</p>
      <div className="mt-6 grid gap-2">
        {sessions.length === 0 ? (
          <p className="text-muted">Aucune séance. Importez l&apos;emploi du temps (admin).</p>
        ) : (
          sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="surface-card flex items-center justify-between rounded-xl px-4 py-3 hover:ring-1 hover:ring-gold/40"
            >
              <div>
                <p className="font-medium">{s.courseName}</p>
                <p className="text-sm text-muted">
                  {new Date(s.date).toLocaleDateString("fr-FR")} · {s.startTime}
                  {s.room ? ` · ${s.room}` : ""}
                </p>
              </div>
              <span className="text-gold">Présence →</span>
            </Link>
          ))
        )}
      </div>
      {history.length ? (
        <>
          <h2 className="mt-8 text-sm font-semibold text-muted">
            Historique récent
          </h2>
          <div className="mt-3 grid gap-2">
            {history.map((session) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{session.courseName}</p>
                  <p className="text-sm text-muted">
                    {new Date(session.date).toLocaleDateString("fr-FR")} ·{" "}
                    {session.startTime}
                  </p>
                </div>
                <span className="text-sm text-muted">Consulter →</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
