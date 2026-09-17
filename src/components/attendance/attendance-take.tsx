"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getSession, students } from "@/lib/data";
import type { AttendanceStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

const statuses: { id: AttendanceStatus; label: string }[] = [
  { id: "present", label: "Présent" },
  { id: "late", label: "Retard" },
  { id: "absent", label: "Absent" },
  { id: "excused", label: "Excusé" },
];

export function AttendanceTake({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const session = getSession(sessionId);
  const roster = useMemo(
    () => students.filter((s) => session?.studentIds.includes(s.id)),
    [session],
  );
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(roster.map((s) => [s.id, "unset"])),
  );
  const [saved, setSaved] = useState(false);

  if (!session) {
    return <p className="text-muted">Séance introuvable.</p>;
  }

  const setAllPresent = () => {
    setMarks(Object.fromEntries(roster.map((s) => [s.id, "present"])));
  };

  const marked = Object.values(marks).filter((s) => s !== "unset").length;

  return (
    <div className="mx-auto max-w-4xl pb-28 lg:pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-gold uppercase">
            {session.courseCode}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {session.course}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {session.group} · {session.room} · {session.startTime}–{session.endTime} ·{" "}
            {session.professor}
          </p>
        </div>
        <Button variant="gold" size="lg" onClick={setAllPresent} className="min-h-12">
          Marquer tous présents
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>
          {marked}/{roster.length} étudiants enregistrés
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-navy transition-all dark:bg-gold"
            style={{ width: `${(marked / roster.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {roster.map((student, i) => (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            className="surface-card flex flex-col gap-3 rounded-[14px] p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar firstName={student.firstName} lastName={student.lastName} />
              <div className="min-w-0">
                <p className="truncate font-medium tracking-tight">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-xs text-muted">{student.registrationNumber}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:ml-auto sm:flex sm:w-auto">
              {statuses.map((status) => {
                const active = marks[student.id] === status.id;
                return (
                  <button
                    key={status.id}
                    onClick={() =>
                      setMarks((m) => ({ ...m, [student.id]: status.id }))
                    }
                    className={cn(
                      "h-11 min-w-[72px] rounded-[9px] px-2 text-[12px] font-medium transition-colors sm:h-9",
                      active && status.id === "present" && "bg-navy text-white",
                      active && status.id === "late" && "bg-gold text-navy-deep",
                      active &&
                        status.id === "absent" &&
                        "bg-[#2b3340] text-white dark:bg-[#3a4556]",
                      active &&
                        status.id === "excused" &&
                        "bg-silver/40 text-navy dark:bg-white/12 dark:text-white",
                      !active &&
                        "bg-surface-2 text-muted hover:bg-border hover:text-ink",
                    )}
                  >
                    {status.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="fixed right-0 bottom-0 left-0 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Button
            variant="secondary"
            className="flex-1 lg:flex-none"
            onClick={() => router.push("/attendance")}
          >
            Annuler
          </Button>
          <Button
            className="flex-1 lg:flex-none"
            disabled={marked === 0}
            onClick={() => setSaved(true)}
          >
            Enregistrer la séance
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {saved ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-[12px] bg-navy px-4 py-3 text-sm text-white shadow-lg"
          >
            <span className="inline-flex items-center gap-2">
              <Check size={16} className="text-gold" />
              Présence enregistrée pour {session.courseCode}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
