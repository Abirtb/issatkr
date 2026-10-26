"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isGroupSubject, semesterInGroup, type GroupInfo, type SubjectLinks } from "@/lib/group-subjects";

type Reference = { id: string; code: string; name: string };
type SubjectRow = Reference & SubjectLinks;
type ParcoursRow = { id: string; code: string; mention: string; specialty: string };
type GroupRow = GroupInfo & { id: string };
type Threshold = {
  id: string;
  subjectId: string;
  levelId: string;
  eliminationCount: number;
  subject: Reference;
  level: Reference;
};

export function AdminSettings() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [parcoursList, setParcoursList] = useState<ParcoursRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  // Filters: a parcours, then one of its groups.
  const [parcoursFilter, setParcoursFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
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
    setParcoursList(data.parcours ?? []);
    setGroups(data.classes ?? []);
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

  // Parcours → its groups; group → its subjects (EE of its parcours for its
  // level) and its level; parcours alone → its EE and the levels of its groups.
  const group = groups.find((item) => item.id === groupFilter);
  const groupOptions = groups.filter((item) => !parcoursFilter || item.parcoursId === parcoursFilter);
  const subjectOptions = group
    ? subjects
        .filter((subject) => isGroupSubject(subject, group))
        .sort((a, b) => (semesterInGroup(a, group) ?? 99) - (semesterInGroup(b, group) ?? 99))
    : parcoursFilter
      ? subjects.filter((subject) => subject.elements.some((element) => element.parcoursId === parcoursFilter))
      : subjects;
  const parcoursLevels = new Set(groupOptions.map((item) => item.levelId).filter(Boolean));
  const levelOptions = group?.levelId
    ? levels.filter((level) => level.id === group.levelId)
    : parcoursFilter && parcoursLevels.size
      ? levels.filter((level) => parcoursLevels.has(level.id))
      : levels;
  const filtering = Boolean(parcoursFilter || groupFilter);
  const shownThresholds = thresholds.filter(
    (threshold) =>
      !filtering ||
      (subjectOptions.some((subject) => subject.id === threshold.subjectId) &&
        levelOptions.some((level) => level.id === threshold.levelId)),
  );

  // Keep the form on a matière / niveau that the filters still offer.
  function applyFilters(nextParcours: string, nextGroup: string) {
    setParcoursFilter(nextParcours);
    setGroupFilter(nextGroup);
    const nextGroupRow = groups.find((item) => item.id === nextGroup);
    const nextSubjects = nextGroupRow
      ? subjects.filter((subject) => isGroupSubject(subject, nextGroupRow))
      : nextParcours
        ? subjects.filter((subject) => subject.elements.some((element) => element.parcoursId === nextParcours))
        : subjects;
    if (nextSubjects.length && !nextSubjects.some((subject) => subject.id === subjectId)) {
      setSubjectId(nextSubjects[0].id);
    }
    if (nextGroupRow?.levelId) setLevelId(nextGroupRow.levelId);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Paramètres</h1>
      <p className="mt-1 text-sm text-muted">
        Seuil d’élimination par matière et par niveau. L’avertissement est envoyé
        une absence avant ce seuil.
      </p>
      <div className="surface-card mt-6 grid max-w-3xl gap-3 rounded-xl p-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Filtrer par parcours</span>
          <select
            value={parcoursFilter}
            onChange={(event) => applyFilters(event.target.value, "")}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
            aria-label="Filtrer par parcours"
          >
            <option value="">Tous les parcours</option>
            {parcoursList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {[item.mention, item.specialty].filter(Boolean).join(" : ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Filtrer par groupe</span>
          <select
            value={groupFilter}
            onChange={(event) => applyFilters(parcoursFilter, event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
            aria-label="Filtrer par groupe"
          >
            <option value="">Tous les groupes</option>
            {groupOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end text-xs text-muted">
          {filtering ? (
            <span>
              {subjectOptions.length} matière(s) ·{" "}
              <button type="button" className="underline hover:text-ink" onClick={() => applyFilters("", "")}>
                Effacer les filtres
              </button>
            </span>
          ) : (
            "Choisissez un parcours ou un groupe pour ne voir que ses matières."
          )}
        </div>
      </div>

      <form
        onSubmit={save}
        className="surface-card mt-3 grid max-w-3xl gap-3 rounded-xl p-5 sm:grid-cols-3"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Matière</span>
          <select
            required
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
          >
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} · {subject.name}
                {group && semesterInGroup(subject, group) ? ` (S${semesterInGroup(subject, group)})` : ""}
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
            {levelOptions.map((level) => (
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
            {shownThresholds.map((threshold) => (
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
