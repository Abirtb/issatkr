"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const profNav = [
  { href: "/classes", label: "Classes" },
  { href: "/elimines", label: "Éliminés" },
  { href: "/reports", label: "Rapports" },
];

const adminNav = [
  { href: "/admin/classes", label: "Classes & étudiants" },
  { href: "/admin/references", label: "Matières & niveaux" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/schedule", label: "Emploi du temps" },
  { href: "/admin/attendance", label: "Absences" },
  { href: "/elimines", label: "Éliminés" },
  { href: "/reports", label: "Rapports" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/settings", label: "Paramètres" },
];

const departmentHeadNav = [
  { href: "/schedule", label: "Emploi du temps" },
  { href: "/classes", label: "Mes séances" },
  { href: "/elimines", label: "Éliminés" },
  { href: "/reports", label: "Rapports" },
];

export function Shell({
  children,
  role,
  name,
}: {
  children: React.ReactNode;
  role: "ADMIN" | "DEPARTMENT_HEAD" | "PROF";
  name: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav =
    role === "ADMIN"
      ? adminNav
      : role === "DEPARTMENT_HEAD"
        ? departmentHeadNav
        : profNav;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-navy-deep text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <div className="rounded bg-white px-2 py-1">
            <Image src="/issatkr-logo.png" alt="ISSATKR" width={100} height={28} className="h-6 w-auto" />
          </div>
          <nav className="hidden gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded px-3 py-1.5 text-sm",
                  pathname.startsWith(item.href) ? "bg-white/10 text-gold" : "text-white/70 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-white/60 sm:inline">{name}</span>
            {role === "ADMIN" ? (
              <Link href="/classes" className="text-white/70 hover:text-white">
                Vue prof
              </Link>
            ) : null}
            <button onClick={logout} className="text-white/70 hover:text-white">
              Déconnexion
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded px-3 py-1 text-xs",
                pathname.startsWith(item.href) ? "bg-gold text-navy-deep" : "bg-white/10 text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
