"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileDropZone } from "@/components/ui/file-drop-zone";

// Every import of the app in one place: pick it in the menu, drop the file.
// Each one posts to the same route as its own page.
type ImportKind = "scolarite" | "emails" | "classList" | "teachers" | "subjects" | "levels" | "emploi";
type Result = Record<string, unknown>;

const kinds: Record<
  ImportKind,
  {
    label: string;
    accept: string;
    help: string;
    after: { href: string; label: string };
  }
> = {
  scolarite: {
    label: "Étudiants et classes (fichier scolarité)",
    accept: ".xls,.xlsx",
    help: "Le fichier officiel : une feuille par groupe (Année, Parcours, Nom Groupe, Identifiant Groupe, puis N° Inscription, CIN, Nom Fr, Prénom Fr…). La liste remplace les étudiants actifs de chaque groupe, sans effacer leur historique. Le fichier e-mails (CIN + e-mail) est facultatif.",
    after: { href: "/admin/classes", label: "Voir les classes" },
  },
  emails: {
    label: "E-mails des étudiants (par CIN)",
    accept: ".csv,.xls,.xlsx",
    help: "Colonnes CIN et E-mail (Nom facultatif). Les e-mails sont associés aux étudiants déjà importés par leur CIN.",
    after: { href: "/admin/classes", label: "Voir les classes" },
  },
  classList: {
    label: "Liste d’étudiants d’une classe",
    accept: ".csv,.xls,.xlsx",
    help: "Colonnes matricule, nom, prénom. La liste remplace les étudiants actifs de la classe choisie.",
    after: { href: "/admin/classes", label: "Voir les classes" },
  },
  teachers: {
    label: "Enseignants (liste du personnel)",
    accept: ".csv,.xls,.xlsx",
    help: "Colonne A le nom, colonne B le grade, e-mail facultatif (ou des en-têtes nom, prénom, email, grade, rôle). Réimportez la liste complétée plus tard : les mêmes enseignants sont mis à jour. Aucune invitation n’est envoyée à l’import.",
    after: { href: "/admin/users", label: "Voir les utilisateurs" },
  },
  subjects: {
    label: "Matières (et programmes)",
    accept: ".csv,.xls,.xlsx",
    help: "Colonnes code et libellé. Facultatif : niveau et spécialité pour le programme (une ligne par programme, le même code peut revenir).",
    after: { href: "/admin/references", label: "Voir les matières" },
  },
  levels: {
    label: "Niveaux",
    accept: ".csv,.xls,.xlsx",
    help: "Colonnes code et libellé (ex. L1 ; Licence 1).",
    after: { href: "/admin/references", label: "Voir les niveaux" },
  },
  emploi: {
    label: "Emploi du temps (séances à date fixe)",
    accept: ".csv,.xls,.xlsx",
    help: "Colonnes classe, matiere, code, date, heure_debut, heure_fin, salle, enseignant_email. Pour les cours qui se répètent chaque semaine, utilisez « Chaque semaine » dans l’emploi du temps.",
    after: { href: "/schedule", label: "Voir l’emploi du temps" },
  },
};

function lines(kind: ImportKind, data: Result): string[] {
  const n = (key: string) => Number(data[key] ?? 0);
  const list = (key: string) => (Array.isArray(data[key]) ? (data[key] as string[]) : []);
  const emails = (value: unknown) => {
    const result = value as { updated: number; unchanged: number; notFound: string[]; invalid: string[] } | null;
    if (!result) return [];
    return [
      `E-mails : ${result.updated} ajoutés/modifiés, ${result.unchanged} déjà à jour`,
      result.notFound.length ? `CIN introuvables (${result.notFound.length}) : ${result.notFound.slice(0, 20).join(", ")}` : "",
      result.invalid.length ? `E-mails invalides (${result.invalid.length}) : ${result.invalid.slice(0, 20).join(", ")}` : "",
    ];
  };
  switch (kind) {
    case "scolarite":
      return [
        `${n("classesCreated")} classe(s) créée(s), ${n("classesUpdated")} mise(s) à jour · ${n("studentsCreated")} étudiant(s) créé(s), ${n("studentsUpdated")} mis à jour`,
        ...((data.groups as { className: string; level: string | null }[] | undefined) ?? [])
          .filter((group) => group.level)
          .map((group) => `${group.className} → niveau ${group.level}`),
        ...emails(data.emails),
        ...list("warnings"),
      ];
    case "emails":
      return emails(data);
    case "classList":
      return [`${n("created")} étudiant(s) créé(s), ${n("updated")} mis à jour`];
    case "teachers":
      return [
        `${n("created")} compte(s) créé(s), ${n("updated")} mis à jour.`,
        n("withoutEmail") ? `${n("withoutEmail")} enseignant(s) sans e-mail : complétez le fichier et réimportez-le.` : "",
        n("awaitingInvitation") ? `${n("awaitingInvitation")} compte(s) à inviter depuis « Utilisateurs » (aucune invitation envoyée).` : "",
        ...list("errors"),
      ];
    case "subjects":
    case "levels":
      return [
        `${n("created")} créé(s), ${n("updated")} mis à jour`,
        n("linked") ? `${n("linked")} lien(s) de programme` : "",
        n("errorCount") ? `${n("errorCount")} ligne(s) rejetée(s) :` : "",
        ...list("errors"),
      ];
    case "emploi":
      return [
        `${n("created")} séance(s) créée(s) · ${n("updated")} mise(s) à jour · ${n("skipped")} ignorée(s)`,
        ...list("errors"),
      ];
  }
}

