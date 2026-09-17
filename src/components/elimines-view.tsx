"use client";

import { useCallback, useEffect, useState } from "react";

type Ref = { id: string; code: string; name: string };
type EliminatedRow = {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string;
  };
  class: Ref;
  subject: Ref;
  level: Ref;
  absences: number;
  threshold: number;
};

export function EliminesView() {
  const [classes, setClasses] = useState<Ref[]>([]);
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [rows, setRows] = useState<EliminatedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((response) => response.json())
      .then((data) => {
        setClasses(data.classes ?? []);
        setSubjects(data.subjects ?? []);
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (classId) query.set("classId", classId);
    if (subjectId) query.set("subjectId", subjectId);
    const response = await fetch(`/api/elimines?${query}`);
    const data = await response.json();
    setRows(response.ok ? data.students ?? [] : []);
    setLoading(false);
  }, [classId, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Étudiants éliminés</h1>
      <p className="mt-1 text-sm text-muted">
        Seuls les seuils atteints par matière et niveau sont affichés.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Toutes les classes autorisées</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Toutes les matières</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-muted">
          Aucun étudiant éliminé.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-2">Étudiant</th>
                <th className="px-4 py-2">Classe</th>
                <th className="px-4 py-2">Matière</th>
                <th className="px-4 py-2">Absences / seuil</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.student.id}:${row.subject.id}`}
                  className="border-t border-border"
                >
                  <td className="px-4 py-3">
                    {row.student.lastName} {row.student.firstName}
                    <span className="block text-xs text-muted">
                      {row.student.matricule}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.class.name}</td>
                  <td className="px-4 py-3">{row.subject.name}</td>
                  <td className="px-4 py-3 font-semibold text-gold">
                    {row.absences} / {row.threshold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
