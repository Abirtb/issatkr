"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type NotificationRow = {
  id: string;
  type: "WARNING" | "ELIMINATION";
  status: "PENDING" | "SENDING" | "SENT" | "FAILED";
  recipient: string;
  absenceCount: number;
  threshold: number;
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  student: {
    firstName: string;
    lastName: string;
    matricule: string;
    class: { name: string };
  };
  subject: { name: string };
  level: { name: string };
};

export function NotificationHistory() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/admin/notifications${status ? `?status=${status}` : ""}`,
    );
    const data = await response.json();
    setRows(response.ok ? data : []);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id: string) {
    setMessage("Relance en cours…");
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMessage(response.ok ? "Relance terminée" : "Relance impossible");
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-muted">
            Historique des avertissements et éliminations envoyés par e-mail.
          </p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="SENT">Envoyés</option>
          <option value="FAILED">Échecs</option>
          <option value="PENDING">En attente</option>
        </select>
      </div>
      {message ? <p className="mt-3 text-sm text-gold">{message}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Étudiant</th>
              <th className="px-4 py-2">Matière</th>
              <th className="px-4 py-2">Alerte</th>
              <th className="px-4 py-2">Destinataire</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  {row.student.lastName} {row.student.firstName}
                  <span className="block text-xs text-muted">
                    {row.student.matricule} · {row.student.class.name}
                  </span>
                </td>
                <td className="px-4 py-3">{row.subject.name}</td>
                <td className="px-4 py-3">
                  {row.type === "ELIMINATION" ? "Élimination" : "Avertissement"}
                  <span className="block text-xs text-muted">
                    {row.absenceCount}/{row.threshold} absences
                  </span>
                </td>
                <td className="px-4 py-3">{row.recipient}</td>
                <td className="px-4 py-3">
                  {row.status}
                  {row.error ? (
                    <span className="block max-w-52 text-xs text-red-700">
                      {row.error}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {new Date(row.sentAt ?? row.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  {row.status === "FAILED" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void retry(row.id)}
                    >
                      Relancer
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-muted">Aucune notification.</p>
        ) : null}
      </div>
    </div>
  );
}
