"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CourseChart, PresenceChart } from "@/components/charts";
import { currentUser, sessions, students } from "@/lib/data";
import { warningCopy } from "@/lib/data";

const stats = [
  { label: "Présence moyenne", value: "91,4 %", delta: "+1,8 %", up: true, hint: "vs. semaine dernière" },
  { label: "Séances aujourd’hui", value: "2", delta: "1 à saisir", up: true, hint: "GL3-A" },
  { label: "Absences ouvertes", value: "7", delta: "-2", up: true, hint: "cette semaine" },
  { label: "Alertes critiques", value: "1", delta: "Ines C.", up: false, hint: "seuil dépassé" },
];

export function DashboardView() {
  const today = new Intl.DateTimeFormat("fr-TN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date("2026-09-02"));
  const next = sessions.find((s) => !s.recorded);
  const alerts = students.filter((s) => s.warningLevel !== "none");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm capitalize text-muted">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-[34px]">
            Bonjour, {currentUser.firstName} 👋
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted sm:text-[15px]">
            Voici un aperçu de l’activité académique aujourd’hui.
          </p>
        </div>
        {next ? (
          <Link href={`/attendance/${next.id}`}>
            <Button variant="gold" size="lg">
              Prendre la présence
              <ArrowUpRight size={16} />
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="px-5 py-5">
            <p className="text-sm text-muted">{stat.label}</p>
            <div className="mt-3 flex items-end justify-between">
              <p className="text-[32px] leading-none font-semibold tracking-tight">{stat.value}</p>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  stat.up ? "text-[#2f7a52]" : "text-gold"
                }`}
              >
                {stat.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {stat.delta}
              </span>
            </div>
            <p className="mt-3 text-xs text-muted">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Présence de la semaine" subtitle="Taux moyen par jour · GL3-A" />
          <PresenceChart />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Prochaine séance" />
          {next ? (
            <div className="px-5 pb-5">
              <p className="text-lg font-semibold tracking-tight">{next.course}</p>
              <p className="mt-1 text-sm text-muted">{next.courseCode}</p>
              <div className="mt-5 space-y-3 text-sm">
                <p className="flex items-center gap-2 text-muted">
                  <Clock size={16} /> {next.startTime} – {next.endTime}
                </p>
                <p className="flex items-center gap-2 text-muted">
                  <Users size={16} /> {next.group} · {next.room}
                </p>
              </div>
              <Link href={`/attendance/${next.id}`} className="mt-6 block">
                <Button className="w-full">Ouvrir la feuille</Button>
              </Link>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Assiduité par cours" subtitle="Période en cours" />
          <CourseChart />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Étudiants à surveiller"
            action={
              <Link href="/students" className="text-sm text-muted hover:text-ink">
                Voir tout
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {alerts.map((s) => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-muted">{s.attendanceRate}% de présence</p>
                </div>
                <Badge
                  tone={
                    s.warningLevel === "critical"
                      ? "critical"
                      : s.warningLevel === "warning"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {warningCopy[s.warningLevel]}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
