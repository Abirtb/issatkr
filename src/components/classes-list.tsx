"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ClassRow = {
  id: string;
  name: string;
  code: string;
  _count: { students: number };
  sessions: { id: string; courseName: string; date: string; startTime: string }[];
};

export function ClassesList() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/classes")
      .then((r) => r.json())
      .then(setClasses)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted">Chargement...</p>;
  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
        Aucune classe. L&apos;admin doit importer les données.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Mes classes</h1>
      <p className="mt-1 text-sm text-muted">Choisissez une classe pour prendre la présence.</p>
      <div className="mt-6 grid gap-3">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/classes/${c.id}`}
            className="surface-card block rounded-xl p-4 hover:ring-1 hover:ring-gold/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">
                  {c.code} · {c._count.students} étudiants
                </p>
              </div>
              <span className="text-gold">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
