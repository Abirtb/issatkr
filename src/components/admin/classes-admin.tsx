"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [editingStudent, setEditingStudent] = useState<StudentRow | null>(null);
  const [classDraft, setClassDraft] = useState<ClassRow | null>(null);

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

  async function importSchoolWorkbook(file: File) {
    setImporting(true);
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    form.set("replace", "true");
    const response = await fetch("/api/admin/classes/import", {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) {
      setMessage(data.error);
      return;
    }
    const summary = `${data.classesCreated} classes créées, ${data.classesUpdated} mises à jour · ${data.studentsCreated} étudiants créés, ${data.studentsUpdated} mis à jour`;
    setMessage(
      data.warnings?.length
        ? `${summary}\n${data.warnings.join("\n")}`
        : summary,
    );
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
      await loadStudents(openId);
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
    <div>
      <h1 className="text-2xl font-semibold">Classes & étudiants</h1>
      <p className="mt-1 text-sm text-muted">
        Importez le fichier officiel : une feuille correspond à une classe.
      </p>

      <div className="surface-card mt-6 rounded-xl border-l-4 border-l-gold p-5">
        <p className="font-semibold">Importer le fichier scolarité XLS</p>
        <p className="mt-1 text-sm text-muted">
          Les champs Année, Parcours, Nom Groupe et Identifiant Groupe sont lus
          automatiquement. La liste officielle remplace les étudiants actifs
          sans supprimer leur historique de présence.
        </p>
        <label className="mt-4 inline-block cursor-pointer">
          <span className="inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-medium text-navy-deep">
            {importing ? "Import en cours…" : "Choisir le fichier XLS/XLSX"}
          </span>
          <input
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSchoolWorkbook(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {message ? (
        <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm">
          {message}
        </p>
      ) : null}

      <form
        onSubmit={createClass}
        className="mt-6 flex flex-wrap items-end gap-2"
      >
        <label className="text-sm">
          <span className="mb-1 block text-muted">Nom</span>
          <Input
            required
            placeholder="1ENR-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-48"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Code</span>
          <Input
            required
            placeholder="1ENR-1"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-40"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Niveau</span>
          <select
            value={newLevelId}
            onChange={(event) => setNewLevelId(event.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3"
          >
            <option value="">Non défini</option>
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.code} · {level.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Ajouter manuellement</Button>
      </form>

      <div className="mt-8 space-y-3">
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
                    className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
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
                            {student.email || "—"}
                          </td>
                          <td className="space-x-3 px-3 py-2 text-right">
                            <Link
                              href={`/admin/students/${student.id}`}
                              className="text-navy hover:underline"
                            >
                              Historique
                            </Link>
                            <button
                              type="button"
                              className="text-navy hover:underline"
                              onClick={() => setEditingStudent(student)}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="text-red-700 hover:underline"
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
