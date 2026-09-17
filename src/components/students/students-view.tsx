"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { students, warningCopy } from "@/lib/data";

export function StudentsView() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return students;
    return students.filter((st) =>
      `${st.firstName} ${st.lastName} ${st.registrationNumber}`.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Étudiants</h1>
          <p className="mt-1 text-sm text-muted">GL3-A · Génie Logiciel · {students.length} inscrits</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou matricule" className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={20} />}
          title="Aucun étudiant trouvé"
          description="Aucun résultat ne correspond à votre recherche. Essayez un autre nom ou matricule."
          actionLabel="Réinitialiser"
          onAction={() => setQ("")}
        />
      ) : (
        <div className="surface-card overflow-hidden rounded-[16px]">
          <div className="hidden grid-cols-[1.4fr_1fr_80px_88px_120px] gap-4 border-b border-border px-5 py-3 text-xs font-medium tracking-wide text-muted uppercase md:grid">
            <span>Étudiant</span>
            <span>Matricule</span>
            <span>Présence</span>
            <span>Absences</span>
            <span>Niveau</span>
          </div>
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/students/${s.id}`}
              className="grid grid-cols-1 items-center gap-3 border-b border-border px-5 py-3 last:border-0 hover:bg-surface-2 md:grid-cols-[1.4fr_1fr_80px_88px_120px]"
            >
              <div className="flex items-center gap-3">
                <Avatar firstName={s.firstName} lastName={s.lastName} size="sm" />
                <div>
                  <p className="text-sm font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="text-xs text-muted md:hidden">{s.registrationNumber}</p>
                </div>
              </div>
              <p className="hidden text-sm text-muted md:block">{s.registrationNumber}</p>
              <p className="text-sm font-medium">{s.attendanceRate}%</p>
              <p className="text-sm text-muted">{s.absences}</p>
              <Badge
                tone={
                  s.warningLevel === "critical"
                    ? "critical"
                    : s.warningLevel === "warning"
                      ? "warn"
                      : s.warningLevel === "watch"
                        ? "gold"
                        : "ok"
                }
              >
                {warningCopy[s.warningLevel]}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
