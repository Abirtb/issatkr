"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRevealOnOpen } from "@/lib/use-reveal";
import { maskCin } from "@/lib/student-fields";

type ClassRow = {
  id: string;
  name: string;
  code: string;
  externalId: string | null;
  program: string | null;
  academicYear: string | null;
  semester: number | null;
  levelId: string | null;
  level: { id: string; code: string; name: string } | null;
  _count: { students: number; sessions: number };
};

type StudentRow = {
  id: string;
  matricule: string;
  cin: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  classId?: string;
};

const emptyStudent = {
  matricule: "",
  cin: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

export function AdminClasses() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newLevelId, setNewLevelId] = useState("");
  const [levels, setLevels] = useState<
    { id: string; code: string; name: string; active: boolean }[]
  >([]);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [schoolFile, setSchoolFile] = useState<File | null>(null);
  const [emailsFile, setEmailsFile] = useState<File | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [classDraft, setClassDraft] = useState<ClassRow | null>(null);
  const studentEditForm = useRevealOnOpen<HTMLFormElement>(editingStudent?.id);

  async function load() {
    const response = await fetch("/api/admin/classes");
    const data = await response.json();
    setClasses(response.ok ? data : []);
  }

  async function loadStudents(classId: string) {
    const response = await fetch(`/api/admin/classes/${classId}/students`);
    const data = await response.json();
    setStudents(response.ok ? data : []);
  }

  useEffect(() => {
    void load();
    fetch("/api/admin/levels")
      .then((response) => response.json())
      .then((data) => {
        const active = Array.isArray(data)
          ? data.filter((level) => level.active)
          : [];
        setLevels(active);
        setNewLevelId(active[0]?.id ?? "");
      });
  }, []);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, levelId: newLevelId || null }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Classe ajoutée" : data.error);
    if (response.ok) {
      setName("");
      setCode("");
      await load();
    }
  }

  function describeEmails(emails: {
    updated: number;
    unchanged: number;
    notFound: string[];
    invalid: string[];
  }) {
    const lines = [
      `E-mails : ${emails.updated} ajoutés/modifiés, ${emails.unchanged} déjà à jour`,
    ];
    if (emails.notFound.length) {
      lines.push(
        `CIN introuvables (${emails.notFound.length}) : ${emails.notFound.slice(0, 20).join(", ")}${emails.notFound.length > 20 ? "…" : ""}`,
      );
    }
    if (emails.invalid.length) {
      lines.push(
        `E-mails invalides (${emails.invalid.length}) : ${emails.invalid.slice(0, 20).join(", ")}`,
      );
    }
    return lines;
  }

  async function importSchoolFiles() {
    if (!schoolFile && !emailsFile) return;
    setImporting(true);
    setMessage("");
    const form = new FormData();
    let url = "/api/admin/students/emails";
    if (schoolFile) {
      url = "/api/admin/classes/import";
      form.set("file", schoolFile);
      form.set("replace", "true");
      if (emailsFile) form.set("emailsFile", emailsFile);
    } else if (emailsFile) {
      form.set("file", emailsFile);
    }
    const response = await fetch(url, { method: "POST", body: form });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    const lines: string[] = [];
    if (schoolFile) {
      lines.push(
        `${data.classesCreated} classes créées, ${data.classesUpdated} mises à jour · ${data.studentsCreated} étudiants créés, ${data.studentsUpdated} mis à jour`,
      );
      if (data.emails) lines.push(...describeEmails(data.emails));
      if (data.warnings?.length) lines.push(...data.warnings);
    } else {
      lines.push(...describeEmails(data));
    }
    setMessage(lines.join("\n"));
    setSchoolFile(null);
    setEmailsFile(null);
    setOpenId(null);
    await load();
  }

  async function uploadClassList(
    classId: string,
    file: File,
    replace: boolean,
  ) {
    const form = new FormData();
    form.set("file", file);
    form.set("replace", String(replace));
    const response = await fetch(`/api/admin/classes/${classId}/students`, {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    setMessage(
      response.ok
        ? `Import réussi — ${data.created} créés, ${data.updated} mis à jour`
        : data.error,
    );
    if (response.ok) {
      await Promise.all([load(), loadStudents(classId)]);
    }
  }

  async function toggleClass(item: ClassRow) {
    if (openId === item.id) {
      setOpenId(null);
      return;
    }
    setOpenId(item.id);
    setClassDraft(item);
    setEditingStudent(null);
    setStudentForm(emptyStudent);
    await loadStudents(item.id);
  }

  async function saveClass(event: React.FormEvent) {
    event.preventDefault();
    if (!classDraft) return;
    const response = await fetch("/api/admin/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classDraft),
    });
    const data = await response.json();
    setMessage(response.ok ? "Classe mise à jour" : data.error);
    if (response.ok) await load();
  }

  async function deleteClass(classId: string) {
    if (!window.confirm("Supprimer définitivement cette classe et ses étudiants ?")) {
      return;
    }
    const response = await fetch(`/api/admin/classes?id=${classId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(response.ok ? "Classe supprimée" : data.error);
    if (response.ok) {
      setOpenId(null);
      await load();
    }
  }

  async function addStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!openId) return;
    const response = await fetch(`/api/admin/classes/${openId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(studentForm),
    });
    const data = await response.json();
    setMessage(response.ok ? "Étudiant ajouté" : data.error);
    if (response.ok) {
      setStudentForm(emptyStudent);
      await Promise.all([load(), loadStudents(openId)]);
    }
  }

  async function saveStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!openId || !editingStudent) return;
    const response = await fetch(`/api/admin/classes/${openId}/students`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editingStudent,
        studentId: editingStudent.id,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Étudiant modifié" : data.error);
    if (response.ok) {
      setEditingStudent(null);
      await Promise.all([load(), loadStudents(openId)]);
    }
  }

  async function deactivateStudent(studentId: string) {
    if (!openId || !window.confirm("Retirer cet étudiant de la classe ?")) return;
    const response = await fetch(
      `/api/admin/classes/${openId}/students?studentId=${studentId}`,
      { method: "DELETE" },
    );
    const data = await response.json();
    setMessage(response.ok ? "Étudiant retiré" : data.error);
    if (response.ok) {
      await Promise.all([load(), loadStudents(openId)]);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Classes et étudiants
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Importez le fichier officiel : une feuille correspond à une classe.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="surface-card rounded-xl border-l-4 border-l-gold p-5">
          <p className="font-semibold">Importer le fichier scolarité</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            ① Fichier scolarité : Année, Parcours, Nom Groupe et Identifiant
            Groupe sont lus automatiquement. La liste officielle remplace les
            étudiants actifs sans supprimer leur historique.
            <br />② Fichier e-mails (facultatif) : colonnes CIN, Nom et E-mail.
            Les e-mails sont associés aux étudiants par leur CIN. Il peut aussi
            être importé seul, plus tard.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="min-w-0 cursor-pointer">
              <span className="block h-10 truncate rounded-lg border border-border px-3 text-sm leading-10">
                {schoolFile
                  ? `① ${schoolFile.name}`
                  : "① Fichier scolarité (XLS / XLSX)"}
              </span>
              <input
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                disabled={importing}
                onChange={(event) => {
                  setSchoolFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="min-w-0 cursor-pointer">
              <span className="block h-10 truncate rounded-lg border border-border px-3 text-sm leading-10">
                {emailsFile
                  ? `② ${emailsFile.name}`
                  : "② Fichier CIN + e-mail (facultatif)"}
              </span>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                disabled={importing}
                onChange={(event) => {
                  setEmailsFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="gold"
              disabled={importing || (!schoolFile && !emailsFile)}
              onClick={() => void importSchoolFiles()}
            >
              {importing
                ? "Import en cours…"
                : schoolFile
                  ? "Importer"
                  : "Importer les e-mails"}
            </Button>
            {schoolFile || emailsFile ? (
              <Button
                variant="secondary"
                disabled={importing}
                onClick={() => {
                  setSchoolFile(null);
                  setEmailsFile(null);
                }}
              >
                Effacer
              </Button>
            ) : null}
          </div>
        </div>

        <form
          onSubmit={createClass}
          className="surface-card grid gap-3 rounded-xl p-5 sm:grid-cols-2"
        >
          <p className="font-semibold sm:col-span-2">Ajouter une classe</p>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Nom</span>
            <Input
              required
              placeholder="1ENR-1"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Code</span>
            <Input
              required
              placeholder="1ENR-1"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Niveau</span>
            <select
              value={newLevelId}
              onChange={(event) => setNewLevelId(event.target.value)}
              className="field-select"
            >
              <option value="">Non défini</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.code} · {level.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="sm:col-span-2">
            Ajouter manuellement
          </Button>
        </form>
      </div>

      {message ? (
        <p className="whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <div className="space-y-3">
        {classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
            Aucune classe pour le moment. Importez un fichier ou ajoutez-en une
            manuellement.
          </p>
        ) : null}
        {classes.map((item) => (
          <div key={item.id} className="surface-card rounded-xl">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-muted">
                  {item.code} · {item._count.students} étudiants ·{" "}
                  {item._count.sessions} séances
                </p>
                {item.program ? (
                  <p className="mt-1 truncate text-xs text-muted">
                    {item.program}
                    {item.academicYear ? ` · ${item.academicYear}` : ""}
                    {item.semester ? ` · S${item.semester}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">
                  Niveau : {item.level?.name ?? "non défini"}
                </p>
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm">
                  Importer une liste
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadClassList(item.id, file, true);
                    event.target.value = "";
                  }}
                />
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void toggleClass(item)}
              >
                {openId === item.id ? "Fermer" : "Gérer"}
              </Button>
            </div>

            {openId === item.id && classDraft ? (
              <div className="border-t border-border p-4">
                <form
                  onSubmit={saveClass}
                  className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <Input
                    required
                    value={classDraft.name}
                    onChange={(event) =>
                      setClassDraft({ ...classDraft, name: event.target.value })
                    }
                    placeholder="Nom"
                  />
                  <Input
                    required
                    value={classDraft.code}
                    onChange={(event) =>
                      setClassDraft({ ...classDraft, code: event.target.value })
                    }
                    placeholder="Code"
                  />
                  <Input
                    value={classDraft.program ?? ""}
                    onChange={(event) =>
                      setClassDraft({
                        ...classDraft,
                        program: event.target.value,
                      })
                    }
                    placeholder="Parcours"
                  />
                  <Input
                    value={classDraft.academicYear ?? ""}
                    onChange={(event) =>
                      setClassDraft({
                        ...classDraft,
                        academicYear: event.target.value,
                      })
                    }
                    placeholder="Année"
                  />
                  <select
                    value={classDraft.levelId ?? ""}
                    onChange={(event) =>
                      setClassDraft({
                        ...classDraft,
                        levelId: event.target.value || null,
                      })
                    }
                    className="field-select"
                  >
                    <option value="">Niveau non défini</option>
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.code} · {level.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm">
                    Modifier la classe
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="text-red-700"
                    onClick={() => void deleteClass(classDraft.id)}
                  >
                    Supprimer la classe
                  </Button>
                </form>

                <form
                  onSubmit={addStudent}
                  className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <Input
                    required
                    value={studentForm.matricule}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        matricule: event.target.value,
                      })
                    }
                    placeholder="N° inscription"
                  />
                  <Input
                    required
                    value={studentForm.lastName}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        lastName: event.target.value,
                      })
                    }
                    placeholder="Nom"
                  />
                  <Input
                    required
                    value={studentForm.firstName}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        firstName: event.target.value,
                      })
                    }
                    placeholder="Prénom"
                  />
                  <Input
                    value={studentForm.cin}
                    onChange={(event) =>
                      setStudentForm({ ...studentForm, cin: event.target.value })
                    }
                    placeholder="CIN"
                  />
                  <Input
                    type="email"
                    value={studentForm.email}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="E-mail"
                  />
                  <Input
                    value={studentForm.phone}
                    onChange={(event) =>
                      setStudentForm({
                        ...studentForm,
                        phone: event.target.value,
                      })
                    }
                    placeholder="Téléphone"
                  />
                  <Button type="submit" variant="gold" size="sm">
                    Ajouter étudiant
                  </Button>
                </form>

                <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-surface-2 text-left text-muted">
                      <tr>
                        <th className="px-3 py-2">N° inscription</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Prénom</th>
                        <th className="px-3 py-2">CIN</th>
                        <th className="px-3 py-2">E-mail</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr
                          key={student.id}
                          className="border-t border-border"
                        >
                          <td className="px-3 py-2">{student.matricule}</td>
                          <td className="px-3 py-2">{student.lastName}</td>
                          <td className="px-3 py-2">{student.firstName}</td>
                          <td className="px-3 py-2 text-muted">
                            {maskCin(student.cin)}
                          </td>
                          <td className="px-3 py-2 text-muted">
                            {student.email || "—"}
                          </td>
                          <td className="space-x-2 whitespace-nowrap px-3 py-1 text-right">
                            <Link
                              href={`/admin/students/${student.id}`}
                              className="inline-flex min-h-9 items-center px-1 text-navy hover:underline"
                            >
                              Historique
                            </Link>
                            <button
                              type="button"
                              className="inline-flex min-h-9 items-center px-1 text-navy hover:underline"
                              onClick={() => setEditingStudent(student)}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="min-h-9 px-1 text-red-700 hover:underline"
                              onClick={() =>
                                void deactivateStudent(student.id)
                              }
                            >
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {students.length === 0 ? (
                    <p className="p-5 text-center text-sm text-muted">
                      Aucun étudiant actif dans cette classe.
                    </p>
                  ) : null}
                </div>

                {editingStudent ? (
                  <form
                    ref={studentEditForm}
                    onSubmit={saveStudent}
                    className="mt-4 grid gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <Input
                      required
                      value={editingStudent.matricule}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          matricule: event.target.value,
                        })
                      }
                      placeholder="N° inscription"
                    />
                    <Input
                      required
                      value={editingStudent.lastName}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          lastName: event.target.value,
                        })
                      }
                      placeholder="Nom"
                    />
                    <Input
                      required
                      value={editingStudent.firstName}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          firstName: event.target.value,
                        })
                      }
                      placeholder="Prénom"
                    />
                    <Input
                      type="email"
                      value={editingStudent.email ?? ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          email: event.target.value,
                        })
                      }
                      placeholder="E-mail"
                    />
                    <Input
                      value={editingStudent.cin ?? ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          cin: event.target.value,
                        })
                      }
                      placeholder="CIN"
                    />
                    <Input
                      value={editingStudent.phone ?? ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          phone: event.target.value,
                        })
                      }
                      placeholder="Téléphone"
                    />
                    <select
                      value={editingStudent.classId ?? openId ?? ""}
                      onChange={(event) =>
                        setEditingStudent({
                          ...editingStudent,
                          classId: event.target.value,
                        })
                      }
                      className="field-select"
                      aria-label="Classe"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm">
                      Enregistrer
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditingStudent(null)}
                    >
                      Annuler
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