export function ImportsAdmin() {
  const [kind, setKind] = useState<ImportKind>("scolarite");
  const [file, setFile] = useState<File | null>(null);
  const [emailsFile, setEmailsFile] = useState<File | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

  // ?type=teachers opens that import directly (links from other pages).
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type && type in kinds) setKind(type as ImportKind);
    fetch("/api/admin/classes")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: { id: string; name: string }[]) => {
        setClasses(data);
        setClassId(data[0]?.id ?? "");
      });
  }, []);

  function choose(next: ImportKind) {
    setKind(next);
    setFile(null);
    setEmailsFile(null);
    setResult(null);
  }

  async function run() {
    if (!file && !(kind === "scolarite" && emailsFile)) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    let url = "";
    let resultKind: ImportKind = kind;
    if (kind === "scolarite" && !file && emailsFile) {
      // Only the e-mails file: same as the e-mails import.
      url = "/api/admin/students/emails";
      form.set("file", emailsFile);
      resultKind = "emails";
    } else {
      form.set("file", file!);
      url = {
        scolarite: "/api/admin/classes/import",
        emails: "/api/admin/students/emails",
        classList: `/api/admin/classes/${classId}/students`,
        teachers: "/api/admin/users/import",
        subjects: "/api/admin/subjects/import",
        levels: "/api/admin/levels/import",
        emploi: "/api/admin/emploi",
      }[kind];
      if (kind === "scolarite") {
        form.set("replace", "true");
        if (emailsFile) form.set("emailsFile", emailsFile);
      }
      if (kind === "classList") form.set("replace", "true");
    }
    const response = await fetch(url, { method: "POST", body: form });
    const data = (await response.json().catch(() => ({}))) as Result;
    setBusy(false);
    setResult(
      response.ok
        ? { ok: true, lines: lines(resultKind, data).filter(Boolean) }
        : { ok: false, lines: [String(data.error ?? "Import échoué")] },
    );
    if (response.ok) {
      setFile(null);
      setEmailsFile(null);
    }
  }

  const current = kinds[kind];
  const ready = Boolean(file) || (kind === "scolarite" && Boolean(emailsFile));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Imports</h1>
        <p className="mt-1 text-sm text-muted">
          Choisissez ce que vous importez, puis glissez le fichier Excel ou CSV.
        </p>
      </div>

      <section className="surface-card space-y-4 rounded-xl p-5">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Que voulez-vous importer ?</span>
          <select
            value={kind}
            onChange={(event) => choose(event.target.value as ImportKind)}
            className="field-select"
            aria-label="Type d’import"
          >
            {Object.entries(kinds).map(([value, item]) => (
              <option key={value} value={value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm leading-6 text-muted">{current.help}</p>

        {kind === "classList" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Classe</span>
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="field-select" aria-label="Classe">
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={kind === "scolarite" ? "grid gap-3 md:grid-cols-2" : ""}>
          <FileDropZone
            accept={current.accept}
            file={file}
            onFile={(next) => {
              setFile(next);
              setResult(null);
            }}
            disabled={busy}
            label={kind === "scolarite" ? "① Fichier scolarité" : "Glissez le fichier ici"}
            hint={current.accept.replaceAll(".", "").toUpperCase()}
          />
          {kind === "scolarite" ? (
            <FileDropZone
              accept=".csv,.xls,.xlsx"
              file={emailsFile}
              onFile={(next) => {
                setEmailsFile(next);
                setResult(null);
              }}
              disabled={busy}
              label="② Fichier CIN + e-mail (facultatif)"
              hint="CSV, XLS, XLSX"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy || !ready || (kind === "classList" && !classId)} onClick={() => void run()}>
            {busy ? "Import en cours…" : "Importer"}
          </Button>
          {file || emailsFile ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setEmailsFile(null);
              }}
            >
              Effacer
            </Button>
          ) : null}
        </div>

        {result ? (
          <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-surface-2" : "bg-[#f6e8e8] text-[#8f2d2d]"}`}>
            {result.lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
            {result.ok ? (
              <Link href={current.after.href} className="mt-2 inline-block font-medium underline">
                {current.after.label} →
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
