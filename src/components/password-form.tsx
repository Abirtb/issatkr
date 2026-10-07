"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.next !== form.confirm) {
      setMessage({ ok: false, text: "Les deux nouveaux mots de passe ne correspondent pas" });
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage({ ok: false, text: data.error ?? "Modification impossible" });
      return;
    }
    setForm({ current: "", next: "", confirm: "" });
    setMessage({
      ok: true,
      text: "Mot de passe modifié. Vos autres sessions ont été déconnectées.",
    });
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">Mon mot de passe</h1>
      <p className="mt-1 text-sm text-muted">
        Changez le mot de passe reçu de l’administration. 8 caractères minimum.
      </p>
      <form onSubmit={submit} className="surface-card mt-6 grid gap-3 rounded-xl p-5">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Mot de passe actuel</span>
          <Input
            required
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(event) => setForm({ ...form, current: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Nouveau mot de passe</span>
          <Input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(event) => setForm({ ...form, next: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Confirmer le nouveau mot de passe</span>
          <Input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(event) => setForm({ ...form, confirm: event.target.value })}
          />
        </label>
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Changer le mot de passe"}
        </Button>
        {message ? (
          <p className={message.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
            {message.text}
          </p>
        ) : null}
      </form>
    </div>
  );
}
