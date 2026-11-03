import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";
import { recalculateStudentSubjectAlert } from "@/lib/alerts";
import { sendPendingNotifications } from "@/lib/mail";
import { hasExpectedSignature } from "@/lib/upload-signature";

const MAX_BYTES = 5 * 1024 * 1024;
const AUTO_PREFIX = "Justificatif importé";
const types: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function uploadDir() {
  return path.resolve(
    process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"),
    "justificatifs",
  );
}

function storedPath(fileName: string) {
  // Stored names are generated server-side; basename guards against traversal.
  return path.join(uploadDir(), path.basename(fileName));
}

async function removeFile(fileName: string | null) {
  if (!fileName) return;
  await unlink(storedPath(fileName)).catch(() => undefined);
}

async function refreshAlert(studentId: string, subjectId: string | null) {
  if (!subjectId) return;
  const notificationId = await recalculateStudentSubjectAlert(
    studentId,
    subjectId,
  );
  if (notificationId) await sendPendingNotifications(1);
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    const att = id
      ? await prisma.attendance.findUnique({
          where: { id },
          select: { justificationFile: true, justificationFileName: true },
        })
      : null;
    if (!att?.justificationFile) {
      return NextResponse.json({ error: "Justificatif introuvable" }, { status: 404 });
    }
    const ext = att.justificationFile.split(".").pop()?.toLowerCase() ?? "";
    const bytes = await readFile(storedPath(att.justificationFile));
    const name = encodeURIComponent(att.justificationFileName ?? att.justificationFile);
    await audit(admin, "justificatif.view", { type: "attendance", id: id }, undefined, req);
    return new Response(bytes, {
      headers: {
        "Content-Type": types[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${name}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const form = await req.formData();
    const id = form.get("id");
    const file = form.get("file");
    if (typeof id !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!types[ext]) {
      return NextResponse.json(
        { error: "Format accepté : PDF, JPG, PNG ou WEBP" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (maximum 5 Mo)" },
        { status: 413 },
      );
    }
    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { session: { select: { subjectId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Saisie introuvable" }, { status: 404 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedSignature(ext, bytes)) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas à son format" },
        { status: 400 },
      );
    }

    // Server-generated name: nothing from the client reaches the filesystem path.
    const storedName = `${randomUUID()}.${ext}`;
    await mkdir(uploadDir(), { recursive: true });
    await writeFile(storedPath(storedName), bytes);

    const att = await prisma.attendance.update({
      where: { id },
      data: {
        present: false,
        justification:
          existing.justification?.trim() || `${AUTO_PREFIX} (${file.name})`,
        justificationFile: storedName,
        justificationFileName: file.name.slice(0, 200),
        amendedAt: new Date(),
        amendedById: admin.id,
      },
    });
    await removeFile(existing.justificationFile);
    await refreshAlert(att.studentId, existing.session.subjectId);
    await audit(admin, "justificatif.upload", { type: "attendance", id: att.id }, undefined, req);
    return NextResponse.json(att);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("justificatif", error);
    return NextResponse.json({ error: "Import du justificatif échoué" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    const existing = id
      ? await prisma.attendance.findUnique({
          where: { id },
          include: { session: { select: { subjectId: true } } },
        })
      : null;
    if (!existing) {
      return NextResponse.json({ error: "Saisie introuvable" }, { status: 404 });
    }
    const att = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        justificationFile: null,
        justificationFileName: null,
        ...(existing.justification?.startsWith(AUTO_PREFIX)
          ? { justification: null }
          : {}),
        amendedAt: new Date(),
        amendedById: admin.id,
      },
    });
    await removeFile(existing.justificationFile);
    await refreshAlert(att.studentId, existing.session.subjectId);
    await audit(admin, "justificatif.delete", { type: "attendance", id: att.id }, undefined, req);
    return NextResponse.json(att);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
