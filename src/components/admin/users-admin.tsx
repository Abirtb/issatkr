"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/ui/file-drop-zone";
import { Input } from "@/components/ui/input";
import { csvRow } from "@/lib/csv";
import { useRevealOnOpen } from "@/lib/use-reveal";

type Role = "ADMIN" | "DEPARTMENT_HEAD" | "PROF";
type UserRow = {
  id: string;
  name: string;
  email: string | null;
  grade: string | null;
  role: Role;
  active: boolean;
  invitation: "not_sent" | "pending" | "expired" | null;
  _count: { taughtSessions: number; weeklySlots: number };
};

// List filter on the account state.
const statusFilters = {
  all: "Tous les statuts",
  noEmail: "Sans e-mail",
  toInvite: "À inviter",
  pending: "Invitation envoyée",
  active: "Actifs",
  inactive: "Désactivés",
} as const;
type StatusFilter = keyof typeof statusFilters;

function statusOf(user: UserRow): Exclude<StatusFilter, "all" | "toInvite"> | "toInvite" {
  if (!user.active) return "inactive";
  if (!user.email) return "noEmail";
  if (user.invitation === "not_sent" || user.invitation === "expired") return "toInvite";
  if (user.invitation === "pending") return "pending";
  return "active";
}

// Link returned by the API only when it could not be e-mailed.
type PendingLink = { name: string; email: string; link: string; expiresAt: string };
type Delivery = { emailed: boolean; expiresAt: string; link?: string };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

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
    grade: "",
    password: "",
    role: "PROF" as Role,
  });
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<
    (UserRow & { password?: string }) | null
  >(null);
  const [message, setMessage] = useState("");
  const editForm = useRevealOnOpen<HTMLFormElement>(editing?.id);
  const [importing, setImporting] = useState(false);
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [sending, setSending] = useState(false);

  // E-mailed → just say so; not e-mailed (SMTP off/failed) → keep the link to hand over.
  function keepUndelivered(person: { name: string; email: string }, delivery: Delivery) {
    if (delivery.emailed || !delivery.link) return;
    const link = delivery.link;
    setLinks((current) => [
      ...current.filter((item) => item.email !== person.email),
      { ...person, link, expiresAt: delivery.expiresAt },
    ]);
  }

  async function sendLink(user: UserRow) {
    if (
      !window.confirm(
        `Envoyer un lien à ${user.name} pour choisir son mot de passe ?\nUn lien envoyé auparavant ne fonctionnera plus.`,
      )
    ) {
      return;
    }
    const response = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Envoi impossible");
      return;
    }
    keepUndelivered({ name: user.name, email: user.email ?? "" }, data);
    setMessage(
      data.emailed
        ? `Lien envoyé par e-mail à ${user.email} (valable jusqu’au ${formatDate(data.expiresAt)}).`
        : `E-mail non envoyé (SMTP non configuré ou indisponible) : transmettez le lien ci-dessous à ${user.name}.`,
    );
    await load();
  }

  // Accounts that still need an invitation: never sent, or the link expired
  // (and an e-mail to send it to).
  const toInvite = users.filter((user) => statusOf(user) === "toInvite");
  const withoutEmail = users.filter((user) => statusOf(user) === "noEmail").length;
  const grades = [...new Set(users.map((user) => user.grade).filter(Boolean))].sort() as string[];
  // Every word must appear, in any order: "abid dorra" finds "Dorra ABID".
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shownUsers = users.filter(
    (user) =>
      words.every((word) =>
        `${user.name} ${user.email ?? ""} ${user.grade ?? ""}`.toLowerCase().includes(word),
      ) &&
      (!roleFilter || user.role === roleFilter) &&
      (!gradeFilter || user.grade === gradeFilter) &&
      (statusFilter === "all" || statusOf(user) === statusFilter),
  );

  async function sendAllInvitations() {
    if (
      !window.confirm(
        `Envoyer une invitation à ${toInvite.length} personne(s) ?\nChacune reçoit un lien valable 72 h pour choisir son mot de passe.`,
      )
    ) {
      return;
    }
    setSending(true);
    const response = await fetch("/api/admin/users/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: toInvite.map((user) => user.id) }),
    });
    const data = await response.json();
    setSending(false);
    if (!response.ok) {
      setMessage(data.error ?? "Envoi impossible");
      return;
    }
    const results: (Delivery & { name: string; email: string })[] = data.results ?? [];
    for (const result of results) keepUndelivered(result, result);
    const emailed = results.filter((result) => result.emailed).length;
    const notEmailed = results.length - emailed;
    setMessage(
      [
        `${emailed} invitation(s) envoyée(s) par e-mail.`,
        notEmailed ? `${notEmailed} lien(s) à transmettre vous-même (liste ci-dessous).` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    await load();
  }

  function downloadLinks() {
    const csv = [
      "nom;email;lien;valable_jusqu_au",
      ...links.map((row) => csvRow([row.name, row.email, row.link, formatDate(row.expiresAt)])),
    ].join("\r\n");
    const bom = String.fromCharCode(0xfeff);
    const url = URL.createObjectURL(new Blob([bom + csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "liens-activation.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

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
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(
      form.password
        ? "Utilisateur créé avec le mot de passe saisi."
        : data.user.email
          ? `Compte créé pour ${data.user.name}. Aucun e-mail n’a été envoyé : cliquez sur « Envoyer l’invitation » quand vous êtes prêt.`
          : `Compte créé pour ${data.user.name}, sans e-mail : ajoutez-le (Modifier) avant d’envoyer l’invitation.`,
    );
    setForm({ name: "", email: "", grade: "", password: "", role: "PROF" });
    await load();
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

  async function remove(user: UserRow) {
    if (
      !window.confirm(
        `Supprimer définitivement ${user.name} ?\nÀ utiliser pour une erreur ou un doublon. Un compte avec des séances ne peut être que désactivé.`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/admin/users?id=${user.id}&permanent=1`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `${user.name} supprimé.` : data.error);
    if (response.ok) await load();
  }

  async function importTeachers(file: File) {
    setImporting(true);
    setMessage("");
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/admin/users/import", {
      method: "POST",
      body,
    });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    setMessage(
      [
        `${data.created} comptes créés, ${data.updated} mis à jour.`,
        data.withoutEmail
          ? `${data.withoutEmail} enseignant(s) sans e-mail : complétez le fichier et réimportez-le, ou ajoutez l’e-mail avec « Modifier ».`
          : "",
        data.awaitingInvitation
          ? `${data.awaitingInvitation} compte(s) sans mot de passe : aucune invitation n’a été envoyée. Utilisez « Envoyer les invitations » quand vous êtes prêt.`
          : "",
        ...data.errors,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Utilisateurs et accès</h1>
      <p className="mt-1 text-sm text-muted">
        Administration, chefs de département et enseignants.
      </p>

      <div className="surface-card mt-6 rounded-xl border-l-4 border-l-gold p-4">
        <p className="font-semibold">Importer des enseignants (CSV / Excel)</p>
        <p className="mt-1 text-sm text-muted">
          La liste du personnel telle quelle : colonne A le nom, colonne B le
          grade, une colonne e-mail facultative (ou des en-têtes nom, prenom,
          email, grade, role). Réimportez la liste complétée plus tard : les
          mêmes enseignants sont mis à jour (par e-mail, sinon par nom). Aucun
          e-mail n’est envoyé à l’import.
        </p>
        <FileDropZone
          className="mt-3"
          accept=".csv,.xls,.xlsx"
          file={null}
          onFile={(file) => {
            if (file) void importTeachers(file);
          }}
          disabled={importing}
          label={importing ? "Import en cours…" : "Glissez la liste des enseignants ici"}
          hint="import immédiat · CSV, XLS, XLSX"
        />
      </div>

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
          type="email"
          placeholder="E-mail (facultatif pour un enseignant)"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <Input
          placeholder="Grade (facultatif) : Maître-assistant, vacataire…"
          value={form.grade}
          onChange={(event) => setForm({ ...form, grade: event.target.value })}
        />
        <Input
          minLength={8}
          type="password"
          autoComplete="new-password"
          placeholder="Mot de passe (facultatif)"
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
        <p className="text-xs text-muted sm:col-span-2">
          Laissez le mot de passe vide (recommandé) : rien n’est envoyé à
          l’ajout. Envoyez ensuite l’invitation (lien valable 72 h) avec le
          bouton « Envoyer l’invitation » de la liste.
        </p>
        <Button type="submit" className="sm:col-span-2">
          Ajouter l’utilisateur
        </Button>
      </form>

      {message ? (
        <p className="mt-3 whitespace-pre-line text-sm text-gold">{message}</p>
      ) : null}

      {links.length ? (
        <div className="surface-card mt-4 rounded-xl border-l-4 border-l-gold p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Liens à transmettre ({links.length})</p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={downloadLinks}>
                Télécharger (CSV)
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setLinks([])}>
                Effacer
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">
            L’e-mail n’a pas pu être envoyé. Chaque lien ouvre le compte : ne le
            donnez qu’à la personne concernée, et supprimez le fichier après usage.
          </p>
          <ul className="mt-3 space-y-2">
            {links.map((item) => (
              <li key={item.email} className="rounded-lg bg-surface-2 p-3 text-sm">
                <p className="font-medium">
                  {item.name} <span className="font-normal text-muted">· {item.email}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <Input readOnly value={item.link} onFocus={(event) => event.target.select()} className="font-mono text-xs" />
                  <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(item.link)}>
                    Copier
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted">Valable jusqu’au {formatDate(item.expiresAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {toInvite.length ? (
        <div className="surface-card mt-6 flex flex-wrap items-center gap-3 rounded-xl p-4">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">
              {toInvite.length} compte(s) en attente d’invitation
            </span>
            <span className="block text-xs text-muted">
              Jamais invités, ou lien expiré. Vous pouvez aussi les inviter un
              par un dans la liste.
            </span>
          </p>
          <Button variant="gold" disabled={sending} onClick={() => void sendAllInvitations()}>
            {sending ? "Envoi en cours…" : `Envoyer les invitations (${toInvite.length})`}
          </Button>
        </div>
      ) : null}

      <div className="surface-card mt-6 grid gap-2 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un nom, un e-mail…"
          className="sm:col-span-2 lg:col-span-4"
          aria-label="Rechercher un utilisateur"
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="field-select" aria-label="Filtrer par rôle">
          <option value="">Tous les rôles</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="field-select" aria-label="Filtrer par grade">
          <option value="">Tous les grades</option>
          {grades.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="field-select" aria-label="Filtrer par statut">
          {Object.entries(statusFilters).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <p className="self-center text-sm text-muted">
          {shownUsers.length} sur {users.length}
          {withoutEmail ? ` · ${withoutEmail} sans e-mail` : ""}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th className="px-4 py-2">Utilisateur</th>
              <th className="px-4 py-2">Rôle / grade</th>
              <th className="px-4 py-2">Séances</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shownUsers.map((user) => {
              const status = statusOf(user);
              const deletable = user._count.taughtSessions === 0 && user._count.weeklySlots === 0;
              return (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    {user.name}
                    <span className="block text-xs text-muted">{user.email ?? "Pas d’e-mail"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {roleLabels[user.role]}
                    {user.grade ? <span className="block text-xs text-muted">{user.grade}</span> : null}
                  </td>
                  <td className="px-4 py-3">{user._count.taughtSessions}</td>
                  <td className="px-4 py-3">
                    {status === "inactive"
                      ? "Désactivé"
                      : status === "noEmail"
                        ? "E-mail manquant"
                        : user.invitation === "not_sent"
                          ? "Invitation non envoyée"
                          : user.invitation === "pending"
                            ? "Invitation envoyée"
                            : user.invitation === "expired"
                              ? "Invitation expirée"
                              : "Actif"}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...user, password: "" })}
                      className="min-h-9 px-1 text-navy hover:underline"
                    >
                      Modifier
                    </button>
                    {user.active && user.email ? (
                      <button
                        type="button"
                        onClick={() => void sendLink(user)}
                        className="min-h-9 px-1 text-navy hover:underline"
                      >
                        {user.invitation === "not_sent"
                          ? "Envoyer l’invitation"
                          : user.invitation
                            ? "Renvoyer l’invitation"
                            : "Envoyer un lien"}
                      </button>
                    ) : null}
                    {user.active ? (
                      <button
                        type="button"
                        onClick={() => void deactivate(user.id)}
                        className="min-h-9 px-1 text-red-700 hover:underline"
                      >
                        Désactiver
                      </button>
                    ) : null}
                    {deletable && user.role !== "ADMIN" ? (
                      <button
                        type="button"
                        onClick={() => void remove(user)}
                        className="min-h-9 px-1 text-red-700 hover:underline"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {shownUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Aucun utilisateur ne correspond à ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <form
          ref={editForm}
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
            type="email"
            placeholder="E-mail (nécessaire pour inviter)"
            value={editing.email ?? ""}
            onChange={(event) =>
              setEditing({ ...editing, email: event.target.value })
            }
          />
          <Input
            placeholder="Grade"
            value={editing.grade ?? ""}
            onChange={(event) =>
              setEditing({ ...editing, grade: event.target.value })
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
