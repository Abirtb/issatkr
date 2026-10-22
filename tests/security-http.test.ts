// End-to-end security boundaries against a running server.
// Run: SECURITY_BASE_URL=http://localhost:3000 npx tsx --test tests/security-http.test.ts
// Uses ADMIN_EMAIL/ADMIN_PASSWORD and PROF_EMAIL/PROF_PASSWORD from the environment.
import assert from "node:assert/strict";
import test from "node:test";

const BASE = process.env.SECURITY_BASE_URL;
const skip =
  !BASE || !process.env.ADMIN_PASSWORD || !process.env.PROF_PASSWORD
    ? "SECURITY_BASE_URL, ADMIN_PASSWORD and PROF_PASSWORD are required"
    : false;

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login ${email}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

const api = (path: string, cookie?: string, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });

test("security boundaries over HTTP", { skip }, async (t) => {
  const admin = await login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
  const prof = await login(
    process.env.PROF_EMAIL ?? "prof@issatkr.tn",
    process.env.PROF_PASSWORD!,
  );
  const me = (await (await api("/api/auth/me", prof)).json()).user;
  const sessions: { id: string; classId: string; professor: { id: string } | null }[] =
    await (await api("/api/schedule", admin)).json();
  const own = sessions.find((s) => s.professor?.id === me.id);
  const foreign = sessions.find((s) => s.professor && s.professor.id !== me.id);
  const ownClassIds = new Set(sessions.filter((s) => s.professor?.id === me.id).map((s) => s.classId));
  const foreignClass = sessions.find((s) => !ownClassIds.has(s.classId))?.classId;

  await t.test("unauthenticated requests are refused", async () => {
    for (const path of ["/api/admin/users", "/api/reports", "/api/classes", "/api/sessions/x", "/api/admin/attendance/justificatif?id=x"]) {
      assert.equal((await api(path)).status, 401, path);
    }
  });

  await t.test("forged or unsigned tokens are refused", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ id: me.id })).toString("base64url");
    const res = await api("/api/auth/me", `issatkr_session=${header}.${body}.`);
    assert.equal((await res.json()).user, null);
    assert.equal((await api("/api/admin/users", `issatkr_session=${header}.${body}.`)).status, 401);
  });

  await t.test("a teacher cannot call admin endpoints", async () => {
    const calls: [string, RequestInit?][] = [
      ["/api/admin/users"],
      ["/api/admin/attendance"],
      ["/api/admin/notifications"],
      ["/api/admin/settings", { method: "PUT", body: JSON.stringify({ absenceLimit: 99 }), headers: { "Content-Type": "application/json" } }],
      ["/api/admin/users", { method: "POST", body: JSON.stringify({ name: "x", email: "x@x.tn", password: "12345678", role: "ADMIN" }), headers: { "Content-Type": "application/json" } }],
      ["/api/admin/users/import", { method: "POST", body: new FormData() }],
      ["/api/admin/students/emails", { method: "POST", body: new FormData() }],
      ["/api/admin/classes/import", { method: "POST", body: new FormData() }],
      ["/api/admin/attendance/justificatif?id=x"],
      ["/api/schedule"],
    ];
    for (const [path, init] of calls) {
      const status = (await api(path, prof, init)).status;
      assert.ok(status === 403 || status === 401, `${init?.method ?? "GET"} ${path} -> ${status}`);
    }
  });

  await t.test("a teacher cannot read another teacher's session or class (IDOR)", async () => {
    if (foreign) {
      assert.equal((await api(`/api/sessions/${foreign.id}`, prof)).status, 403);
      const put = await api(`/api/sessions/${foreign.id}`, prof, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: [{ studentId: "x", present: false }] }),
      });
      assert.equal(put.status, 403);
    }
    if (foreignClass) {
      assert.equal((await api(`/api/classes/${foreignClass}`, prof)).status, 403);
      assert.equal((await api(`/api/reports?classId=${foreignClass}`, prof)).status, 403);
      assert.equal((await api(`/api/elimines?classId=${foreignClass}`, prof)).status, 403);
    }
  });

  await t.test("teacher responses do not expose CIN, e-mail or phone", async () => {
    if (!own) return;
    const data = await (await api(`/api/sessions/${own.id}`, prof)).json();
    for (const row of data.rows) {
      assert.deepEqual(Object.keys(row.student).sort(), ["firstName", "id", "lastName", "matricule"]);
    }
  });

  await t.test("spoofed justificatif files are rejected", async () => {
    const list = await (await api("/api/admin/attendance?status=all-absent", admin)).json();
    if (!list.length) return;
    for (const [name, content] of [["evil.pdf", "<html><script>alert(1)</script>"], ["evil.exe", "MZ..."], ["evil.svg", "<svg/>"]]) {
      const form = new FormData();
      form.set("id", list[0].id);
      form.set("file", new File([content], name));
      const res = await api("/api/admin/attendance/justificatif", admin, { method: "POST", body: form });
      assert.equal(res.status, 400, name);
    }
  });

  await t.test("cross-site writes are refused even with a valid session", async () => {
    const res = await api("/api/admin/settings", admin, {
      method: "PUT",
      headers: { "Content-Type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ absenceLimit: 3 }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("cron endpoint requires its bearer secret", async () => {
    assert.equal((await api("/api/cron/notifications", undefined, { method: "POST" })).status, 401);
    const wrong = await api("/api/cron/notifications", undefined, {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret-value" },
    });
    assert.equal(wrong.status, 401);
  });

  await t.test("security headers are sent", async () => {
    const res = await api("/");
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
    assert.match((await api("/api/auth/me")).headers.get("cache-control") ?? "", /no-store/);
  });

  await t.test("login brute force is rate limited", async () => {
    const email = `nobody-${Date.now()}@example.tn`;
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "wrong-password" }),
      })).status;
    }
    assert.equal(last, 429);
  });

  // ---- Student personal data (CIN) -------------------------------------
  const SENSITIVE = new Set(["cin", "phone", "firstNameAr", "lastNameAr"]);
  function sensitiveKeys(value: unknown, path = "$"): string[] {
    if (Array.isArray(value)) return value.flatMap((v, i) => sensitiveKeys(v, `${path}[${i}]`));
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([k, v]) => [
      ...(SENSITIVE.has(k) ? [`${path}.${k}`] : []),
      ...sensitiveKeys(v, `${path}.${k}`),
    ]);
  }

  await t.test("no teacher-reachable endpoint returns CIN or phone", async () => {
    const paths = ["/api/classes", "/api/elimines", "/api/auth/me"];
    if (own) paths.push(`/api/sessions/${own.id}`, `/api/classes/${own.classId}`, `/api/reports?classId=${own.classId}`);
    for (const path of paths) {
      const res = await api(path, prof);
      assert.equal(res.status, 200, path);
      assert.deepEqual(sensitiveKeys(await res.json()), [], path);
    }
  });

  await t.test("admin listing endpoints return identity only (no bulk CIN)", async () => {
    for (const path of ["/api/admin/attendance?status=", "/api/admin/notifications"]) {
      const res = await api(path, admin);
      assert.equal(res.status, 200, path);
      const rows = await res.json();
      assert.deepEqual(sensitiveKeys(rows), [], path);
      for (const row of rows) assert.equal(row.student.email, undefined, path);
    }
  });

  await t.test("CIN search matches exactly only (no partial enumeration)", async () => {
    const rows = await (await api(`/api/admin/attendance?status=&q=${encodeURIComponent("0")}`, admin)).json();
    // "0" appears inside many CINs; with exact CIN matching it may only match names/matricules/courses.
    for (const row of rows) {
      const visible = `${row.student.matricule} ${row.student.lastName} ${row.student.firstName} ${row.session.courseName}`;
      assert.ok(visible.includes("0"), "row matched on hidden CIN digits");
    }
  });

  await t.test("injection attempts fail safely", async () => {
    for (const q of ["' OR '1'='1", "1; DROP TABLE Student; --", '{"$ne":null}', "%' OR 1=1 --"]) {
      const res = await api(`/api/admin/attendance?status=&q=${encodeURIComponent(q)}`, admin);
      assert.equal(res.status, 200, q);
      assert.deepEqual(await res.json(), [], q);
    }
    for (const id of ["' OR '1'='1", "../../etc/passwd", '{"$ne":null}']) {
      const status = (await api(`/api/sessions/${encodeURIComponent(id)}`, prof)).status;
      assert.ok(status === 404 || status === 403, `${id} -> ${status}`);
      const file = (await api(`/api/admin/attendance/justificatif?id=${encodeURIComponent(id)}`, admin)).status;
      assert.equal(file, 404, `justificatif ${id}`);
    }
  });

  const classes: { id: string }[] = await (await api("/api/admin/classes", admin)).json();
  let student: { id: string; matricule: string; firstName: string; lastName: string } | undefined;
  let studentClass: string | undefined;
  for (const cls of classes) {
    const list = await (await api(`/api/admin/classes/${cls.id}/students`, admin)).json();
    if (list.length) { student = list[0]; studentClass = cls.id; break; }
  }

  await t.test("malformed CIN / phone and XSS payloads are rejected server-side", async () => {
    if (!student) return;
    for (const patch of [{ cin: "12<script>" }, { cin: "1' OR '1'='1" }, { phone: "<img src=x onerror=alert(1)>" }]) {
      const res = await api(`/api/admin/classes/${studentClass}/students`, admin, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, matricule: student.matricule, firstName: student.firstName, lastName: student.lastName, ...patch }),
      });
      assert.equal(res.status, 400, JSON.stringify(patch));
    }
  });

  await t.test("a teacher cannot read or change a student record", async () => {
    if (!student) return;
    assert.equal((await api(`/api/admin/students/${student.id}`, prof)).status, 403);
    const res = await api(`/api/admin/classes/${studentClass}/students`, prof, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, matricule: "x", firstName: "x", lastName: "x", cin: "99999999" }),
    });
    assert.equal(res.status, 403);
  });

  await t.test("viewing a student record is written to the audit trail, without personal data", async () => {
    if (!student) return;
    const { prisma } = await import("../src/lib/db");
    const before = new Date();
    assert.equal((await api(`/api/admin/students/${student.id}`, admin)).status, 200);
    const entry = await prisma.auditLog.findFirst({
      where: { action: "student.view", targetId: student.id, createdAt: { gte: before } },
    });
    assert.ok(entry, "no audit entry");
    assert.ok(entry.actorId);
    assert.ok(!JSON.stringify(entry).includes(student.lastName), "audit entry holds personal data");
  });

  await t.test("search endpoints are throttled per account (anti-scraping)", async () => {
    let last = 0;
    for (let i = 0; i < 61 && last !== 429; i++) last = (await api("/api/elimines", prof)).status;
    assert.equal(last, 429);
  });

  await t.test("logout revokes the session token server-side", async () => {
    const copied = await login(
      process.env.PROF_EMAIL ?? "prof@issatkr.tn",
      process.env.PROF_PASSWORD!,
    );
    assert.ok((await (await api("/api/auth/me", copied)).json()).user);
    assert.equal((await api("/api/auth/logout", copied, { method: "POST" })).status, 200);
    // The same cookie, replayed after logout, must be refused.
    assert.equal((await (await api("/api/auth/me", copied)).json()).user, null);
    assert.equal((await api("/api/classes", copied)).status, 401);
  });
});
