"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Overview = {
  counts: { classes: number; students: number; teachers: number; sessionsToday: number };
  todo: {
    classesWithoutLevel: number;
    studentsWithoutEmail: number;
    pendingInvitations: number;
    missedRollCalls: number;
    failedNotifications: number;
  };
  today: {
    id: string;
    courseName: string;
    startTime: string;
    endTime: string | null;
    room: string | null;
    done: boolean;
    className: string;
    professor: string | null;
  }[];
};

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

const actions = [
  { href: "/admin/imports", title: "Importer", text: "Étudiants, enseignants, matières, emploi…" },
  { href: "/schedule", title: "Emploi du temps", text: "Ajouter ou importer des séances" },
  { href: "/admin/users", title: "Enseignants", text: "Inviter ou gérer les comptes" },
  { href: "/admin/attendance", title: "Absences", text: "Consulter et justifier" },
];

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-sm text-muted">Le tableau de bord n’a pas pu être chargé. Rechargez la page.</p>;
  }
  if (!data) return <p className="text-sm text-muted">Chargement…</p>;

  const { counts, todo, today } = data;
  // Each entry only shows when there is something to do.
  const tasks = [
    {
      count: todo.classesWithoutLevel,
      label: plural(todo.classesWithoutLevel, "classe sans niveau", "classes sans niveau"),
      hint: "Les seuils d’absence ne s’appliquent pas sans niveau.",
      href: "/admin/classes?niveau=aucun",
    },
    {
      count: todo.missedRollCalls,
      label: plural(todo.missedRollCalls, "séance sans appel", "séances sans appel"),
      hint: "Ces 7 derniers jours.",
      href: "/schedule",
    },
    {
      count: todo.studentsWithoutEmail,
      label: plural(todo.studentsWithoutEmail, "étudiant sans e-mail", "étudiants sans e-mail"),
      hint: "Importez le fichier CIN + e-mail dans Classes.",
      href: "/admin/classes",
    },
    {
      count: todo.pendingInvitations,
      label: plural(todo.pendingInvitations, "compte non activé", "comptes non activés"),
      hint: "Invitation à envoyer, ou envoyée mais pas encore utilisée.",
      href: "/admin/users",
    },
    {
      count: todo.failedNotifications,
      label: plural(todo.failedNotifications, "e-mail d’alerte non envoyé", "e-mails d’alerte non envoyés"),
      hint: "Vérifiez la configuration SMTP.",
      href: "/admin/notifications",
    },
  ].filter((task) => task.count > 0);

  const stats = [
    { label: "Classes", value: counts.classes, href: "/admin/classes" },
    { label: "Étudiants", value: counts.students, href: "/admin/classes" },
    { label: "Enseignants", value: counts.teachers, href: "/admin/users" },
    { label: "Séances aujourd’hui", value: counts.sessionsToday, href: "/schedule" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="surface-card rounded-xl p-4 transition-colors hover:bg-surface-2">
            <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-sm text-muted">{stat.label}</p>
          </Link>
        ))}
      </div>

      <section className="surface-card rounded-xl p-5">
        <h2 className="font-semibold">À faire</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Rien à signaler. Tout est à jour.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.label}>
                <Link href={task.href} className="flex items-center gap-3 py-3 hover:text-gold">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{task.label}</span>
                    <span className="block text-xs text-muted">{task.hint}</span>
                  </span>
                  <span aria-hidden className="text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Séances d’aujourd’hui</h2>
          <Link href="/schedule" className="text-sm text-muted hover:text-ink">Emploi du temps →</Link>
        </div>
        {today.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune séance prévue aujourd’hui.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {today.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="w-24 shrink-0 font-medium tabular-nums">
                  {session.startTime}
                  {session.endTime ? `–${session.endTime}` : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{session.className}</span> · {session.courseName}
                  <span className="block text-xs text-muted">
                    {[session.professor, session.room].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <Badge tone={session.done ? "ok" : "neutral"}>{session.done ? "Appel fait" : "À faire"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Accès rapide</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="surface-card rounded-xl border-l-4 border-l-gold p-4 transition-colors hover:bg-surface-2">
              <p className="font-medium">{action.title}</p>
              <p className="mt-1 text-xs text-muted">{action.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
