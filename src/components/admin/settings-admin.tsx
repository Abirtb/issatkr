"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Reference = { id: string; code: string; name: string };
type Threshold = {
  id: string;
  subjectId: string;
  levelId: string;
  eliminationCount: number;
  subject: Reference;
  level: Reference;
};

export function AdminSettings() {
  const [subjects, setSubjects] = useState<Reference[]>([]);
  const [levels, setLevels] = useState<Reference[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [limit, setLimit] = useState(3);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/thresholds");
    const data = await response.json();
    if (!response.ok) return;
    setSubjects(data.subjects);
    setLevels(data.levels);
    setThresholds(data.thresholds);
    setSubjectId((current) => current || data.subjects[0]?.id || "");
    setLevelId((current) => current || data.levels[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/thresholds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectId,
        levelId,
        eliminationCount: limit,
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Seuil enregistré" : data.error);
    if (res.ok) await load();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/thresholds?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(response.ok ? "Seuil supprimé" : data.error);
    if (response.ok) await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Paramètres</h1>
      <p className="mt-1 text-sm text-muted">
        Seuil d’élimination par matière et par niveau. L’avertissement est envoyé
        une absence avant ce seuil.
      </p>
      <form
        onSubmit={save}
        className="surface-card mt-6 grid max-w-3xl gap-3 rounded-xl p-5 sm:grid-cols-3"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Matière</span>
          <select
            required
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Niveau</span>
          <select
            required
            value={levelId}
            onChange={(event) => setLevelId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.code} · {level.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Nombre d’absences</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <Button
          type="submit"
          className="sm:col-span-3"
          disabled={!subjectId || !levelId}
        >
          Enregistrer
        </Button>
        {message ? (
          <p className="text-sm text-gold sm:col-span-3">{message}</p>
        ) : null}
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Matière</th>
              <th className="px-4 py-2">Niveau</th>
              <th className="px-4 py-2">Avertissement</th>
              <th className="px-4 py-2">Élimination</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {thresholds.map((threshold) => (
              <tr key={threshold.id} className="border-t border-border">
                <td className="px-4 py-3">{threshold.subject.name}</td>
                <td className="px-4 py-3">{threshold.level.name}</td>
                <td className="px-4 py-3">
                  {Math.max(1, threshold.eliminationCount - 1)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {threshold.eliminationCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void remove(threshold.id)}
                    className="text-red-700 hover:underline"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
