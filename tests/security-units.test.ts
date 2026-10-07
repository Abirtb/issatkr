import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { csvCell, csvRow } from "../src/lib/csv";
import { rateLimit } from "../src/lib/rate-limit";
import { hasExpectedSignature } from "../src/lib/upload-signature";
import { middleware } from "../src/middleware";

process.env.AUTH_SECRET ??= "test-secret-for-unit-tests-only-0123456789";

const enc = (text: string) => new TextEncoder().encode(text);

test("uploads: a renamed file is rejected by its content signature", () => {
  assert.equal(hasExpectedSignature("pdf", enc("%PDF-1.7 ...")), true);
  assert.equal(hasExpectedSignature("pdf", enc("<html><script>alert(1)</script>")), false);
  assert.equal(
    hasExpectedSignature("png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    true,
  );
  assert.equal(hasExpectedSignature("png", enc("GIF89a")), false);
  assert.equal(hasExpectedSignature("jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(hasExpectedSignature("webp", enc("RIFF\0\0\0\0WEBPVP8 ")), true);
  assert.equal(hasExpectedSignature("exe", enc("MZ")), false);
  assert.equal(hasExpectedSignature("svg", enc("<svg onload=alert(1)>")), false);
});

test("csv exports: formula injection is neutralised and cells are quoted", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell("+1+1"), `"'+1+1"`);
  assert.equal(csvCell("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(csvCell("Ben Ali; Amine"), `"Ben Ali; Amine"`);
  assert.equal(csvRow(["a", 3, null]), `"a";"3";""`);
});

test("rate limit: blocks after the limit and reopens after the window", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 1000, 0).allowed, true);
  assert.equal(rateLimit(key, 3, 1000, 10).allowed, false);
  assert.equal(rateLimit(key, 3, 1000, 1001).allowed, true);
});

function request(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://app.local${path}`, {
    method: init.method ?? "GET",
    headers: { host: "app.local", ...init.headers },
  });
}

test("middleware: API paths cannot skip the session gate with a dot", async () => {
  const res = middleware(request("/api/admin/users.json"));
  assert.equal(res.status, 401);
  const res2 = middleware(request("/api/admin/attendance/justificatif?id=../../.env"));
  assert.equal(res2.status, 401);
});

test("middleware: cross-site state-changing requests are refused", async () => {
  const cookie = { cookie: "issatkr_session=x" };
  const crossOrigin = middleware(
    request("/api/admin/users", { method: "POST", headers: { ...cookie, origin: "https://evil.example" } }),
  );
  assert.equal(crossOrigin.status, 403);
  const crossSite = middleware(
    request("/api/admin/users", { method: "DELETE", headers: { ...cookie, "sec-fetch-site": "cross-site" } }),
  );
  assert.equal(crossSite.status, 403);
  const sameOrigin = middleware(
    request("/api/admin/users", {
      method: "POST",
      headers: { ...cookie, origin: "http://app.local", "sec-fetch-site": "same-origin" },
    }),
  );
  assert.notEqual(sameOrigin.status, 403);
});

test("middleware: oversized bodies are refused before parsing", () => {
  const res = middleware(
    request("/api/admin/classes/import", {
      method: "POST",
      headers: { cookie: "issatkr_session=x", "content-length": String(50 * 1024 * 1024) },
    }),
  );
  assert.equal(res.status, 413);
});

test("sessions: a password change invalidates the session fingerprint", async () => {
  const { passwordFingerprint } = await import("../src/lib/auth");
  const before = passwordFingerprint("$2b$12$oldhash");
  assert.equal(before, passwordFingerprint("$2b$12$oldhash"));
  assert.notEqual(before, passwordFingerprint("$2b$12$newhash"));
  assert.ok(!before.includes("oldhash"));
});
