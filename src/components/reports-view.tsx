"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { csvRow } from "@/lib/csv";

type Ref = { id: string; code: string; name: string };
// Class with its level and the subjects planned for it (cascading filters).
type ClassRef = Ref & { levelId: string | null; subjectIds: string[] };
type ReportRow = {
  student: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
  };
  class: Ref;
  subject: Ref;
  level: Ref;
  threshold: number;
  absences: number;
  justified: number;
  present: number;
  total: number;
  status: "NORMAL" | "WARNING" | "ELIMINATED";
  // Dispensé (statut D): absences always 0.
  exempt?: boolean;
};

export function ReportsView({ canExportOfficial = false }: { canExportOfficial?: boolean }) {
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [levels, setLevels] = useState<Ref[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOptions = useCallback(async () => {
    const response = await fetch("/api/reports");
    const data = await response.json();
    if (!response.ok) return;
    setClasses(data.classes);
    setSubjects(data.subjects);
    setLevels(data.levels);
    setClassId((current) => current || data.classes[0]?.id || "");
  }, []);

  const loadReport = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    const query = new URLSearchParams({ classId });
    if (subjectId) query.set("subjectId", subjectId);
    if (levelId) query.set("levelId", levelId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const response = await fetch(`/api/reports?${query}`);
    const data = await response.json();
    setRows(response.ok ? data.rows : []);
    setLoading(false);
  }, [classId, subjectId, levelId, from, to]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  // Cascading filters: level → its classes; class → its subjects; subject →
  // the classes and levels where it is taught.
  const classOptions = classes.filter(
    (item) => (!levelId || item.levelId === levelId) && (!subjectId || item.subjectIds.includes(subjectId)),
  );
  const subjectScope = classId
    ? classes.filter((item) => item.id === classId)
    : classes.filter((item) => !levelId || item.levelId === levelId);
  const subjectOptions = subjects.filter(
    (subject) => subject.id === subjectId || subjectScope.some((item) => item.subjectIds.includes(subject.id)),
  );
  const levelOptions = levels.filter(
    (level) =>
      level.id === levelId ||
      classes.some((item) => item.levelId === level.id && (!subjectId || item.subjectIds.includes(subjectId))),
  );
  // A report needs a class: keep one that fits the new filter.
  function chooseLevel(value: string) {
    setLevelId(value);
    const current = classes.find((item) => item.id === classId);
    if (value && current?.levelId !== value) {
      setClassId(classes.find((item) => item.levelId === value)?.id ?? "");
      setSubjectId("");
    }
  }
  function chooseClass(value: string) {
    setClassId(value);
    const next = classes.find((item) => item.id === value);
    if (subjectId && next && !next.subjectIds.includes(subjectId)) setSubjectId("");
  }

  // Official file (scolarité format, .xls), downloaded straight from the server.
  function officialExportUrl(allClasses: boolean) {
    const query = new URLSearchParams();
    if (!allClasses && classId) query.set("classId", classId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return `/api/admin/reports/absences?${query}`;
  }

  function exportCsv() {
    const header =
      "Matricule;Nom;Prenom;Classe;Niveau;Matiere;Presences;Absences;Justifiees;Seuil;Statut\n";
    const lines = rows.map((row) =>
      csvRow([
        row.student.matricule,
        row.student.lastName,
        row.student.firstName,
        row.class.name,
        row.level.name,
        row.subject.name,
        row.present,
        row.absences,
        row.justified,
        row.threshold,
        row.exempt ? "DISPENSE" : row.status,
      ]),
    );
    const blob = new Blob([`\uFEFF${header}${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rapport-absences.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rapports d’absences</h1>
          <p className="mt-1 text-sm text-muted">
            Calcul par étudiant, matière et niveau.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExportOfficial ? (
            <>
              <a
                href={officialExportUrl(false)}
                className="inline-flex h-10 items-center rounded-[10px] bg-gold px-4 text-sm font-medium text-navy-deep hover:brightness-105"
              >
                Fichier absences (classe)
              </a>
              <a
                href={officialExportUrl(true)}
                className="inline-flex h-10 items-center rounded-[10px] border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
              >
                Toutes les classes
              </a>
            </>
          ) : null}
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            Exporter CSV
          </Button>
        </div>
      </div>
      {canExportOfficial ? (
        <p className="mt-2 text-xs text-muted">
          Fichier absences : format scolarité (.xls), une ligne par étudiant et matière, absences non justifiées
          sur la période choisie. « Identifiant EE » est à compléter (même valeur pour toute une matière).
        </p>
      ) : null}

      <div className="surface-card mt-5 grid gap-2 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={classId}
          onChange={(event) => chooseClass(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          aria-label="Classe"
        >
          <option value="">Classe</option>
          {classOptions.map((item) => (
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
          {subjectOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
        <select
          value={levelId}
          onChange={(event) => chooseLevel(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          aria-label="Niveau"
        >
          <option value="">Tous les niveaux</option>
          {levelOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          aria-label="Date de début"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          aria-label="Date de fin"
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Étudiant</th>
              <th className="px-4 py-2">Matière</th>
              <th className="px-4 py-2">Niveau</th>
              <th className="px-4 py-2">Présences</th>
              <th className="px-4 py-2">Absences</th>
              <th className="px-4 py-2">Justifiées</th>
              <th className="px-4 py-2">Seuil</th>
              <th className="px-4 py-2">Statut</th>
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
                <td className="px-4 py-3">{row.subject.name}</td>
                <td className="px-4 py-3">{row.level.name}</td>
                <td className="px-4 py-3">
                  {row.present}/{row.total}
                </td>
                <td className="px-4 py-3">{row.absences}</td>
                <td className="px-4 py-3">{row.justified}</td>
                <td className="px-4 py-3">{row.threshold}</td>
                <td className="px-4 py-3">
                  {row.exempt
                    ? "Dispensé (D)"
                    : row.status === "ELIMINATED"
                      ? "Éliminé"
                      : row.status === "WARNING"
                        ? "Avertissement"
                        : "Normal"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <p className="p-8 text-center text-muted">
            Aucun résultat. Vérifiez le niveau de la classe et les seuils.
          </p>
        ) : null}
        {loading ? (
          <p className="p-8 text-center text-muted">Chargement…</p>
        ) : null}
      </div>
    </div>
  );
}
