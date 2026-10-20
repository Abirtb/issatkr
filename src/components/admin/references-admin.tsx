"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Input } from "@/components/ui/input";
import { CurriculumAdmin } from "@/components/admin/curriculum-admin";
import { useRevealOnOpen } from "@/lib/use-reveal";

type ReferenceRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  _count: { sessions?: number; classes?: number };
  // Subjects only: the programmes it belongs to.
  curricula?: { id: string; specialty: string; level: { code: string } }[];
};

function ReferenceSection({
  title,
  endpoint,
  countLabel,
  reloadKey = 0,
}: {
  title: string;
  endpoint: "/api/admin/subjects" | "/api/admin/levels";
  countLabel: "sessions" | "classes";
  reloadKey?: number;
}) {
  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<ReferenceRow | null>(null);
  const editForm = useRevealOnOpen<HTMLFormElement>(editing?.id);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(endpoint);
    const data = await response.json();
    setRows(response.ok ? data : []);
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

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

  async function importFile(file: File) {
    setImporting(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch(`${endpoint}/import`, { method: "POST", body });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) {
      setMessage(data.error ?? "Import impossible");
      return;
    }
    setMessage(
      [
        `Import : ${data.created} ajouté(s), ${data.updated} mis à jour${data.errorCount ? `, ${data.errorCount} ligne(s) ignorée(s)` : ""}`,
        ...data.errors,
      ].join("\n"),
    );
    await load();
  }

  async function remove(row: { id: string; code: string; name: string }) {
    if (
      !window.confirm(
        `Supprimer définitivement « ${row.code} · ${row.name} » ?
Impossible s’il est déjà utilisé : désactivez-le dans ce cas.`,
      )
    ) {
      return;
    }
    const response = await fetch(`${endpoint}?id=${row.id}&permanent=1`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `« ${row.code} » supprimé` : data.error);
    if (response.ok) await load();
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
          className="w-full sm:w-28"
        />
        <Input
          required
          placeholder="Libellé"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 basis-40"
        />
        <Button type="submit">Ajouter</Button>
      </form>
      <FileDropZone
        className="mt-3"
        accept=".csv,.xls,.xlsx"
        file={null}
        onFile={(file) => {
          if (file) void importFile(file);
        }}
        disabled={importing}
        label={importing ? "Import en cours…" : "Glissez un fichier CSV / Excel"}
        hint={
          endpoint === "/api/admin/subjects"
            ? "import immédiat · code, libellé (+ niveau, spécialité)"
            : "import immédiat · code, libellé"
        }
      />
      {message ? (
        <p className="mt-2 whitespace-pre-line text-xs text-muted">{message}</p>
      ) : null}
      <div className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className={row.active ? "font-medium" : "font-medium opacity-50"}>
                {row.code} · {row.name}
              </p>
              <p className="text-xs text-muted">
                {row._count[countLabel] ?? 0} {countLabel}
                {row.curricula?.length
                  ? ` · ${row.curricula
                      .map((entry) => `${entry.level.code}${entry.specialty ? ` ${entry.specialty}` : ""}`)
                      .join(", ")}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(row)}
              className="min-h-10 px-1 text-sm text-navy hover:underline"
            >
              Modifier
            </button>
            {row.active ? (
              <button
                type="button"
                onClick={() => void deactivate(row.id)}
                className="min-h-10 px-1 text-sm text-red-700 hover:underline"
              >
                Désactiver
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void remove(row)}
              className="min-h-10 px-1 text-sm text-red-700 hover:underline"
            >
              Supprimer
            </button>
          </div>
        ))}
      </div>
      {editing ? (
        <form
          ref={editForm}
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
  // Saving a programme refreshes the programme tags of the subjects list.
  const [reloadKey, setReloadKey] = useState(0);
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
          reloadKey={reloadKey}
        />
        <ReferenceSection
          title="Niveaux"
          endpoint="/api/admin/levels"
          countLabel="classes"
        />
      </div>
      <div className="mt-5">
        <CurriculumAdmin onSaved={() => setReloadKey((value) => value + 1)} />
      </div>
    </div>
  );
}
