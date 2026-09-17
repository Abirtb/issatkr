import nodemailer from "nodemailer";
import { prisma } from "./db";

export function createMailTransport() {
  const from = process.env.SMTP_FROM;
  if (!from) throw new Error("SMTP_NOT_CONFIGURED");
  if (process.env.SMTP_TRANSPORT === "json") {
    return {
      from,
      transporter: nodemailer.createTransport({ jsonTransport: true }),
    };
  }
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_NOT_CONFIGURED");
  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASSWORD
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      pool: true,
      maxConnections: 3,
    }),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendNotification(notificationId: string) {
  const claimed = await prisma.notificationLog.updateMany({
    where: {
      id: notificationId,
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 5 },
    },
    data: { status: "SENDING", attempts: { increment: 1 }, error: null },
  });
  if (!claimed.count) return false;

  try {
    const notification = await prisma.notificationLog.findUnique({
      where: { id: notificationId },
      include: { student: true, subject: true, level: true },
    });
    if (!notification) return false;
    const { from, transporter } = createMailTransport();
    const eliminated = notification.type === "ELIMINATION";
    const studentName = `${notification.student.firstName} ${notification.student.lastName}`;
    const subject = eliminated
      ? `Élimination pour absence — ${notification.subject.name}`
      : `Avertissement d’absences — ${notification.subject.name}`;
    const status = eliminated
      ? "le seuil d’élimination est atteint"
      : "vous approchez du seuil d’élimination";
    const text = [
      `Bonjour ${studentName},`,
      "",
      `Pour la matière ${notification.subject.name}, ${status}.`,
      `Absences non justifiées : ${notification.absenceCount}.`,
      `Seuil d’élimination : ${notification.threshold}.`,
      "",
      "Veuillez contacter l’administration si une absence doit être justifiée.",
      "",
      "ISSAT Kairouan",
    ].join("\n");
    await transporter.sendMail({
      from,
      to: notification.recipient,
      subject,
      text,
      html: `<p>Bonjour ${escapeHtml(studentName)},</p>
        <p>Pour la matière <strong>${escapeHtml(notification.subject.name)}</strong>, ${status}.</p>
        <p>Absences non justifiées : <strong>${notification.absenceCount}</strong><br>
        Seuil d’élimination : <strong>${notification.threshold}</strong></p>
        <p>Veuillez contacter l’administration si une absence doit être justifiée.</p>
        <p>ISSAT Kairouan</p>`,
    });
    await transporter.close();
    await prisma.notificationLog.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
    return true;
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: notificationId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Erreur SMTP",
      },
    });
    return false;
  }
}

export async function sendPendingNotifications(limit = 10) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.notificationLog.updateMany({
    where: { status: "SENDING", updatedAt: { lt: staleBefore } },
    data: { status: "FAILED", error: "Envoi interrompu, relance planifiée" },
  });
  const notifications = await prisma.notificationLog.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: 5 },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
  });
  const results = [];
  for (const notification of notifications) {
    results.push(await sendNotification(notification.id));
  }
  return {
    processed: results.length,
    sent: results.filter(Boolean).length,
  };
}
