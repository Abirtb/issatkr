import nodemailer from "nodemailer";
import { prisma } from "./db";
import { logServerError } from "./security-log";

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
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      // 465 is always TLS from the start, 587 always STARTTLS: a mismatched
      // SMTP_SECURE only fails ("wrong version number"), so the port decides.
      secure: port === 465 ? true : port === 587 ? false : process.env.SMTP_SECURE === "true",
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

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

// Invitation / password link. Returns false (instead of throwing) when SMTP is
// not configured or sending fails, so the admin can hand the link over manually.
export async function sendAccountLinkEmail(input: {
  to: string;
  name: string;
  link: string;
  purpose: "INVITE" | "RESET";
  expiresAt: Date;
}) {
  // Development transport only prints messages: report "not sent" so the link is shown.
  if (process.env.SMTP_TRANSPORT === "json") return false;
  const until = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: process.env.ATTENDANCE_TIME_ZONE ?? "Africa/Tunis",
  }).format(input.expiresAt);
  const invite = input.purpose === "INVITE";
  const subject = invite
    ? "Activez votre compte ISSATKr Présence"
    : "Nouveau mot de passe — ISSATKr Présence";
  const intro = invite
    ? "un compte a été créé pour vous sur l’application de suivi des présences de l’ISSAT Kairouan."
    : "l’administration vous a envoyé un lien pour choisir un nouveau mot de passe.";
  try {
    const { from, transporter } = createMailTransport();
    await transporter.sendMail({
      from,
      to: input.to,
      subject,
      text: [
        `Bonjour ${input.name},`,
        "",
        `${intro[0].toUpperCase()}${intro.slice(1)}`,
        "Choisissez votre mot de passe avec ce lien :",
        input.link,
        "",
        `Le lien est valable jusqu’au ${until} et ne peut servir qu’une fois.`,
        "Si vous n’êtes pas concerné(e), ignorez ce message.",
        "",
        "ISSAT Kairouan",
      ].join("\n"),
      html: `<p>Bonjour ${escapeHtml(input.name)},</p>
        <p>${escapeHtml(intro[0].toUpperCase() + intro.slice(1))}</p>
        <p><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:10px 18px;background:#e29a2b;color:#071221;border-radius:8px;text-decoration:none;font-weight:600">Choisir mon mot de passe</a></p>
        <p style="font-size:13px;color:#555">Le lien est valable jusqu’au ${escapeHtml(until)} et ne peut servir qu’une fois.<br>
        Si le bouton ne fonctionne pas, copiez cette adresse : ${escapeHtml(input.link)}</p>
        <p style="font-size:13px;color:#555">Si vous n’êtes pas concerné(e), ignorez ce message.</p>
        <p>ISSAT Kairouan</p>`,
    });
    transporter.close();
    return true;
  } catch (error) {
    logServerError("mail.account-link", error);
    return false;
  }
}
