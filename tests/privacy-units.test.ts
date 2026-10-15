// Student-data protections that can be checked without a server.
import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { escapeHtml } from "../src/lib/mail";
import { parseStudentsRows } from "../src/lib/parse-upload";
import { describeError, logServerError, safeDetails } from "../src/lib/security-log";
import { cinField, cleanCin, maskCin, phoneField } from "../src/lib/student-fields";

const CIN = "07345612";

function captureConsole(run: () => void) {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    run();
  } finally {
    console.error = original;
  }
  return lines.join("\n");
}

test("logs: a Prisma validation error carrying student data is logged without it", () => {
  const error = new Prisma.PrismaClientValidationError(
    `Invalid prisma.student.upsert() invocation: { cin: "${CIN}", email: "amine@example.tn", firstName: "Amine" }`,
    { clientVersion: "6.19.3" },
  );
  const output = captureConsole(() => logServerError("students.import", error));
  assert.ok(output.includes("PrismaClientValidationError"));
  assert.ok(!output.includes(CIN), "CIN leaked to logs");
  assert.ok(!output.includes("amine@example.tn"), "e-mail leaked to logs");
  assert.ok(!output.includes("Amine"), "name leaked to logs");
});

test("logs: a unique-constraint error keeps field names, never values", () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { target: ["matricule", "classId"] },
  });
  assert.deepEqual(describeError(error), {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
    target: ["matricule", "classId"],
    model: undefined,
  });
});

test("logs: other errors have CIN-like numbers and e-mails redacted", () => {
  const output = captureConsole(() =>
    logServerError("x", new Error(`student ${CIN} amine@example.tn not found`)),
  );
  assert.ok(!output.includes(CIN));
  assert.ok(!output.includes("amine@example.tn"));
});

test("audit trail: sensitive values are dropped from audit details", () => {
  const stored = safeDetails({
    cin: CIN,
    email: "a@b.tn",
    password: "secret-value",
    fields: ["cin", "phone"],
    rows: 42,
  });
  assert.equal(stored, JSON.stringify({ fields: ["cin", "phone"], rows: 42 }));
});

test("CIN: format validated server-side, normalised, masked in lists", () => {
  assert.equal(cinField.parse(" 0734 5612 "), CIN);
  assert.equal(cinField.parse(""), "");
  assert.equal(cinField.safeParse("12<script>").success, false);
  assert.equal(cinField.safeParse("1' OR '1'='1").success, false);
  assert.equal(cleanCin("abc"), null);
  assert.equal(cleanCin("A1234567"), "A1234567");
  assert.equal(maskCin(CIN), "•••••612");
  assert.ok(!maskCin(CIN).includes("07345"));
  assert.equal(phoneField.safeParse("+216 22 111 222").success, true);
  assert.equal(phoneField.safeParse("<img src=x>").success, false);
});

test("imports: a CIN column is never used as the (teacher-visible) matricule", () => {
  const rows = parseStudentsRows([{ cin: CIN, nom: "Ben Ali", prenom: "Amine" }]);
  assert.equal(rows.length, 0);
  const ok = parseStudentsRows([{ matricule: "2026001", cin: CIN, nom: "Ben Ali", prenom: "Amine" }]);
  assert.equal(ok[0].matricule, "2026001");
});

test("XSS: student names are escaped in notification e-mails", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
  );
});
