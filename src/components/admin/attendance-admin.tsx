"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Att = {
  id: string;
  present: boolean;
  justification: string | null;
  student: { firstName: string; lastName: string; matricule: string; class: { name: string } };
  session: { courseName: string; date: string; startTime: string };
};

export function AdminAttendance() {
  const [rows, setRows] = useState<Att[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async (search = "") => {
    const res = await fetch(`/api/admin/attendance?q=${encodeURIComponent(search)}`);
    setRows(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, data: { present?: boolean; justification?: string }) {
    await fetch("/api/admin/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    void load(q);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Absences</h1>
      <p className="mt-1 text-sm text-muted">Corriger une absence ou ajouter un justificatif.</p>
      <div className="mt-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="max-w-sm" />
        <Button variant="secondary" onClick={() => void load(q)}>
          Chercher
        </Button>
      </div>
      <div className="mt-6 space-y-3">
        {rows.map((a) => (
          <div key={a.id} className="surface-card rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {a.student.lastName} {a.student.firstName} · {a.student.matricule}
                </p>
                <p className="text-sm text-muted">
                  {a.session.courseName} · {new Date(a.session.date).toLocaleDateString("fr-FR")} ·{" "}
                  {a.session.startTime} · {a.student.class.name}
                </p>
              </div>
              <span className={a.present ? "text-green-700" : "text-red-600"}>
                {a.present ? "Présent" : "Absent"}
              </span>
            </div>
            {!a.present ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => patch(a.id, { present: true })}>
                  Marquer présent
                </Button>
                <Input
                  placeholder="Justificatif..."
                  defaultValue={a.justification ?? ""}
                  className="max-w-xs"
                  onBlur={(e) => patch(a.id, { justification: e.target.value })}
                />
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => patch(a.id, { present: false })}>
                Marquer absent
              </Button>
            )}
          </div>
        ))}
        {rows.length === 0 ? <p className="text-muted">Aucune saisie trouvée.</p> : null}
      </div>
    </div>
  );
}
