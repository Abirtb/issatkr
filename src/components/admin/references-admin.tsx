"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReferenceRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  _count: { sessions?: number; classes?: number };
};

function ReferenceSection({
  title,
  endpoint,
  countLabel,
}: {
  title: string;
  endpoint: "/api/admin/subjects" | "/api/admin/levels";
  countLabel: "sessions" | "classes";
}) {
  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<ReferenceRow | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(endpoint);
    const data = await response.json();
    setRows(response.ok ? data : []);
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Ajouté" : data.error);
    if (response.ok) {
      setCode("");
      setName("");
      await load();
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const data = await response.json();
    setMessage(response.ok ? "Modifié" : data.error);
    if (response.ok) {
      setEditing(null);
      await load();
    }
  }

  async function deactivate(id: string) {
    const response = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Désactivé" : data.error);
    if (response.ok) await load();
  }

  return (
    <section className="surface-card rounded-xl p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
        <Input
          required
          placeholder="Code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-28"
        />
        <Input
          required
          placeholder="Libellé"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-52 flex-1"
        />
        <Button type="submit">Ajouter</Button>
      </form>
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
      <div className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={row.active ? "font-medium" : "font-medium opacity-50"}>
                {row.code} · {row.name}
              </p>
              <p className="text-xs text-muted">
                {row._count[countLabel] ?? 0} {countLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(row)}
              className="text-sm text-navy hover:underline"
            >
              Modifier
            </button>
            {row.active ? (
              <button
                type="button"
                onClick={() => void deactivate(row.id)}
                className="text-sm text-red-700 hover:underline"
              >
                Désactiver
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {editing ? (
        <form
          onSubmit={save}
          className="mt-3 grid gap-2 rounded-lg bg-surface-2 p-3"
        >
          <Input
            required
            value={editing.code}
            onChange={(event) =>
              setEditing({ ...editing, code: event.target.value })
            }
          />
          <Input
            required
            value={editing.name}
            onChange={(event) =>
              setEditing({ ...editing, name: event.target.value })
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
            Actif
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Enregistrer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              Annuler
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function AdminReferences() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Matières et niveaux</h1>
      <p className="mt-1 text-sm text-muted">
        Référentiels utilisés par les classes, séances et seuils.
      </p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ReferenceSection
          title="Matières"
          endpoint="/api/admin/subjects"
          countLabel="sessions"
        />
        <ReferenceSection
          title="Niveaux"
          endpoint="/api/admin/levels"
          countLabel="classes"
        />
      </div>
    </div>
  );
}
