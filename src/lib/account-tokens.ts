import { createHash, randomBytes } from "node:crypto";
import type { TokenPurpose } from "@prisma/client";
import { prisma } from "./db";

// One-time links to choose a password: INVITE (new account) or RESET (forgotten
// password, sent by an admin). The database keeps only a SHA-256 hash, so a copy
// of the database cannot be used to activate accounts.
export const TOKEN_TTL_HOURS = 72;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Unusable password for invited accounts: nobody knows it, so login is
// impossible until the invitation link sets a real one.
export function unusablePassword() {
  return randomBytes(32).toString("base64url");
}

export async function issueAccountToken(
  userId: string,
  purpose: TokenPurpose,
  createdById: string | null,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  await prisma.$transaction([
    // A new link replaces any earlier one still pending for this account.
    prisma.accountToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    }),
    prisma.accountToken.create({
      data: { userId, tokenHash: hashToken(token), purpose, expiresAt, createdById },
    }),
  ]);
  return { token, expiresAt };
}

export async function findUsableToken(token: unknown) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const record = await prisma.accountToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.active) {
    return null;
  }
  return record;
}

// Has this account ever been activated through an invitation, or created with a
// password? Decides whether a new link is an INVITE or a RESET.
export async function linkPurposeFor(userId: string): Promise<TokenPurpose> {
  const tokens = await prisma.accountToken.findMany({
    where: { userId, purpose: "INVITE" },
    select: { usedAt: true },
  });
  const neverActivated = tokens.length > 0 && tokens.every((token) => !token.usedAt);
  return neverActivated ? "INVITE" : "RESET";
}

// Public base URL used in e-mailed links. APP_URL is authoritative in production
// (never trust a client-supplied Host for links sent by e-mail).
export function appBaseUrl(req: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost";
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

// The token goes after "#": browsers never send that part to the server, so it
// never appears in Nginx or application logs.
export function accountLink(baseUrl: string, token: string) {
  return `${baseUrl}/activation#${token}`;
}

export type DeliveredLink = { emailed: boolean; expiresAt: string; link?: string };

// Creates a link and e-mails it. The link is returned to the admin ONLY when the
// e-mail could not be sent, so it can be handed over by another channel.
export async function createAndSendLink(
  req: Request,
  user: { id: string; name: string; email: string },
  purpose: TokenPurpose,
  actorId: string,
): Promise<DeliveredLink> {
  const { sendAccountLinkEmail } = await import("./mail");
  const { token, expiresAt } = await issueAccountToken(user.id, purpose, actorId);
  const link = accountLink(appBaseUrl(req), token);
  const emailed = await sendAccountLinkEmail({
    to: user.email,
    name: user.name,
    link,
    purpose,
    expiresAt,
  });
  return { emailed, expiresAt: expiresAt.toISOString(), ...(emailed ? {} : { link }) };
}
