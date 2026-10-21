"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { SESSION_HOURS, sessionsFor } from "@/lib/parcours";

type Element = {
  id: string;
  code: string;
  semester: number;
  regime: string;
  coefficient: number;
  credits: number;
  hoursLecture: number;
  hoursTutorial: number;
  hoursLab: number;
  subject: { id: string; name: string; _count: { sessions: number } };
};
type Parcours = {
  id: string;
  code: string;
  domain: string;
  mention: string;
  specialty: string;
  _count: { classes: number };
  classes: { name: string }[];
  elements: Element[];
};

const hours = (value: number) => (value ? `${String(value).replace(".", ",")} h` : "—");
const withSessions = (value: number) => (value ? `${hours(value)} · ${sessionsFor(value)} séances` : "—");

// Parcours (LI…) and their éléments d'enseignement, imported from the official
// files. Each EE is a subject of the timetable (its code = the EE code).
export function ParcoursAdmin({ onImported }: { onImported?: () => void }) {
  const [rows, setRows] = useState<Parcours[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/parcours");
    if (response.ok) setRows(await response.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function importFile(file: File) {
    setBusy(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/parcours", { method: "POST", body });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(
      [
        data.parcoursCreated || data.parcoursUpdated
          ? `Parcours : ${data.parcoursCreated} créé(s), ${data.parcoursUpdated} mis à jour.`
          : "",
        data.elementsCreated || data.elementsUpdated
          ? `Éléments d’enseignement : ${data.elementsCreated} créé(s), ${data.elementsUpdated} mis à jour (disponibles comme matières).`
          : "",
        data.classesLinked ? `${data.classesLinked} classe(s) reliée(s) à leur parcours.` : "",
        data.errorCount ? `${data.errorCount} ligne(s) rejetée(s) :` : "",
        ...(data.errors ?? []),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    await load();
    onImported?.();
  }

  async function remove(item: Parcours) {
    if (
      !window.confirm(
        `Supprimer le parcours ${item.code} et sa liste d’éléments d’enseignement ?\nLes matières et les séances déjà planifiées restent.`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/admin/parcours?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `Parcours ${item.code} supprimé.` : data.error);
    if (response.ok) await load();
  }

  return (
    <section className="surface-card rounded-xl p-5">
      <h2 className="text-lg font-semibold">Parcours</h2>
      <p className="mt-1 text-sm text-muted">
        Importez la liste des parcours (Code, Domaine, Mention, Spécialité), puis pour chaque parcours la liste
        de ses éléments d’enseignement (Code EE, Libellé, Rg, Coef, Crédit, TP, TD, Cours). Les EE deviennent des
        matières de l’emploi du temps, et les classes sont reliées à leur parcours d’après le fichier scolarité.
        Séances calculées sur {String(SESSION_HOURS).replace(".", ",")} h.
      </p>
      <FileDropZone
        className="mt-3"
        accept=".xlsx,.xls,.csv"
        file={null}
        onFile={(file) => {
          if (file) void importFile(file);
        }}
        disabled={busy}
        label={busy ? "Import en cours…" : "Glissez le fichier des parcours ou des éléments d’enseignement"}
        hint="import immédiat · XLSX, XLS"
      />
      {message ? <p className="mt-2 whitespace-pre-line text-sm text-gold">{message}</p> : null}

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">Aucun parcours importé.</p>
        ) : null}
        {rows.map((item) => {
          const semesters = [...new Set(item.elements.map((element) => element.semester))];
          const open = openId === item.id;
          return (
            <div key={item.id} className="rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.code}
                    {item.mention ? ` · ${item.mention}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {item.specialty || "Spécialité non renseignée"} · {item.elements.length} EE
                    {semesters.length ? ` (S${semesters.join(", S")})` : ""} ·{" "}
                    {item._count.classes
                      ? `classes : ${item.classes.map((cls) => cls.name).join(", ")}`
                      : "aucune classe reliée"}
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled={!item.elements.length} onClick={() => setOpenId(open ? null : item.id)}>
                  {open ? "Fermer" : "Voir les EE"}
                </Button>
                <button type="button" onClick={() => void remove(item)} className="min-h-9 px-1 text-sm text-red-700 hover:underline">
                  Supprimer
                </button>
              </div>
              {open ? (
                <div className="overflow-x-auto border-t border-border">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-surface-2 text-left text-xs text-muted">
                      <tr>
                        <th className="px-3 py-2">Code EE</th>
                        <th className="px-3 py-2">Libellé</th>
                        <th className="px-3 py-2">Rg</th>
                        <th className="px-3 py-2">Coef</th>
                        <th className="px-3 py-2">Crédit</th>
                        <th className="px-3 py-2">Cours</th>
                        <th className="px-3 py-2">TD</th>
                        <th className="px-3 py-2">TP</th>
                        <th className="px-3 py-2">Séances / classe</th>
                        <th className="px-3 py-2">Planifiées (toutes classes)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semesters.map((semester) => {
                        const list = item.elements.filter((element) => element.semester === semester);
                        const total = (pick: (element: Element) => number) => list.reduce((sum, element) => sum + pick(element), 0);
                        return (
                          <Fragment key={semester}>
                            <tr className="bg-surface-2/60">
                              <td colSpan={10} className="px-3 py-1.5 text-xs font-semibold">
                                Semestre {semester} · {list.length} EE · {total((element) => element.credits)} crédits ·{" "}
                                {sessionsFor(total((element) => element.hoursLecture + element.hoursTutorial + element.hoursLab))} séances
                              </td>
                            </tr>
                            {list.map((element) => {
                              const required = sessionsFor(element.hoursLecture + element.hoursTutorial + element.hoursLab);
                              return (
                                <tr key={element.id} className="border-t border-border">
                                  <td className="px-3 py-2 font-mono text-xs">{element.code}</td>
                                  <td className="px-3 py-2">{element.subject.name}</td>
                                  <td className="px-3 py-2">{element.regime || "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{String(element.coefficient).replace(".", ",")}</td>
                                  <td className="px-3 py-2 tabular-nums">{String(element.credits).replace(".", ",")}</td>
                                  <td className="px-3 py-2 tabular-nums">{withSessions(element.hoursLecture)}</td>
                                  <td className="px-3 py-2 tabular-nums">{withSessions(element.hoursTutorial)}</td>
                                  <td className="px-3 py-2 tabular-nums">{withSessions(element.hoursLab)}</td>
                                  <td className="px-3 py-2 tabular-nums">{required}</td>
                                  <td className="px-3 py-2 tabular-nums">{element.subject._count.sessions}</td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
