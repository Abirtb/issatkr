"use client";

import { useState } from "react";

export function AdminEmploi() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function upload(file: File) {
    setLoading(true);
    setMsg("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/admin/emploi", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg(
        `${data.created} séances importées · ${data.updated ?? 0} mises à jour · ${data.skipped} ignorées`,
      );
      if (data.errors?.length) setMsg((m) => `${m}\n${data.errors.join("\n")}`);
    } else {
      setMsg(data.error);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Emploi du temps</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Import Excel/CSV avec colonnes : <strong>classe, matiere, date, heure_debut</strong> (heure_fin,
        salle, code optionnels). Ajoutez <strong>enseignant_email</strong> s&apos;il existe plusieurs
        professeurs. La classe et le compte professeur doivent exister avant l&apos;import.
      </p>
      <div className="mt-6 surface-card rounded-xl p-6">
        <label className="block cursor-pointer">
          <span className="inline-flex h-11 items-center rounded-lg bg-gold px-5 text-sm font-medium text-navy-deep">
            {loading ? "Import..." : "Choisir fichier Excel/CSV"}
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {msg ? <pre className="mt-4 whitespace-pre-wrap text-sm text-muted">{msg}</pre> : null}
      </div>
    </div>
  );
}
