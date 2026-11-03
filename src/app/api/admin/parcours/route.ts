import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parcoursDigits } from "@/lib/parcours";
import { linkClassesToParcours, parseCourseElements, parseParcoursList } from "@/lib/parcours-import";
import { MAX_IMPORT_BYTES } from "@/lib/parse-upload";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

export async function GET() {
  try {
    await requireAdmin();
    const parcours = await prisma.parcours.findMany({
      orderBy: { code: "asc" },
      include: {
        _count: { select: { classes: true } },
        classes: { select: { name: true }, orderBy: { name: "asc" } },
        elements: {
          orderBy: [{ semester: "asc" }, { code: "asc" }],
          include: { subject: { select: { id: true, name: true, _count: { select: { sessions: true } } } } },
        },
      },
    });
    return NextResponse.json(parcours);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

// One file at a time, recognised by its content: the parcours list (Code,
// Mention, Spécialité) or the éléments d'enseignement (Code EE, Libellé…).
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      return NextResponse.json({ error: "Format accepté : XLSX, XLS ou CSV" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (maximum 5 Mo)" }, { status: 413 });
    }
    const buffer = await file.arrayBuffer();
    const elements = parseCourseElements(buffer);
    const list = elements.length ? [] : parseParcoursList(buffer);
    if (!elements.length && !list.length) {
      return NextResponse.json(
        {
          error:
            "Fichier non reconnu. Attendu : la liste des parcours (Code, Mention, Spécialité) ou les éléments d’enseignement (Code EE, Libellé, Rg, Coef, Crédit, TP, TD, Cours).",
        },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const result = await prisma.$transaction(
      async (tx) => {
        let parcoursCreated = 0;
        let parcoursUpdated = 0;
        for (const row of list) {
          const data = { domain: row.domain, mention: row.mention, specialty: row.specialty };
          const existing = await tx.parcours.findUnique({ where: { code: row.code }, select: { id: true } });
          await tx.parcours.upsert({ where: { code: row.code }, create: { code: row.code, ...data }, update: data });
          if (existing) parcoursUpdated++;
          else parcoursCreated++;
        }

        let elementsCreated = 0;
        let elementsUpdated = 0;
        if (elements.length) {
          const known = await tx.parcours.findMany({ select: { id: true, code: true } });
          const byCode = new Map(known.map((item) => [item.code, item.id]));
          for (const row of elements) {
            // Parcours from the title, else from the EE code prefix (661294111 → LI661294).
            let parcoursId = row.parcoursCode ? byCode.get(row.parcoursCode) : undefined;
            if (!parcoursId && !row.parcoursCode) {
              parcoursId = known.find((item) => row.code.startsWith(parcoursDigits(item.code)))?.id;
            }
            if (!parcoursId && row.parcoursCode) {
              // Unknown parcours: created with its code; the list import completes it.
              const created = await tx.parcours.create({ data: { code: row.parcoursCode }, select: { id: true } });
              byCode.set(row.parcoursCode, created.id);
              known.push({ id: created.id, code: row.parcoursCode });
              parcoursId = created.id;
              parcoursCreated++;
            }
            if (!parcoursId) {
              errors.push(`Ligne ${row.line} : parcours introuvable pour l’EE ${row.code}`);
              continue;
            }
            if (row.name.length < 2) {
              errors.push(`Ligne ${row.line} : libellé manquant pour l’EE ${row.code}`);
              continue;
            }
            if (row.semester < 1 || row.semester > 10) {
              errors.push(`Ligne ${row.line} : semestre invalide pour l’EE ${row.code}`);
              continue;
            }
            // The EE is a subject of the timetable, coded with the official EE code.
            const subject = await tx.subject.upsert({
              where: { code: row.code },
              create: { code: row.code, name: row.name.slice(0, 150) },
              update: { name: row.name.slice(0, 150), active: true },
              select: { id: true },
            });
            const data = {
              parcoursId,
              subjectId: subject.id,
              semester: row.semester,
              regime: row.regime,
              coefficient: row.coefficient,
              credits: row.credits,
              hoursLecture: row.hoursLecture,
              hoursTutorial: row.hoursTutorial,
              hoursLab: row.hoursLab,
            };
            const existing = await tx.courseElement.findUnique({ where: { code: row.code }, select: { id: true } });
            await tx.courseElement.upsert({ where: { code: row.code }, create: { code: row.code, ...data }, update: data });
            if (existing) elementsUpdated++;
            else elementsCreated++;
          }
        }
        const classesLinked = await linkClassesToParcours(tx);
        return { parcoursCreated, parcoursUpdated, elementsCreated, elementsUpdated, classesLinked };
      },
      { timeout: 60_000 },
    );
    await audit(admin, "parcours.import", { type: "workbook" }, { ...result, rejected: errors.length }, req);
    return NextResponse.json({ ...result, errors: errors.slice(0, 15), errorCount: errors.length });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("parcours.import", error);
    return NextResponse.json({ error: "Import échoué" }, { status: 500 });
  }
}

// Deletes a parcours and its EE list. The subjects stay (they may be planned).
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    await prisma.parcours.delete({ where: { id } });
    await audit(admin, "parcours.delete", { type: "parcours", id }, undefined, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
