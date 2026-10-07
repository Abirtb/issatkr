"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Data = {
  student: {
    firstName: string;
    lastName: string;
    matricule: string;
    email: string | null;
    class: {
      name: string;
      level: { name: string } | null;
    };
    attendances: {
      id: string;
      present: boolean;
      justification: string | null;
      justificationFile: string | null;
      amendedAt: string | null;
      amendedBy: { name: string } | null;
      session: {
        date: string;
        startTime: string;
        subject: { name: string } | null;
        courseName: string;
      };
    }[];
  };
  summaries: {
    subject: { id: string; code: string; name: string };
    present: number;
    absences: number;
    justified: number;
    threshold: number | null;
    status: "NORMAL" | "WARNING" | "ELIMINATED";
  }[];
};

export function StudentHistory({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch(`/api/admin/students/${id}`)
      .then((response) => response.json())
      .then(setData);
  }, [id]);

  if (!data?.student) return <p className="text-muted">Chargement…</p>;
  const { student } = data;

  return (
    <div>
      <Link href="/admin/classes" className="-my-2 inline-flex min-h-10 items-center text-sm text-muted hover:text-ink">
        ← Classes et étudiants
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">
        {student.lastName} {student.firstName}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {student.matricule} · {student.class.name}
        {student.class.level ? ` · ${student.class.level.name}` : ""}
        {student.email ? ` · ${student.email}` : ""}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.summaries.map((summary) => (
          <div key={summary.subject.id} className="surface-card rounded-xl p-4">
            <p className="font-medium">{summary.subject.name}</p>
            <p className="mt-1 text-xs text-muted">{summary.subject.code}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="block text-xs text-muted">Présent</span>
                {summary.present}
              </div>
              <div>
                <span className="block text-xs text-muted">Absent</span>
                {summary.absences}
              </div>
              <div>
                <span className="block text-xs text-muted">Justifié</span>
                {summary.justified}
              </div>
            </div>
            <p className="mt-3 text-sm font-medium">
              {summary.status === "ELIMINATED"
                ? "Éliminé"
                : summary.status === "WARNING"
                  ? "Avertissement"
                  : "Normal"}
              {summary.threshold ? ` · seuil ${summary.threshold}` : ""}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Historique</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Matière</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Justificatif</th>
            </tr>
          </thead>
          <tbody>
            {student.attendances.map((attendance) => (
              <tr key={attendance.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {new Date(attendance.session.date).toLocaleDateString("fr-FR")}{" "}
                  · {attendance.session.startTime}
                </td>
                <td className="px-4 py-3">
                  {attendance.session.subject?.name ??
                    attendance.session.courseName}
                </td>
                <td className="px-4 py-3">
                  {attendance.present
                    ? "Présent"
                    : attendance.justification
                      ? "Absence justifiée"
                      : "Absent"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {attendance.justification || "—"}
                  {attendance.justificationFile ? (
                    <a
                      href={`/api/admin/attendance/justificatif?id=${attendance.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs text-navy hover:underline"
                    >
                      Voir le justificatif
                    </a>
                  ) : null}
                  {attendance.amendedBy ? (
                    <span className="block text-xs">
                      Modifié par {attendance.amendedBy.name}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
