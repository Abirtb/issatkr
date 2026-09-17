"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatLongDate, sessions } from "@/lib/data";

export function AttendanceHub() {
  const upcoming = sessions.filter((s) => !s.recorded);
  const past = sessions.filter((s) => s.recorded);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Présence</h1>
        <p className="mt-1 text-sm text-muted">
          Choisissez une séance. L’enregistrement est conçu pour une tablette en amphi.
        </p>
      </div>

      <h2 className="mb-3 text-sm font-medium text-muted">À saisir</h2>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarClock size={20} />}
          title="Aucune séance à venir"
          description="Il n’y a pas de séance planifiée pour le moment."
        />
      ) : (
        <div className="mb-10 grid gap-3">
          {upcoming.map((session) => (
            <div
              key={session.id}
              className="surface-card flex flex-col gap-4 rounded-[16px] p-5 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold tracking-tight">{session.course}</p>
                  <Badge tone="gold">{session.courseCode}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {session.group} · {session.room} · {session.startTime}–{session.endTime}
                </p>
                <p className="mt-1 text-xs capitalize text-muted">
                  {formatLongDate(session.date)}
                </p>
              </div>
              <Link href={`/attendance/${session.id}`}>
                <Button size="lg" className="w-full sm:w-auto">
                  Ouvrir
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium text-muted">Déjà enregistrées</h2>
      <div className="grid gap-3">
        {past.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-5 py-4"
          >
            <div>
              <p className="font-medium">{session.course}</p>
              <p className="text-sm text-muted">
                {session.group} · {formatLongDate(session.date)}
              </p>
            </div>
            <Badge tone="ok">Validée</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
