"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  courseBreakdown,
  getStudent,
  studentTimeline,
  warningCopy,
} from "@/lib/data";
import type { AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const statusLabel: Record<AttendanceStatus, string> = {
  present: "Présent",
  absent: "Absent",
  late: "Retard",
  excused: "Excusé",
  unset: "—",
};

export function StudentProfile({ id }: { id: string }) {
  const student = getStudent(id);
  if (!student) {
    return <p className="text-muted">Étudiant introuvable.</p>;
  }

  const timeline = studentTimeline[student.id] ?? [];
  const ring = Math.min(100, student.attendanceRate);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/students" className="text-sm text-muted hover:text-ink">
        ← Étudiants
      </Link>

      <Card className="overflow-hidden">
        <div className="h-20 bg-navy-deep" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="-mt-10">
            <div className="rounded-full ring-4 ring-surface">
              <Avatar firstName={student.firstName} lastName={student.lastName} size="xl" />
            </div>
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {student.firstName} {student.lastName}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {student.registrationNumber} · {student.program} · {student.group} · {student.year}
            </p>
          </div>
          <Badge
            tone={
              student.warningLevel === "critical"
                ? "critical"
                : student.warningLevel === "warning"
                  ? "warn"
                  : student.warningLevel === "watch"
                    ? "gold"
                    : "ok"
            }
            className="mb-1 self-start sm:self-auto"
          >
            {warningCopy[student.warningLevel]}
          </Badge>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="px-5 py-5">
          <p className="text-sm text-muted">Assiduité</p>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="relative h-16 w-16 rounded-full"
              style={{
                background: `conic-gradient(var(--gold) ${ring * 3.6}deg, var(--surface-2) 0)`,
              }}
            >
              <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-surface text-sm font-semibold">
                {student.attendanceRate}%
              </div>
            </div>
            <p className="text-xs text-muted">sur l’ensemble des séances</p>
          </div>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-sm text-muted">Absences</p>
          <p className="mt-3 text-[32px] font-semibold tracking-tight">{student.absences}</p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-sm text-muted">Retards</p>
          <p className="mt-3 text-[32px] font-semibold tracking-tight">{student.lateArrivals}</p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-sm text-muted">Niveau d’alerte</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">
            {warningCopy[student.warningLevel]}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Historique récent" subtitle="Dernières séances enregistrées" />
          {timeline.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                icon={<CalendarClock size={20} />}
                title="Aucune présence enregistrée"
                description="Les séances de cet étudiant apparaîtront ici dès qu’elles seront saisies."
                className="border-0 py-10"
              />
            </div>
          ) : (
            <div className="px-5 pb-5">
              <ol className="relative space-y-0 border-l border-border ml-2">
                {timeline.map((item) => (
                  <li key={item.id} className="relative pb-5 pl-6 last:pb-0">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full",
                        item.status === "present" && "bg-navy dark:bg-gold",
                        item.status === "late" && "bg-gold",
                        item.status === "absent" && "bg-[#6b7280]",
                        item.status === "excused" && "bg-silver",
                      )}
                    />
                    <p className="text-sm font-medium">{item.course}</p>
                    <p className="text-xs text-muted">
                      {item.date} · {statusLabel[item.status]}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Répartition par cours" />
          <div className="space-y-4 px-5 pb-5">
            {courseBreakdown.map((c) => (
              <div key={c.course}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{c.course}</span>
                  <span className="text-muted">{c.rate}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-navy dark:bg-navy-soft"
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
