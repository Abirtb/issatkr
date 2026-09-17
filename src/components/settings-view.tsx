"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { currentUser } from "@/lib/data";
import { cn } from "@/lib/cn";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Paramètres</h1>
        <p className="mt-1 text-sm text-muted">Profil enseignant et apparence de la plateforme.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar firstName={currentUser.firstName} lastName={currentUser.lastName} size="lg" />
          <div>
            <p className="font-semibold">
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className="text-sm text-muted">
              {currentUser.title} · {currentUser.department}
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Prénom</span>
            <Input defaultValue={currentUser.firstName} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Nom</span>
            <Input defaultValue={currentUser.lastName} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block text-muted">E-mail</span>
            <Input defaultValue={currentUser.email} />
          </label>
        </div>
        <Button className="mt-5">Enregistrer</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-[15px] font-semibold">Apparence</h2>
        <p className="mt-1 text-sm text-muted">Le mode sombre est conçu autour du navy institutionnel.</p>
        {mounted ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { id: "light", label: "Clair" },
              { id: "dark", label: "Sombre" },
              { id: "system", label: "Système" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "h-11 rounded-[10px] border text-sm",
                  theme === opt.id
                    ? "border-gold bg-gold/10 font-medium"
                    : "border-border hover:bg-surface-2",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 h-11 skeleton rounded-[10px]" />
        )}
      </Card>
    </div>
  );
}
