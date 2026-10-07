"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Role = "ADMIN" | "DEPARTMENT_HEAD" | "PROF";

const roleLabels: Record<Role, string> = {
  ADMIN: "Administration",
  DEPARTMENT_HEAD: "Chef de département",
  PROF: "Enseignant",
};

const profNav = [
  { href: "/classes", label: "Mes séances" },
  { href: "/elimines", label: "Éliminés" },
  { href: "/reports", label: "Rapports" },
];

const adminNav = [
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/references", label: "Matières et niveaux" },
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

function SidebarNav({
  items,
  pathname,
  onNavigate,
}: {
  items: { href: string; label: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-gold"
                : "text-white/70 hover:bg-white/5 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({
  children,
  role,
  name,
}: {
  children: React.ReactNode;
  role: Role;
  name: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav =
    role === "ADMIN"
      ? adminNav
      : role === "DEPARTMENT_HEAD"
        ? departmentHeadNav
        : profNav;

  useEffect(() => {
    if (!mobileOpen) return;
    // Keep the page behind the drawer still and let Escape close it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-deep text-white md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="inline-flex rounded-md bg-white px-2.5 py-1.5">
            <Image
              src="/issatkr-logo.png"
              alt="ISSATKR"
              width={120}
              height={32}
              className="h-7 w-auto"
            />
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/45">
            {roleLabels[role]}
          </p>
        </div>
        <SidebarNav items={nav} pathname={pathname} />
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{name}</p>
          {role === "ADMIN" ? (
            <Link
              href="/classes"
              className="mt-1 block text-xs text-white/55 hover:text-white"
            >
              Vue enseignant
            </Link>
          ) : null}
          <Link
            href="/compte"
            className="mt-1 block text-xs text-white/55 hover:text-white"
          >
            Mon mot de passe
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 text-sm text-white/70 hover:text-white"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-navy-deep px-4 py-2 text-white md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="-ml-2 inline-flex h-11 items-center gap-2 rounded-md px-2 text-base hover:bg-white/10"
          aria-label="Ouvrir le menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={22} aria-hidden />
          Menu
        </button>
        <div className="rounded bg-white px-2 py-1">
          <Image
            src="/issatkr-logo.png"
            alt="ISSATKR"
            width={92}
            height={24}
            className="h-5 w-auto"
          />
        </div>
        <span className="ml-auto truncate text-sm text-white/70">{name}</span>
      </header>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-navy-deep text-white">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="rounded bg-white px-2 py-1">
                <Image
                  src="/issatkr-logo.png"
                  alt="ISSATKR"
                  width={100}
                  height={28}
                  className="h-6 w-auto"
                />
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm hover:bg-white/10"
              >
                <X size={18} aria-hidden />
                Fermer
              </button>
            </div>
            <SidebarNav
              items={nav}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="border-t border-white/10 p-4">
              <p className="truncate text-sm font-medium">{name}</p>
              {role === "ADMIN" ? (
                <Link
                  href="/classes"
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-10 items-center text-sm text-white/70 hover:text-white"
                >
                  Vue enseignant
                </Link>
              ) : null}
              <Link
                href="/compte"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-10 items-center text-sm text-white/70 hover:text-white"
              >
                Mon mot de passe
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex min-h-10 items-center text-sm text-white/70"
              >
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
