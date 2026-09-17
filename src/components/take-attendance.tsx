"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Row = {
  student: { id: string; firstName: string; lastName: string; matricule: string };
  attendance: { present: boolean } | null;
};

export function TakeAttendance() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        setTitle(`${d.session.courseName} · ${d.session.class.name}`);
        setReadOnly(Boolean(d.session.finalizedAt));
        setRows(d.rows);
        const m: Record<string, boolean> = {};
        for (const row of d.rows) {
          m[row.student.id] = row.attendance?.present ?? true;
        }
        setMarks(m);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  function setAll(present: boolean) {
    setMarks(Object.fromEntries(rows.map((r) => [r.student.id, present])));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marks: Object.entries(marks).map(([studentId, present]) => ({ studentId, present })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Enregistré ✓");
      setTimeout(() => router.back(), 800);
    } else {
      setMsg("Erreur");
    }
  }

  if (loading) return <p className="text-muted">Chargement...</p>;

  return (
    <div>
      <Link href="/classes" className="text-sm text-muted hover:text-ink">
        ← Retour
      </Link>
      <h1 className="mt-3 text-xl font-semibold sm:text-2xl">{title}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="gold" onClick={() => setAll(true)} disabled={readOnly}>
          Tous présents
        </Button>
        <Button variant="secondary" onClick={() => setAll(false)} disabled={readOnly}>
          Tous absents
        </Button>
        <Button onClick={save} disabled={saving || readOnly} className="ml-auto">
          {saving ? "..." : "Enregistrer"}
        </Button>
      </div>
      {readOnly ? (
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm text-muted">
          Séance finalisée. Seule l’administration peut corriger le pointage.
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-sm text-gold">{msg}</p> : null}
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.student.id} className="surface-card flex items-center gap-3 rounded-xl p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {row.student.lastName} {row.student.firstName}
              </p>
              <p className="text-xs text-muted">{row.student.matricule}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setMarks((m) => ({ ...m, [row.student.id]: true }))}
                className={cn(
                  "h-10 min-w-[88px] rounded-lg text-sm font-medium",
                  marks[row.student.id] ? "bg-navy text-white" : "bg-surface-2 text-muted",
                )}
              >
                Présent
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setMarks((m) => ({ ...m, [row.student.id]: false }))}
                className={cn(
                  "h-10 min-w-[88px] rounded-lg text-sm font-medium",
                  !marks[row.student.id] ? "bg-[#4a5568] text-white" : "bg-surface-2 text-muted",
                )}
              >
                Absent
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="fixed right-0 bottom-0 left-0 border-t border-border bg-surface p-3 sm:static sm:mt-6 sm:border-0 sm:p-0">
        <Button onClick={save} disabled={saving || readOnly} className="w-full sm:w-auto">
          Enregistrer la séance
        </Button>
      </div>
    </div>
  );
}
