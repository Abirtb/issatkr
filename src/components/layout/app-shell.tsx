"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { currentUser, notifications } from "@/lib/data";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

const nav = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/attendance", label: "Présence", icon: ClipboardCheck },
  { href: "/students", label: "Étudiants", icon: Users },
  { href: "/sessions", label: "Séances", icon: CalendarDays },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col bg-navy-deep text-white transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[76px]" : "w-[252px]",
          )}
        >
          <SidebarContent
            collapsed={collapsed}
            pathname={pathname}
            unread={unread}
            onToggle={() => setCollapsed((v) => !v)}
          />
        </aside>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                className="absolute inset-0 bg-navy-deep/50"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer le menu"
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 flex h-full w-[280px] flex-col bg-navy-deep text-white"
              >
                <SidebarContent
                  collapsed={false}
                  pathname={pathname}
                  unread={unread}
                  onClose={() => setMobileOpen(false)}
                />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur-md">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink hover:bg-surface-2 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu size={20} />
              </button>
              <div className="relative hidden max-w-md flex-1 md:block">
                <Search
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                />
                <Input
                  placeholder="Rechercher un étudiant, un cours…"
                  className="pl-9"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                <Link
                  href="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Bell size={18} />
                  {unread ? (
                    <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-gold" />
                  ) : null}
                </Link>
                <button
                  onClick={() => router.push("/settings")}
                  className="hidden items-center gap-2 rounded-[10px] py-1 pr-2 pl-1 hover:bg-surface-2 sm:flex"
                >
                  <Avatar
                    firstName={currentUser.firstName}
                    lastName={currentUser.lastName}
                    size="sm"
                  />
                  <div className="text-left">
                    <p className="text-sm font-medium leading-tight">
                      {currentUser.firstName} {currentUser.lastName}
                    </p>
                    <p className="text-[11px] text-muted">{currentUser.title}</p>
                  </div>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  unread,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  pathname: string;
  unread: number;
  onToggle?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();

  return (
    <>
      <div className={cn("flex items-center gap-3 px-3 py-5", collapsed && "justify-center px-2")}>
        <div
          className={cn(
            "overflow-hidden rounded-[10px] bg-white",
            collapsed ? "h-10 w-10" : "px-2 py-1.5",
          )}
        >
          <Image
            src="/issatkr-logo.png"
            alt="ISSATKR"
            width={collapsed ? 40 : 168}
            height={collapsed ? 40 : 44}
            className={cn("object-contain object-left", collapsed ? "h-10 w-10" : "h-9 w-auto")}
            priority
          />
        </div>
        {onClose ? (
          <button
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-[8px] hover:bg-white/8"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-white/8 text-white"
                  : "text-white/65 hover:bg-white/6 hover:text-white",
              )}
            >
              {active ? (
                <span className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold" />
              ) : null}
              <Icon size={18} strokeWidth={1.75} />
              {!collapsed ? <span className="font-medium">{item.label}</span> : null}
              {!collapsed && item.href === "/notifications" && unread ? (
                <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold text-navy-deep">
                  {unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-white/8 p-3">
        {onToggle ? (
          <button
            onClick={onToggle}
            className="hidden w-full rounded-[10px] px-3 py-2 text-left text-xs text-white/50 hover:bg-white/6 hover:text-white lg:block"
          >
            {collapsed ? "»" : "Réduire"}
          </button>
        ) : null}
        <button
          onClick={() => router.push("/")}
          className={cn(
            "flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-white/65 hover:bg-white/6 hover:text-white",
            collapsed && "justify-center",
          )}
        >
          <LogOut size={18} strokeWidth={1.75} />
          {!collapsed ? "Déconnexion" : null}
        </button>
      </div>
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-10" />;

  const dark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 hover:text-ink"
      aria-label="Changer le thème"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
