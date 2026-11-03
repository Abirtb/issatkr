"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  _count: { weeklySlots: number };
};
export type DayOff = { id: string; label: string; startDate: string; endDate: string };

const formatDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const emptyPeriod = { id: "", name: "", startDate: "", endDate: "" };
const emptyDayOff = { label: "", startDate: "", endDate: "" };

// Semesters (when weekly courses repeat) and days off (when they don't).
export function CalendarPanel({
  periods,
  daysOff,
  onChange,
  onMessage,
}: {
  periods: Period[];
  daysOff: DayOff[];
  onChange: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const [period, setPeriod] = useState(emptyPeriod);
  const [dayOff, setDayOff] = useState(emptyDayOff);

  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    return { ok: response.ok, data };
  }

  async function savePeriod(event: React.FormEvent) {
    event.preventDefault();
    const { ok, data } = await send("/api/schedule/periods", period.id ? "PATCH" : "POST", {
      ...period,
      id: period.id || undefined,
    });
    if (!ok) return onMessage(data.error);
    onMessage(period.id ? `Semestre modifié. ${data.message}` : "Semestre ajouté.");
    setPeriod(emptyPeriod);
    await onChange();
  }

  async function removePeriod(item: Period) {
    if (
      !window.confirm(
        `Supprimer « ${item.name} » et ses ${item._count.weeklySlots} cours hebdomadaire(s) ?\nLes séances futures non pointées seront retirées ; les séances passées restent.`,
      )
    ) {
      return;
    }
    const { ok, data } = await send(`/api/schedule/periods?id=${item.id}`, "DELETE");
    onMessage(ok ? `Semestre supprimé (${data.removed} séance(s) future(s) retirée(s)).` : data.error);
    if (ok) await onChange();
  }

  async function addDayOff(event: React.FormEvent) {
    event.preventDefault();
    const { ok, data } = await send("/api/schedule/days-off", "POST", dayOff);
    if (!ok) return onMessage(data.error);
    onMessage(`« ${dayOff.label} » ajouté. ${data.message}`);
    setDayOff(emptyDayOff);
    await onChange();
  }

  async function removeDayOff(item: DayOff) {
    if (!window.confirm(`Retirer « ${item.label} » ? Les cours hebdomadaires de ces jours seront replanifiés.`)) return;
    const { ok, data } = await send(`/api/schedule/days-off?id=${item.id}`, "DELETE");
    onMessage(ok ? `« ${item.label} » retiré. ${data.message}` : data.error);
    if (ok) await onChange();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="surface-card rounded-xl p-5">
        <h2 className="font-semibold">Semestres</h2>
        <p className="mt-1 text-xs text-muted">
          Les cours hebdomadaires se répètent entre ces deux dates.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {periods.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.name}</span>
                <span className="block text-xs text-muted">
                  {formatDay(item.startDate)} → {formatDay(item.endDate)} · {item._count.weeklySlots} cours
                </span>
              </span>
              <button type="button" className="text-navy hover:underline" onClick={() => setPeriod(item)}>
                Modifier
              </button>
              <button type="button" className="text-red-700 hover:underline" onClick={() => void removePeriod(item)}>
                Supprimer
              </button>
            </li>
          ))}
          {periods.length === 0 ? <li className="py-2 text-muted">Aucun semestre.</li> : null}
        </ul>
        <form onSubmit={savePeriod} className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input
            required
            placeholder="S1 2025-2026"
            value={period.name}
            onChange={(event) => setPeriod({ ...period, name: event.target.value })}
            className="sm:col-span-3"
            aria-label="Nom du semestre"
          />
          <label className="text-xs text-muted">
            Début
            <Input required type="date" value={period.startDate} onChange={(event) => setPeriod({ ...period, startDate: event.target.value })} />
          </label>
          <label className="text-xs text-muted">
            Fin
            <Input required type="date" value={period.endDate} onChange={(event) => setPeriod({ ...period, endDate: event.target.value })} />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" className="flex-1">
              {period.id ? "Enregistrer" : "Ajouter"}
            </Button>
            {period.id ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => setPeriod(emptyPeriod)}>
                Annuler
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="surface-card rounded-xl p-5">
        <h2 className="font-semibold">Jours fériés et vacances</h2>
        <p className="mt-1 text-xs text-muted">
          Aucun cours hebdomadaire n’est planifié ces jours-là.
        </p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {daysOff.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{item.label}</span>
                <span className="block text-xs text-muted">
                  {item.startDate === item.endDate
                    ? formatDay(item.startDate)
                    : `${formatDay(item.startDate)} → ${formatDay(item.endDate)}`}
                </span>
              </span>
              <button type="button" className="text-red-700 hover:underline" onClick={() => void removeDayOff(item)}>
                Retirer
              </button>
            </li>
          ))}
          {daysOff.length === 0 ? <li className="py-2 text-muted">Aucun jour non travaillé.</li> : null}
        </ul>
        <form onSubmit={addDayOff} className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input
            required
            placeholder="Vacances d’hiver, Fête de l’indépendance…"
            value={dayOff.label}
            onChange={(event) => setDayOff({ ...dayOff, label: event.target.value })}
            className="sm:col-span-3"
            aria-label="Libellé"
          />
          <label className="text-xs text-muted">
            Du
            <Input required type="date" value={dayOff.startDate} onChange={(event) => setDayOff({ ...dayOff, startDate: event.target.value })} />
          </label>
          <label className="text-xs text-muted">
            Au (vide = 1 jour)
            <Input type="date" value={dayOff.endDate} min={dayOff.startDate} onChange={(event) => setDayOff({ ...dayOff, endDate: event.target.value })} />
          </label>
          <div className="flex items-end">
            <Button type="submit" size="sm" className="w-full">
              Ajouter
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
