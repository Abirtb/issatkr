"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Att = {
  id: string;
  present: boolean;
  justification: string | null;
  justificationFile: string | null;
  justificationFileName: string | null;
  student: {
    firstName: string;
    lastName: string;
    matricule: string;
    class: { name: string };
  };
  session: { courseName: string; date: string; startTime: string };
};

type ClassOption = { id: string; name: string };

const statusOptions = [
  { value: "all-absent", label: "Toutes les absences" },
  { value: "absent", label: "Absences non justifiées" },
  { value: "justified", label: "Absences justifiées" },
  { value: "present", label: "Présents" },
  { value: "", label: "Toutes les saisies" },
];

export function AdminAttendance() {
  const [rows, setRows] = useState<Att[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("all-absent");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, classId, status });
    const res = await fetch(`/api/admin/attendance?${params}`);
    const data = await res.json();
    setRows(res.ok ? data : []);
  }, [q, classId, status]);

  useEffect(() => {
    void load();
    // Only refetch automatically when filters change, not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, status]);

  useEffect(() => {
    fetch("/api/admin/classes")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ClassOption[]) => setClasses(data));
  }, []);

  async function run(id: string, request: Promise<Response>, success: string) {
    setBusyId(id);
    setMessage("");
    const response = await request;
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    setMessage(response.ok ? success : (data.error ?? "Opération impossible"));
    if (response.ok) await load();
  }

  function patch(
    id: string,
    data: { present?: boolean; justification?: string },
    success: string,
  ) {
    return run(
      id,
      fetch("/api/admin/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      }),
      success,
    );
  }

  function uploadJustificatif(id: string, file: File) {
    const form = new FormData();
    form.set("id", id);
    form.set("file", file);
    return run(
      id,
      fetch("/api/admin/attendance/justificatif", { method: "POST", body: form }),
      "Justificatif importé — absence justifiée",
    );
  }

  function removeJustificatif(id: string) {
    if (!window.confirm("Supprimer ce justificatif ?")) return;
    return run(
      id,
      fetch(`/api/admin/attendance/justificatif?id=${id}`, { method: "DELETE" }),
      "Justificatif supprimé",
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Absences</h1>
      <p className="mt-1 text-sm text-muted">
        Importez un justificatif (PDF ou image) pour justifier une absence, ou
        corrigez une saisie.
      </p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, matricule, CIN, matière…"
          className="sm:max-w-sm"
        />
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          className="field-select sm:max-w-[200px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="field-select sm:max-w-[220px]"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="w-full sm:w-auto">
          Chercher
        </Button>
      </form>

      {message ? (
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">{message}</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {rows.map((a) => {
          const busy = busyId === a.id;
          const justified = !a.present && Boolean(a.justification);
          return (
            <div key={a.id} className="surface-card rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {a.student.lastName} {a.student.firstName} ·{" "}
                    {a.student.matricule}
                  </p>
                  <p className="text-sm text-muted">
                    {a.session.courseName} ·{" "}
                    {new Date(a.session.date).toLocaleDateString("fr-FR")} ·{" "}
                    {a.session.startTime} · {a.student.class.name}
                  </p>
                </div>
                <span
                  className={
                    a.present
                      ? "text-green-700"
                      : justified
                        ? "text-amber-600"
                        : "text-red-600"
                  }
                >
                  {a.present
                    ? "Présent"
                    : justified
                      ? "Absence justifiée"
                      : "Absent"}
                </span>
              </div>

              {!a.present ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={
                        busy ? "pointer-events-none opacity-60" : "cursor-pointer"
                      }
                    >
                      <span className="inline-flex h-9 items-center rounded-lg bg-gold px-3 text-sm font-medium text-navy-deep">
                        {busy
                          ? "Envoi…"
                          : a.justificationFile
                            ? "Remplacer le justificatif"
                            : "Importer justificatif"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadJustificatif(a.id, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {a.justificationFile ? (
                      <>
                        <a
                          href={`/api/admin/attendance/justificatif?id=${a.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center text-sm text-navy hover:underline"
                        >
                          Voir « {a.justificationFileName ?? "justificatif"} »
                        </a>
                        <button
                          type="button"
                          className="min-h-9 text-sm text-red-700 hover:underline"
                          onClick={() => void removeJustificatif(a.id)}
                        >
                          Supprimer
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Motif (certificat médical, …)"
                      value={drafts[a.id] ?? a.justification ?? ""}
                      onChange={(event) =>
                        setDrafts({ ...drafts, [a.id]: event.target.value })
                      }
                      className="max-w-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || drafts[a.id] === undefined}
                      onClick={() =>
                        void patch(
                          a.id,
                          { justification: drafts[a.id] ?? "" },
                          "Motif enregistré",
                        ).then(() =>
                          setDrafts((current) => {
                            const next = { ...current };
                            delete next[a.id];
                            return next;
                          }),
                        )
                      }
                    >
                      Enregistrer le motif
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      className="sm:ml-auto"
                      onClick={() =>
                        void patch(
                          a.id,
                          { present: true },
                          "Saisie corrigée : présent",
                        )
                      }
                    >
                      Corriger : présent
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  disabled={busy}
                  onClick={() =>
                    void patch(a.id, { present: false }, "Saisie corrigée : absent")
                  }
                >
                  Marquer absent
                </Button>
              )}
            </div>
          );
        })}
        {rows.length === 0 ? (
          <p className="text-muted">Aucune saisie trouvée.</p>
        ) : null}
      </div>
    </div>
  );
}
