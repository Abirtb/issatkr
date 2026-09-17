"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Role = "ADMIN" | "DEPARTMENT_HEAD" | "PROF";
type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  _count: { taughtSessions: number };
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Administration",
  DEPARTMENT_HEAD: "Chef de département",
  PROF: "Enseignant",
};

export function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "PROF" as Role,
  });
  const [editing, setEditing] = useState<
    (UserRow & { password?: string }) | null
  >(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    setUsers(response.ok ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setMessage(response.ok ? "Utilisateur créé" : data.error);
    if (response.ok) {
      setForm({ name: "", email: "", password: "", role: "PROF" });
      await load();
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await response.json();
    setMessage(response.ok ? "Utilisateur modifié" : data.error);
    if (response.ok) {
      setEditing(null);
      await load();
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm("Désactiver ce compte ?")) return;
    const response = await fetch(`/api/admin/users?id=${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(response.ok ? "Compte désactivé" : data.error);
    if (response.ok) await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Utilisateurs et accès</h1>
      <p className="mt-1 text-sm text-muted">
        Administration, chefs de département et enseignants.
      </p>

      <form
        onSubmit={create}
        className="surface-card mt-6 grid gap-3 rounded-xl p-4 sm:grid-cols-2"
      >
        <Input
          required
          placeholder="Nom complet"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <Input
          required
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Input
          required
          minLength={8}
          type="password"
          placeholder="Mot de passe initial"
          value={form.password}
          onChange={(event) =>
            setForm({ ...form, password: event.target.value })
          }
        />
        <select
          value={form.role}
          onChange={(event) =>
            setForm({ ...form, role: event.target.value as Role })
          }
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" className="sm:col-span-2">
          Ajouter l’utilisateur
        </Button>
      </form>

      {message ? <p className="mt-3 text-sm text-gold">{message}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Utilisateur</th>
              <th className="px-4 py-2">Rôle</th>
              <th className="px-4 py-2">Séances</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-4 py-3">
                  {user.name}
                  <span className="block text-xs text-muted">{user.email}</span>
                </td>
                <td className="px-4 py-3">{roleLabels[user.role]}</td>
                <td className="px-4 py-3">{user._count.taughtSessions}</td>
                <td className="px-4 py-3">
                  {user.active ? "Actif" : "Désactivé"}
                </td>
                <td className="space-x-3 px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...user, password: "" })}
                    className="text-navy hover:underline"
                  >
                    Modifier
                  </button>
                  {user.active ? (
                    <button
                      type="button"
                      onClick={() => void deactivate(user.id)}
                      className="text-red-700 hover:underline"
                    >
                      Désactiver
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <form
          onSubmit={save}
          className="surface-card mt-4 grid gap-3 rounded-xl p-4 sm:grid-cols-2"
        >
          <h2 className="font-semibold sm:col-span-2">Modifier le compte</h2>
          <Input
            required
            value={editing.name}
            onChange={(event) =>
              setEditing({ ...editing, name: event.target.value })
            }
          />
          <Input
            required
            type="email"
            value={editing.email}
            onChange={(event) =>
              setEditing({ ...editing, email: event.target.value })
            }
          />
          <select
            value={editing.role}
            onChange={(event) =>
              setEditing({ ...editing, role: event.target.value as Role })
            }
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
          >
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            type="password"
            minLength={8}
            placeholder="Nouveau mot de passe (facultatif)"
            value={editing.password ?? ""}
            onChange={(event) =>
              setEditing({ ...editing, password: event.target.value })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(event) =>
                setEditing({ ...editing, active: event.target.checked })
              }
            />
            Compte actif
          </label>
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
