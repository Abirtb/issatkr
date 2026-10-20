"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Level = { id: string; code: string; name: string };
type Subject = { id: string; code: string; name: string };
type Entry = { subjectId: string; levelId: string; specialty: string };

// Programme: tick the subjects taught for a level + spécialité ("1ENR1" →
// L1 + ENR). "Toutes" (empty spécialité) = every spécialité of the level.
export function CurriculumAdmin({ onSaved }: { onSaved?: () => void }) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [levelId, setLevelId] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/curriculum");
    if (!response.ok) return;
    const data = await response.json();
    setLevels(data.levels);
    setSubjects(data.subjects);
    setSpecialties(data.specialties);
    setEntries(data.entries);
    setLevelId((current) => current || data.levels[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The ticks follow the selected programme.
  useEffect(() => {
    setChecked(
      new Set(
        entries
          .filter((entry) => entry.levelId === levelId && entry.specialty === specialty)
          .map((entry) => entry.subjectId),
      ),
    );
    setMessage("");
  }, [entries, levelId, specialty]);

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const response = await fetch("/api/admin/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ levelId, specialty, subjectIds: [...checked] }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(`Programme enregistré (${data.added} ajoutée(s), ${data.removed} retirée(s)).`);
    await load();
    onSaved?.();
  }

  function addSpecialty(event: React.FormEvent) {
    event.preventDefault();
    const value = newSpecialty.trim().toUpperCase();
    if (!value) return;
    setSpecialties((current) => [...new Set([...current, value])].sort());
    setSpecialty(value);
    setNewSpecialty("");
  }

  const level = levels.find((item) => item.id === levelId);
  const programmeName = `${level?.code ?? "?"} · ${specialty || "toutes spécialités"}`;
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = subjects.filter((subject) =>
    words.every((word) => `${subject.code} ${subject.name}`.toLowerCase().includes(word)),
  );
  const saved = new Set(
    entries
      .filter((entry) => entry.levelId === levelId && entry.specialty === specialty)
      .map((entry) => entry.subjectId),
  );
  const dirty = saved.size !== checked.size || [...checked].some((id) => !saved.has(id));

  return (
    <section className="surface-card rounded-xl p-5">
      <h2 className="text-lg font-semibold">Programme par niveau et spécialité</h2>
      <p className="mt-1 text-sm text-muted">
        Cochez les matières étudiées. Exemple : la classe 1ENR1 suit le programme L1 · ENR
        (plus celui de « L1 · toutes spécialités »). Une matière peut appartenir à plusieurs programmes.
        Dans l’emploi du temps, les matières du programme de la classe sont proposées en premier.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <select value={levelId} onChange={(event) => setLevelId(event.target.value)} className="field-select" aria-label="Niveau du programme">
          {levels.map((item) => (
            <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
          ))}
        </select>
        <select value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="field-select" aria-label="Spécialité du programme">
          <option value="">Toutes les spécialités (tronc commun)</option>
          {specialties.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <form onSubmit={addSpecialty} className="flex gap-2">
          <Input value={newSpecialty} onChange={(event) => setNewSpecialty(event.target.value)} placeholder="Autre spécialité (ex. GC)" aria-label="Nouvelle spécialité" />
          <Button type="submit" size="sm" variant="secondary">Ajouter</Button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="mr-auto text-sm font-medium">
          Programme {programmeName} : {checked.size} matière(s)
        </p>
        <Input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer les matières…" className="max-w-xs" aria-label="Filtrer les matières" />
        <Button size="sm" disabled={saving || !levelId || !dirty} onClick={() => void save()}>
          {saving ? "Enregistrement…" : "Enregistrer le programme"}
        </Button>
      </div>

      <div className="mt-3 grid max-h-96 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((subject) => (
          <label key={subject.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
            <input type="checkbox" checked={checked.has(subject.id)} onChange={() => toggle(subject.id)} />
            <span className="min-w-0 truncate">
              <span className="font-medium">{subject.code}</span> · {subject.name}
            </span>
          </label>
        ))}
        {shown.length === 0 ? <p className="p-2 text-sm text-muted">Aucune matière.</p> : null}
      </div>
      {message ? <p className="mt-2 text-sm text-gold">{message}</p> : null}
      <p className="mt-2 text-xs text-muted">
        Import possible aussi : dans le fichier des matières, ajoutez les colonnes « niveau » et « spécialité »
        (une ligne par programme ; le même code peut apparaître sur plusieurs lignes).
      </p>
    </section>
  );
}
