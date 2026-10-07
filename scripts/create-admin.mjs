#!/usr/bin/env node
// Creates the FIRST administrator of a fresh production database.
// No demo data, no default password. The password is typed interactively
// (or piped on stdin for automation) and never printed or stored in a file.
//
//   docker compose run --rm migrate node scripts/create-admin.mjs --email admin@YOUR_DOMAIN --name "Prénom Nom"
//
// Refuses to run when an active administrator already exists (use the
// "Utilisateurs" page for further accounts) or when the e-mail is taken.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import readline from "node:readline";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]?.startsWith("--") ? true : all[i + 1] ?? true]);
    return pairs;
  }, []),
);
const email = String(args.email ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const name = String(args.name ?? "Administrateur").trim();

function fail(message) {
  console.error(`create-admin: ${message}`);
  process.exit(1);
}

function passwordProblem(password) {
  if (password.length < 8) return "8 characters minimum";
  if (Buffer.byteLength(password, "utf8") > 72) return "72 bytes maximum (bcrypt limit)";
  return null;
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY) {
    // Automation: first line of stdin.
    const rl = readline.createInterface({ input: process.stdin });
    for await (const line of rl) {
      rl.close();
      return line;
    }
    return "";
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (text) => {
      if (!rl.stdoutMuted) rl.output.write(text);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("pass a valid --email");
if (name.length < 2) fail("pass --name (2 characters minimum)");

const prisma = new PrismaClient();
try {
  if (await prisma.user.count({ where: { role: "ADMIN", active: true } })) {
    fail("an active administrator already exists; create other accounts from the Utilisateurs page");
  }
  if (await prisma.user.findUnique({ where: { email } })) fail("this e-mail is already used by an account");

  const password = await readSecret("Password for the new administrator: ");
  const problem = passwordProblem(password);
  if (problem) fail(`password rejected: ${problem}`);
  if (process.stdin.isTTY && (await readSecret("Repeat the password: ")) !== password) {
    fail("the two passwords differ");
  }

  await prisma.user.create({
    data: { email, name, role: "ADMIN", password: await bcrypt.hash(password, 12) },
  });
  console.log(`create-admin: administrator account created for ${email}`);
} finally {
  await prisma.$disconnect();
}
