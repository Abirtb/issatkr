"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string; code?: string; email?: string };
type ScheduleRow = {
  id: string;
  classId: string;
  professorId: string | null;
  subjectId: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
  finalizedAt: string | null;
  class: Option;
  professor: Option | null;
  subject: Option | null;
  _count: { attendances: number };
};

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const emptyForm = {
  id: "",
  classId: "",
  professorId: "",
  subjectId: "",
  date: today(),
  startTime: "08:30",
  endTime: "10:00",
  room: "",
};

export function ScheduleManager() {
  const [classes, setClasses] = useState<Option[]>([]);
  const [professors, setProfessors] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [sessions, setSessions] = useState<ScheduleRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const [optionsResponse, sessionsResponse] = await Promise.all([
      fetch("/api/schedule/options"),
      fetch("/api/schedule"),
    ]);
    const options = await optionsResponse.json();
    const schedule = await sessionsResponse.json();
    if (optionsResponse.ok) {
      setClasses(options.classes);
      setProfessors(options.professors);
      setSubjects(options.subjects);
      setForm((current) => ({
        ...current,
        classId: current.classId || options.classes[0]?.id || "",
        professorId: current.professorId || options.professors[0]?.id || "",
        subjectId: current.subjectId || options.subjects[0]?.id || "",
      }));
    }
    setSessions(sessionsResponse.ok ? schedule : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/schedule", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setMessage(
      response.ok
        ? form.id
          ? "Séance modifiée"
          : "Séance ajoutée"
        : data.error,
    );
    if (response.ok) {
      setForm((current) => ({
        ...emptyForm,
        classId: current.classId,
        professorId: current.professorId,
        subjectId: current.subjectId,
      }));
      await load();
    }
  }

  function edit(session: ScheduleRow) {
    setForm({
      id: session.id,
      classId: session.classId,
      professorId: session.professorId ?? "",
      subjectId: session.subjectId ?? "",
      date: session.date.slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime ?? "",
      room: session.room ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette séance ?")) return;
    const response = await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Séance supprimée" : data.error);
    if (response.ok) await load();
  }

  async function importSchedule(file: File) {
    setImporting(true);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/emploi", {
      method: "POST",
      body,
    });
    const data = await response.json();
    setImporting(false);
    setMessage(
      response.ok
        ? `${data.created} séances créées · ${data.updated} mises à jour · ${data.skipped} ignorées${data.errors?.length ? `\n${data.errors.join("\n")}` : ""}`
        : data.error,
    );
    if (response.ok) await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Emploi du temps</h1>
      <p className="mt-1 text-sm text-muted">
        Associez une matière, une classe et un enseignant à chaque séance.
      </p>

      <form
        onSubmit={save}
        className="surface-card mt-6 grid gap-3 rounded-xl p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <select
          required
          value={form.classId}
          onChange={(event) => setForm({ ...form, classId: event.target.value })}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Classe</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          required
          value={form.subjectId}
          onChange={(event) =>
            setForm({ ...form, subjectId: event.target.value })
          }
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Matière</option>
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
        <select
          required
          value={form.professorId}
          onChange={(event) =>
            setForm({ ...form, professorId: event.target.value })
          }
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">Enseignant</option>
          {professors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Input
          required
          type="date"
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />
        <Input
          required
          type="time"
          value={form.startTime}
          onChange={(event) =>
            setForm({ ...form, startTime: event.target.value })
          }
        />
        <Input
          type="time"
          value={form.endTime}
          onChange={(event) =>
            setForm({ ...form, endTime: event.target.value })
          }
        />
        <Input
          placeholder="Salle (facultatif)"
          value={form.room}
          onChange={(event) => setForm({ ...form, room: event.target.value })}
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {form.id ? "Enregistrer" : "Ajouter la séance"}
          </Button>
          {form.id ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setForm(emptyForm)}
            >
              Annuler
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-4 flex items-center gap-3">
        <label className="cursor-pointer">
          <span className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm">
            {importing ? "Import…" : "Importer Excel/CSV"}
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSchedule(file);
              event.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-muted">
          Colonnes : classe, code, date, heure_debut, enseignant_email
        </p>
      </div>
      {message ? (
        <p className="mt-3 whitespace-pre-line text-sm text-gold">{message}</p>
      ) : null}

      <div className="mt-6 space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="surface-card flex flex-wrap items-center gap-3 rounded-xl p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {session.subject?.name ?? session.class.name} ·{" "}
                {session.class.name}
              </p>
              <p className="text-sm text-muted">
                {new Date(session.date).toLocaleDateString("fr-FR")} ·{" "}
                {session.startTime}
                {session.endTime ? `–${session.endTime}` : ""} ·{" "}
                {session.professor?.name ?? "Enseignant non affecté"}
                {session.room ? ` · ${session.room}` : ""}
              </p>
            </div>
            <span className="text-xs text-muted">
              {session._count.attendances
                ? `${session._count.attendances} pointages`
                : "Non pointée"}
            </span>
            <Button size="sm" variant="secondary" onClick={() => edit(session)}>
              Modifier
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void remove(session.id)}
            >
              Supprimer
            </Button>
          </div>
        ))}
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
            Aucune séance planifiée.
          </p>
        ) : null}
      </div>
    </div>
  );
}
