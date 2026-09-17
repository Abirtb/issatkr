"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Professor = {
  id: string;
  name: string;
  email: string;
  _count: { taughtSessions: number };
};

export function AdminProfessors() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/professors");
    const data = await response.json();
    setProfessors(response.ok ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProfessor(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/professors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Création impossible");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setMessage("Compte professeur créé");
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Professeurs</h1>
      <p className="mt-1 text-sm text-muted">
        Créez les comptes avant d’importer l’emploi du temps.
      </p>

      <form
        onSubmit={createProfessor}
        className="surface-card mt-6 grid gap-3 rounded-xl p-4 sm:grid-cols-2"
      >
        <Input
          required
          placeholder="Nom complet"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          required
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          required
          minLength={8}
          type="password"
          placeholder="Mot de passe initial (8 caractères min.)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={saving}>
          {saving ? "Création…" : "Créer le compte"}
        </Button>
        {message ? (
          <p className="text-sm text-muted sm:col-span-2">{message}</p>
        ) : null}
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        {professors.map((professor) => (
          <div
            key={professor.id}
            className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0"
          >
            <div>
              <p className="font-medium">{professor.name}</p>
              <p className="text-sm text-muted">{professor.email}</p>
            </div>
            <span className="text-sm text-muted">
              {professor._count.taughtSessions} séances
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
