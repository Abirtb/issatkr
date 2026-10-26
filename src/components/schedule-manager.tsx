"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Input } from "@/components/ui/input";
import { CalendarPanel, type DayOff, type Period } from "@/components/schedule/calendar-panel";
import { isGroupSubject, semesterInGroup } from "@/lib/group-subjects";

type Option = { id: string; name: string; code?: string; email?: string };
type ClassOption = Option & {
  levelId: string | null;
  parcoursId: string | null;
  semester: number | null;
  level: { code: string } | null;
};
type SubjectOption = Option & {
  curricula: { levelId: string; specialty: string }[];
  elements: { parcoursId: string; semester: number }[];
};
type ScheduleRow = {
  id: string;
  classId: string;
  professorId: string | null;
  subjectId: string | null;
  weeklySlotId: string | null;
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
type WeeklyRow = {
  id: string;
  periodId: string;
  classId: string;
  subjectId: string;
  professorId: string | null;
  weekday: number;
  intervalWeeks: number;
  weekOffset: number;
  startTime: string;
  endTime: string | null;
  room: string | null;
  period: { id: string; name: string };
  class: Option;
  subject: Option;
  professor: Option | null;
  _count: { sessions: number };
};

const weekdays = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Frequency of a weekly course: "interval-offset".
const frequencies = [
  ["1-0", "Chaque semaine"],
  ["2-0", "1 semaine sur 2 : semaines 1, 3, 5… (A)"],
  ["2-1", "1 semaine sur 2 : semaines 2, 4, 6… (B)"],
] as const;
function frequencyLabel(slot: { intervalWeeks: number; weekOffset: number }) {
  if (slot.intervalWeeks === 1) return "";
  return slot.weekOffset ? " · 1 semaine sur 2 (B)" : " · 1 semaine sur 2 (A)";
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function today() {
  return toKey(new Date());
}
// Monday of the week containing `key`.
function mondayOf(key: string) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toKey(date);
}
function shift(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toKey(date);
}
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const emptyForm = {
  id: "",
  // "once": a single date; "weekly": every week during a semester.
  mode: "once" as "once" | "weekly",
  classId: "",
  professorId: "",
  subjectId: "",
  date: today(),
  periodId: "",
  weekday: "1",
  frequency: "1-0",
  startTime: "08:30",
  endTime: "10:00",
  room: "",
};

export function ScheduleManager() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [professors, setProfessors] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [sessions, setSessions] = useState<ScheduleRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [week, setWeek] = useState(() => mondayOf(today()));
  const [classFilter, setClassFilter] = useState("");
  // Matière list: the group's own subjects, unless "Afficher toutes les matières".
  const [allSubjects, setAllSubjects] = useState(false);

  const loadSessions = useCallback(async () => {
    const params = new URLSearchParams({ from: week, to: shift(week, 6) });
    if (classFilter) params.set("classId", classFilter);
    const response = await fetch(`/api/schedule?${params}`);
    const data = await response.json();
    setSessions(response.ok ? data : []);
  }, [week, classFilter]);

  const loadCalendar = useCallback(async () => {
    const [periodsResponse, daysOffResponse, weeklyResponse] = await Promise.all([
      fetch("/api/schedule/periods"),
      fetch("/api/schedule/days-off"),
      fetch("/api/schedule/weekly"),
    ]);
    const [periodsData, daysOffData, weeklyData] = await Promise.all([
      periodsResponse.json(),
      daysOffResponse.json(),
      weeklyResponse.json(),
    ]);
    if (periodsResponse.ok) {
      setPeriods(periodsData);
      setForm((current) => ({ ...current, periodId: current.periodId || periodsData[0]?.id || "" }));
    }
    if (daysOffResponse.ok) setDaysOff(daysOffData);
    if (weeklyResponse.ok) setWeekly(weeklyData);
  }, []);

  useEffect(() => {
    fetch("/api/schedule/options")
      .then((response) => (response.ok ? response.json() : null))
      .then((options) => {
        if (!options) return;
        setClasses(options.classes);
        setProfessors(options.professors);
        setSubjects(options.subjects);
        setForm((current) => ({
          ...current,
          classId: current.classId || options.classes[0]?.id || "",
          professorId: current.professorId || options.professors[0]?.id || "",
          subjectId: current.subjectId || options.subjects[0]?.id || "",
        }));
      });
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function reloadAll() {
    await Promise.all([loadCalendar(), loadSessions()]);
  }

  function resetForm() {
    setForm((current) => ({
      ...emptyForm,
      mode: current.mode,
      classId: current.classId,
      professorId: current.professorId,
      subjectId: current.subjectId,
      periodId: current.periodId,
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const weeklyMode = form.mode === "weekly";
    const [intervalWeeks, weekOffset] = form.frequency.split("-").map(Number);
    const response = await fetch(weeklyMode ? "/api/schedule/weekly" : "/api/schedule", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: form.id || undefined, intervalWeeks, weekOffset }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(
      weeklyMode
        ? `${form.id ? "Cours hebdomadaire modifié" : "Cours hebdomadaire ajouté"} : ${data.message}`
        : [form.id ? "Séance modifiée" : "Séance ajoutée", data.warning].filter(Boolean).join(". "),
    );
    resetForm();
    await reloadAll();
  }

  function editSession(session: ScheduleRow) {
    setForm({
      ...emptyForm,
      mode: "once",
      id: session.id,
      classId: session.classId,
      professorId: session.professorId ?? "",
      subjectId: session.subjectId ?? "",
      date: session.date.slice(0, 10),
      startTime: session.startTime,
      endTime: session.endTime ?? "",
      room: session.room ?? "",
    });
    if (session.weeklySlotId) {
      setMessage("Cette séance vient d’un cours hebdomadaire : la modifier ne change que cette date.");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editWeekly(slot: WeeklyRow) {
    setForm({
      ...emptyForm,
      mode: "weekly",
      id: slot.id,
      periodId: slot.periodId,
      classId: slot.classId,
      professorId: slot.professorId ?? "",
      subjectId: slot.subjectId,
      weekday: String(slot.weekday),
      frequency: `${slot.intervalWeeks}-${slot.intervalWeeks === 1 ? 0 : slot.weekOffset}`,
      startTime: slot.startTime,
      endTime: slot.endTime ?? "",
      room: slot.room ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeSession(session: ScheduleRow) {
    const note = session.weeklySlotId ? "\nSeule cette date est supprimée ; le cours continue les autres semaines." : "";
    if (!window.confirm(`Supprimer cette séance ?${note}`)) return;
    const response = await fetch(`/api/schedule?id=${session.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Séance supprimée" : data.error);
    if (response.ok) await reloadAll();
  }

  async function removeWeekly(slot: WeeklyRow) {
    if (
      !window.confirm(
        `Arrêter le cours « ${slot.subject.name} » du ${weekdays[slot.weekday].toLowerCase()} pour ${slot.class.name} ?\nLes séances futures non pointées seront retirées ; les séances passées restent.`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/schedule/weekly?id=${slot.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `Cours arrêté (${data.removed} séance(s) future(s) retirée(s)).` : data.error);
    if (response.ok) await reloadAll();
  }

  async function importSchedule(file: File) {
    setImporting(true);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/emploi", { method: "POST", body });
    const data = await response.json();
    setImporting(false);
    setMessage(
      response.ok
        ? `${data.created} séances créées · ${data.updated} mises à jour · ${data.skipped} ignorées${data.errors?.length ? `\n${data.errors.join("\n")}` : ""}`
        : data.error,
    );
    if (response.ok) await reloadAll();
  }

  const selectClass = "h-10 rounded-lg border border-border bg-surface px-3 text-sm";
  // The selected group's subjects: the EE of its parcours for its level (year
  // of study: S1-S2 → 1, S3-S4 → 2…), plus its programme (lib/group-subjects).
  const selectedClass = classes.find((item) => item.id === form.classId);
  const semesterIn = (subject: SubjectOption) => (selectedClass ? semesterInGroup(subject, selectedClass) : undefined);
  const inProgramme = (subject: SubjectOption) => Boolean(selectedClass) && isGroupSubject(subject, selectedClass!);
  const programmeSubjects = subjects.filter(inProgramme);
  const otherSubjects = subjects.filter((subject) => !inProgramme(subject));
  // Only the group's subjects when it has some (or everything on request).
  const groupOnly = Boolean(selectedClass) && programmeSubjects.length > 0 && !allSubjects;
  const programmeGroups = [...new Set(programmeSubjects.map((subject) => semesterIn(subject) ?? 0))]
    .sort((a, b) => a - b)
    .map((semester) => ({
      label: semester ? `${selectedClass?.name} · Semestre ${semester}` : `${selectedClass?.name} · Programme`,
      items: programmeSubjects.filter((subject) => (semesterIn(subject) ?? 0) === semester),
    }));

  function chooseClass(classId: string) {
    const next = classes.find((item) => item.id === classId);
    setForm((current) => ({ ...current, classId }));
    setAllSubjects(false);
    // A subject that is not the new group's is cleared.
    if (next && form.subjectId) {
      const subject = subjects.find((item) => item.id === form.subjectId);
      const keeps =
        subject &&
        (subject.elements.some((element) => element.parcoursId === next.parcoursId) ||
          subject.curricula.some((entry) => entry.levelId === next.levelId));
      if (!keeps) setForm((current) => ({ ...current, classId, subjectId: "" }));
    }
  }
  const weeklyShown = weekly.filter((slot) => !classFilter || slot.classId === classFilter);
  const weekDaysOff = daysOff.filter((item) => item.startDate <= shift(week, 6) && item.endDate >= week);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Emploi du temps</h1>
        <p className="mt-1 text-sm text-muted">
          Planifiez une séance à une date précise, ou un cours qui se répète chaque semaine pendant un semestre.
        </p>
      </div>

      <CalendarPanel periods={periods} daysOff={daysOff} onChange={reloadAll} onMessage={setMessage} />

      <form onSubmit={save} className="surface-card grid gap-3 rounded-xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1 sm:col-span-2 lg:col-span-4" role="tablist">
          {([
            ["once", "Une date précise"],
            ["weekly", "Chaque semaine"],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={form.mode === mode}
              disabled={Boolean(form.id) && form.mode !== mode}
              onClick={() => setForm({ ...form, mode })}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-40 ${form.mode === mode ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <select required value={form.classId} onChange={(event) => chooseClass(event.target.value)} className={selectClass} aria-label="Classe">
          <option value="">Classe</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select required value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })} className={selectClass} aria-label="Matière">
          <option value="">{selectedClass && !programmeSubjects.length ? "Matière (aucune liée à ce groupe)" : "Matière"}</option>
          {selectedClass && programmeSubjects.length
            ? programmeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                  ))}
                </optgroup>
              ))
            : null}
          {!groupOnly ? (
            <optgroup label={programmeSubjects.length ? "Autres matières" : "Toutes les matières"}>
              {otherSubjects.map((item) => (
                <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <select required value={form.professorId} onChange={(event) => setForm({ ...form, professorId: event.target.value })} className={selectClass} aria-label="Enseignant">
          <option value="">Enseignant</option>
          {professors.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>

        {form.mode === "weekly" ? (
          <>
            <select required value={form.periodId} onChange={(event) => setForm({ ...form, periodId: event.target.value })} className={selectClass} aria-label="Semestre">
              <option value="">{periods.length ? "Semestre" : "Ajoutez d’abord un semestre"}</option>
              {periods.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select required value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })} className={selectClass} aria-label="Jour">
              {weekdays.slice(1).map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </select>
            <select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })} className={selectClass} aria-label="Fréquence">
              {frequencies.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </>
        ) : (
          <Input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} aria-label="Date" />
        )}

        <Input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} aria-label="Début" />
        <Input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} aria-label="Fin" />
        <Input placeholder="Salle (facultatif)" value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {form.id ? "Enregistrer" : form.mode === "weekly" ? "Ajouter le cours" : "Ajouter la séance"}
          </Button>
          {form.id ? (
            <Button type="button" variant="secondary" onClick={resetForm}>Annuler</Button>
          ) : null}
        </div>
        {selectedClass && programmeSubjects.length ? (
          <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2 lg:col-span-4">
            <input type="checkbox" checked={allSubjects} onChange={(event) => setAllSubjects(event.target.checked)} />
            Afficher toutes les matières (pas seulement celles du parcours et du niveau de {selectedClass.name})
          </label>
        ) : null}
        {form.mode === "weekly" ? (
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">
            Les séances sont créées pour chaque semaine (ou une semaine sur deux) du semestre à partir d’aujourd’hui, sauf les jours fériés et vacances. Les semaines A et B sont comptées depuis le début du semestre.
            Une modification ne touche que les séances futures non pointées.
          </p>
        ) : null}
      </form>

      <div>
        <FileDropZone
          accept=".csv,.xls,.xlsx"
          file={null}
          onFile={(file) => {
            if (file) void importSchedule(file);
          }}
          disabled={importing}
          label={importing ? "Import en cours…" : "Glissez un emploi du temps (séances à date fixe)"}
          hint="import immédiat · CSV, XLS, XLSX"
        />
        <p className="mt-1 text-xs text-muted">Colonnes : classe, code, date, heure_debut, heure_fin, salle, enseignant_email</p>
      </div>
      {message ? <p className="whitespace-pre-line text-sm text-gold">{message}</p> : null}

      <div className="surface-card flex flex-wrap items-center gap-3 rounded-xl p-4">
        <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className={selectClass} aria-label="Filtrer par classe">
          <option value="">Toutes les classes</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <span className="text-sm text-muted">
          {weeklyShown.length} cours hebdomadaire(s)
        </span>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Cours hebdomadaires</h2>
        <div className="space-y-2">
          {weeklyShown.map((slot) => (
            <div key={slot.id} className="surface-card flex flex-wrap items-center gap-3 rounded-xl p-4">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <p className="font-medium">
                  {weekdays[slot.weekday]} {slot.startTime}
                  {slot.endTime ? `–${slot.endTime}` : ""} · {slot.subject.name} · {slot.class.name}
                  {frequencyLabel(slot)}
                </p>
                <p className="text-sm text-muted">
                  {slot.professor?.name ?? "Enseignant non affecté"}
                  {slot.room ? ` · ${slot.room}` : ""} · {slot.period.name} · {slot._count.sessions} séance(s)
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => editWeekly(slot)}>Modifier</Button>
              <Button size="sm" variant="danger" onClick={() => void removeWeekly(slot)}>Arrêter</Button>
            </div>
          ))}
          {weeklyShown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              Aucun cours hebdomadaire. Choisissez « Chaque semaine » dans le formulaire.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">
            Séances du {shortDay(week)} au {shortDay(shift(week, 6))}
          </h2>
          <Button size="sm" variant="secondary" onClick={() => setWeek(shift(week, -7))} aria-label="Semaine précédente">← Précédente</Button>
          <Button size="sm" variant="secondary" onClick={() => setWeek(mondayOf(today()))}>Cette semaine</Button>
          <Button size="sm" variant="secondary" onClick={() => setWeek(shift(week, 7))} aria-label="Semaine suivante">Suivante →</Button>
        </div>
        {weekDaysOff.length ? (
          <p className="mb-2 text-sm text-muted">
            Non travaillé cette semaine : {weekDaysOff.map((item) => item.label).join(", ")}
          </p>
        ) : null}
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="surface-card flex flex-wrap items-center gap-3 rounded-xl p-4">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <p className="font-medium">
                  {session.subject?.name ?? session.class.name} · {session.class.name}
                </p>
                <p className="text-sm text-muted">
                  {new Date(session.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} ·{" "}
                  {session.startTime}
                  {session.endTime ? `–${session.endTime}` : ""} · {session.professor?.name ?? "Enseignant non affecté"}
                  {session.room ? ` · ${session.room}` : ""}
                </p>
              </div>
              {session.weeklySlotId ? <Badge tone="navy">Hebdomadaire</Badge> : null}
              <span className="mr-auto text-xs text-muted sm:mr-0">
                {session._count.attendances ? `${session._count.attendances} pointages` : "Non pointée"}
              </span>
              <Button size="sm" variant="secondary" onClick={() => editSession(session)}>Modifier</Button>
              <Button size="sm" variant="danger" onClick={() => void removeSession(session)}>Supprimer</Button>
            </div>
          ))}
          {sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
              Aucune séance cette semaine.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
