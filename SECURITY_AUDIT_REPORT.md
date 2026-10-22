# Security Audit & Remediation Report

**Application:** ISSATKr — student attendance tracking (Next.js 16 App Router, Prisma 6 / SQLite, JWT cookie sessions)
**Dates:** first pass 2026-10-05; second pass on student personal data and CIN 2026-10-07
**Scope:** the entire repository: all 33 API route handlers, middleware, server libraries, client components that handle data, configuration, dependencies, Git-tracked files and Git history.

## Executive Summary

The code-level remediation is complete. The application builds, all tests pass, and production dependencies have no known vulnerabilities. Each fixed issue was traced from the HTTP entry point to the database. 20 HTTP boundary tests were run against a production build.

The second pass treated student data, and CINs in particular, as high-sensitivity. It found and fixed:

- **1 High:** student personal data, including CINs, could be written to server logs through raw Prisma errors.
- **5 Medium:** bulk CIN exposure in admin listings, partial-CIN search, a CIN fallback into the teacher-visible matricule, no audit trail, and no server-side logout.
- **4 Low**, plus 2 new dependency advisories.

The details are in *Second Pass: Student Personal Data and CIN*.

**One High-severity issue remains. It cannot be fixed safely from inside the repository:** a development database, `prisma/dev.db`, was committed and pushed to `origin/main` (GitHub).

- **It contained test/development data only.** It held no real student records and no production school data, as confirmed by the project owner.
- **Privacy impact:** no known production or student data exposure.
- **Why it is still a blocker:** the file contains bcrypt password hashes of the application's accounts, so it must be removed from Git history as a security-hygiene measure.

The file is now untracked and ignored. Removing it from history requires a force-push, which is a manual step (see *Remaining Vulnerabilities*).

**Final status: FAIL (blocking) until `prisma/dev.db` is purged from Git history (manual step). After that: PASS WITH WARNINGS.** No open Critical or High issue remains in the code itself.

## Second Pass: Student Personal Data and CIN

### How CIN flows through the application (traced end to end)

| Where | Who | Before | After |
|---|---|---|---|
| Stored: `Student.cin` (SQLite, plaintext column) | — | — | Unchanged (encryption at rest: see "Requires infrastructure verification") |
| Written: scolarité import, CIN/e-mail import, manual add/edit | Admin | Any string up to 20 characters | Validated server-side (`^[A-Za-z0-9]{4,20}$` after removing spaces, dots and dashes); invalid values rejected (400) or, on import, stored as empty |
| Read: `GET /api/admin/classes/:id/students` | Admin | Full record | Full record (kept: the admin edits CINs). **Masked in the list** (`•••••612`); full value only in the edit form |
| Read: `GET /api/admin/attendance`, `GET /api/admin/notifications` | Admin | **Full student record (CIN, phone, Arabic names, e-mail), up to 200 rows per call** | Identity only (`id, firstName, lastName, matricule, class.name`) |
| Read: `GET /api/admin/students/:id` | Admin | Full record + all attendance rows | Only the fields the page shows (no CIN, no phone) |
| Search: `GET /api/admin/attendance?q=` | Admin | `contains` on CIN (partial-CIN enumeration) | **Exact** CIN match only |
| Teacher endpoints (`/api/classes*`, `/api/sessions/*`, `/api/reports`, `/api/elimines`) | Teacher / head of department | Already minimized in the first pass | Verified by test: no `cin` / `phone` key anywhere in the JSON |
| Per-class list import | Admin | **A `cin` column was used as the matricule** when no matricule column existed. The matricule is shown to every teacher | CIN never used as matricule (the database was checked: 0 existing students affected) |
| Logs | Server | Raw Prisma errors logged: a failed import could print CIN, names, e-mails | Redacting logger: Prisma messages never logged (only error code and field names); digit runs ≥5 and e-mails redacted elsewhere |
| Audit trail | Server | None | Actions logged without values (only changed **field names**, e.g. `fields:["cin"]`) |
| URLs, localStorage/sessionStorage, analytics | Browser | None found (searched) | Unchanged |
| CSV exports | Admin / teacher | Reports export: no CIN | Unchanged (verified) |

### Second-pass findings

| # | Severity | Component | Vulnerability / risk | Fix | Verification |
|---|---|---|---|---|---|
| P1 | **High** | 7 API routes (`console.error(e)`) | Prisma validation errors print the full query arguments, so a failed import or update logged students' **CIN, names, e-mails, phones** to server logs | `src/lib/security-log.ts`: `logServerError()` logs only error name, code and field/model names for Prisma errors; other messages have e-mails and digit runs redacted. All 8 routes switched; no raw `console.error` remains in `src/` | `privacy-units`: Prisma error containing a CIN → output has no CIN, e-mail or name |
| P2 | Medium | `GET /api/admin/attendance`, `GET /api/admin/notifications` | Each call returned up to 200 **full student records including CIN** that the page never displays (bulk exposure if an admin session is hijacked, or via browser tools/extensions) | Explicit Prisma `select` (identity fields only) | HTTP: "admin listing endpoints return identity only" |
| P3 | Medium | `GET /api/admin/attendance?q=` | `contains` search on CIN allowed enumeration by partial digits | Exact CIN match only; name/matricule/course search unchanged | HTTP: "CIN search matches exactly only" |
| P4 | Medium | `parseStudentsRows` (per-class import) | CIN fell back into `matricule`, which every teacher sees | Fallback removed | `privacy-units`: "a CIN column is never used as the matricule" |
| P5 | Medium | Whole API | **No audit trail** for viewing, changing, importing or deactivating student data, for account and role changes, or for justificatifs | `AuditLog` table (migration `20261007120000`), `audit()` helper: actor, role, action, target, IP, timestamp; details never contain sensitive keys (CIN, e-mail, phone, names, passwords). Wired into 24 actions (login/logout, student view/create/update/deactivate/import, e-mail import, class/user CRUD, user import, attendance record/amend, justificatif upload/view/delete, settings, thresholds) | HTTP: "viewing a student record is written to the audit trail, without personal data"; database check: 0 audit rows contain a student CIN, e-mail or name |
| P6 | Medium | `src/lib/auth.ts`, logout | Logout only deleted the cookie: a copied token stayed valid **7 days** | `User.sessionVersion` in the token, bumped on logout (revokes every earlier token for that account); session lifetime **12 h** (one school day) | HTTP: "logout revokes the session token server-side" (replayed cookie → 401) |
| P7 | Low | Student create/edit | CIN and phone not format-validated server-side | `cinField` / `phoneField` (zod) | HTTP: malformed CIN, SQL-like and HTML payloads → 400 |
| P8 | Low | Search/report/import endpoints | Only login was rate limited; a valid account could scrape in a loop | Per-account limits: search/reports/éliminés 60/min, student record 120/min, imports/uploads 30 per 10 min | HTTP: "search endpoints are throttled per account" (61st call → 429) |
| P9 | Low | Admin student list | Full CIN displayed on screen (shoulder-surfing in offices) | Masked display (`maskCin`); full value in the edit form | `privacy-units` |
| P10 | Low | `prisma/seed.ts` | Printed the head-of-department and demo passwords to the console (real values if set in `.env`) | Prints the variable name instead | Code review |
| P11 | High (dep) | `sharp` <0.35.5 (librsvg CVE), `source-map-js` 1.2.1 (DoS), transitive via Next.js | New advisories published after the first pass | `npm audit fix` (compatible versions) | `npm audit --omit=dev`: 0 vulnerabilities |

### School / tenant isolation

The data model has **no school or tenant entity** (`prisma/schema.prisma`: User, Class, Student, Session, Attendance, …). One deployment serves one institution, so cross-school leakage cannot happen inside one database.

The isolation that exists is **per teacher**:

- A teacher reaches only the sessions they teach (`canAccessSession`) and the classes where they teach at least one session (`canAccessClass`, `classScope`).
- The school and class context always comes from the server-side session, never from the request.

This was verified by the HTTP IDOR tests. **Serving several schools from one database would need a `schoolId` on every model and in every query, which is a design change, not a fix.** Deploy one instance and database per school.

### REQUIRES PRODUCTION/INFRASTRUCTURE VERIFICATION

- **HTTPS and HSTS in front of the app.** The `Secure` cookie and HSTS header are set in code, but TLS termination is not in the repository.
- **Encryption at rest of the SQLite file, the backups and `uploads/`.** CINs are stored in plaintext in the database. Use disk or volume encryption. Application-level field encryption was not added, because it needs key management outside the repository.
- **File permissions on `prisma/*.db` and `uploads/`.** Only the app user should be able to read them, and neither should sit inside a web-served directory.
- **Reverse proxy overwrites `X-Forwarded-For`.** The per-IP login limit relies on it. With several app instances, rate limits must move to the proxy or a shared store.
- **Server log retention and access** (where `console` output goes, who can read it, how long it is kept).
- **Retention and review of `AuditLog`.** There is no admin screen for it yet; query it in the database.
- **Production database contains no demo accounts or default passwords.** The seed refuses to run in production, but a copied `dev.db` would contain them.
- **Backups:** encrypted, access-controlled, and tested.
- **Legal and regulatory compliance** (for example, Tunisian personal-data law, Loi organique 2004-63). Not assessed; this report makes no compliance claim.

## Security Posture Before Remediation

Authorization was essentially sound. Every API handler called `requireSession` / `requireAdmin` / `requireScheduleManager` server-side, read the role from the database rather than from the token, and checked teacher ownership of sessions and classes. There was no SQL injection surface: Prisma only, with no raw queries. There was no XSS sink: React only, no `dangerouslySetInnerHTML`, and e-mail HTML was escaped.

The weaknesses were around that core:

- One critical Next.js advisory.
- An xlsx parser with known parser vulnerabilities, fed by uploaded files.
- No brute-force protection on login.
- Sessions that survived password resets.
- No HTTP security headers.
- Excessive personal data in teacher-facing APIs.
- CSV formula injection in exports.
- Extension-only upload validation.
- A database file with password hashes committed to Git.

## Vulnerabilities Fixed

| # | Severity | Vulnerability | Location |
|---|---|---|---|
| 1 | Critical | Next.js RCE advisory (next/og `ImageResponse`, >=16.2.0 <16.3.6) | `package.json` (next 16.3.4) |
| 2 | High | SheetJS prototype pollution (<0.19.3) and ReDoS (<0.20.2) on uploaded spreadsheets | `package.json` (xlsx 0.18.5), `src/lib/parse-upload.ts` |
| 3 | High | No rate limiting on login (online password brute force) | `src/app/api/auth/login/route.ts` |
| 4 | High | Development database (test data only, includes password hashes) tracked in Git | `prisma/dev.db`, `.gitignore` |
| 5 | Medium | Sessions not invalidated after password change/reset | `src/lib/auth.ts` |
| 6 | Medium | No security headers (clickjacking, no CSP, no HSTS, no nosniff) | `next.config.ts` |
| 7 | Medium | CSRF protection relied only on SameSite=Lax | `src/middleware.ts` |
| 8 | Medium | Excessive data exposure: CIN, e-mail, phone of students sent to teachers | `src/app/api/sessions/[sessionId]/route.ts`, `src/app/api/classes/[id]/route.ts`, `src/lib/attendance.ts` |
| 9 | Medium | CSV / spreadsheet formula injection in exports | `src/components/reports-view.tsx`, `src/components/admin/users-admin.tsx` |
| 10 | Medium | Upload type checked by extension only (MIME spoofing) | `src/app/api/admin/attendance/justificatif/route.ts` |
| 11 | Low | Middleware skipped the session gate for any path containing "." (API included) | `src/middleware.ts` |
| 12 | Low | Login timing difference reveals whether an e-mail exists | `src/lib/auth.ts`, login route |
| 13 | Low | Auth failures collapsed into 400/500 in 49 catch blocks (hides access-control events) | all `src/app/api/**/route.ts` |
| 14 | Low | Cron secret compared with `!==` (timing); cron endpoint blocked by middleware | `src/app/api/cron/notifications/route.ts`, `src/middleware.ts` |
| 15 | Low | No request body size limit before multipart parsing | `src/middleware.ts` |
| 16 | Low | Unbounded settings input (`absenceLimit`) | `src/app/api/admin/settings/route.ts` |
| 17 | Low | JWT verification without an algorithm allow-list | `src/lib/auth.ts` |
| 18 | Low | Sensitive API responses cacheable; `X-Powered-By` disclosed | `next.config.ts` |
| 19 | Low | Demo seed (well-known default passwords) could run in production | `prisma/seed.ts` |
| 20 | Low | Build-tool dependencies `effect` / `deepmerge-ts` (Prisma CLI) | `package.json` |

### 1. Next.js critical advisory — Critical
- **Attack scenario:** remote code execution through `next/og` `ImageResponse` in affected versions.
- **Root cause:** next 16.3.4 is inside the affected range.
- **Exploitability here:** the code never imports `next/og` (verified by search), so it was not reachable. The dependency was still flagged Critical by `npm audit`.
- **Fix:** next and eslint-config-next upgraded to 16.3.8 (patch release, no API change).
- **Regression risk:** very low.
- **Proof:** `npm audit --omit=dev` reports 0 vulnerabilities, and the build passes.

### 2. SheetJS (xlsx) vulnerabilities — High
- **Attack scenario:** a crafted XLS/XLSX (scolarité file, CIN/e-mail file, teacher list, schedule) given to an administrator. It could pollute `Object.prototype` in the server process or hang it with a ReDoS.
- **Root cause:** xlsx 0.18.5. The npm registry stopped at that version; SheetJS publishes fixes only on its own CDN.
- **Fix:** installed xlsx 0.20.3 from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The lockfile pins its sha512 integrity hash.
- **Regression risk:** low; parser API unchanged.
- **Proof:** `tests/enrollment-import.test.ts` and `tests/import-parsers.test.ts` still pass, and `npm audit` no longer lists xlsx.

### 3. Login brute force — High
- **Attack scenario:** unlimited password guessing against `/api/auth/login` for any teacher or the admin.
- **Root cause:** no throttling.
- **Fix:** new `src/lib/rate-limit.ts`, a fixed-window limiter with a bounded key store.
    - 10 attempts per account and 50 per IP every 15 minutes, then HTTP 429 with `Retry-After`.
    - The account counter resets on successful login.
    - Failed logins are logged with e-mail and IP, never the password.
- **Regression risk:** a user who mistypes 10 times waits up to 15 minutes.
- **Proof:** `security-units` "rate limit" test, and `security-http` "login brute force is rate limited" (the 11th attempt returns 429).

### 4. Development database committed to Git — High (partially fixed, see Remaining)
- **Data in the file:** test/development data only. There are no real student records and no production school data (confirmed by the project owner). **Privacy impact: no known production or student data exposure.**
- **Attack scenario:** anyone with read access to the GitHub repository downloads `prisma/dev.db`. They can attempt to crack the bcrypt password hashes offline. This matters if any of those passwords is reused on a real account or in production.
- **Root cause:** `*.db` was not ignored.
- **Fix:** `git rm --cached prisma/dev.db` (the file stays on disk; no data deleted), and `*.db` / `*.db-journal` added to `.gitignore` so a database file cannot be committed again by accident.
- **Still to do manually:** purge the file from history (Remaining #1).

### 5. Sessions survive password reset — Medium
- **Attack scenario:** a stolen or shared session cookie keeps working for up to 7 days even after an administrator resets that user's password.
- **Root cause:** the JWT carried only the user id. Nothing tied it to the current credentials.
- **Fix:** the token now carries `pv`, an HMAC-SHA256 (keyed with `AUTH_SECRET`) of the user's current password hash. `getSession` recomputes it and compares in constant time, so any password change invalidates older sessions. The token no longer carries e-mail/name/role (the role is always re-read from the database). `jwtVerify` is pinned to `HS256`.
- **Regression risk:** every user must log in once after deployment, because old tokens have no `pv`.
- **Proof:** `security-units` "a password change invalidates the session fingerprint", and `security-http` "forged or unsigned tokens are refused" (`alg: none` → 401).

### 6. Missing HTTP security headers — Medium
- **Attack scenario:** the app framed by another site (clickjacking on attendance buttons); no CSP as a second line against XSS; no HSTS.
- **Fix (`next.config.ts`):**
    - CSP: `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
    - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
    - HSTS (2 years, production only).
    - `Cache-Control: no-store` on `/api/*`.
    - `poweredByHeader: false`.
- **Regression risk:** low. The app loads no third-party resources, and fonts are self-hosted by `next/font`.
- **Proof:** `security-http` "security headers are sent", plus manual `curl -I` against `next start`.

### 7. CSRF defence in depth — Medium
- **Attack scenario:** a sibling subdomain, or a browser without SameSite support, submits a form to a state-changing API with the victim's cookie.
- **Fix:** the middleware rejects (403) any non-GET/HEAD/OPTIONS `/api/*` request when `Sec-Fetch-Site` is not `same-origin`/`none`, or when `Origin` differs from the host. Server-to-server callers send no `Origin`, so cron is unaffected.
- **Proof:** `security-units` "cross-site state-changing requests are refused", and `security-http` "cross-site writes are refused even with a valid session".

### 8. Excessive data exposure to teachers — Medium
- **Attack scenario:** any teacher could read CIN, e-mail and phone of every student in their classes through `/api/sessions/:id`, `/api/classes/:id`, `/api/reports` and `/api/elimines`. No teacher screen uses these fields.
- **Fix:** Prisma `select` restricted to `id, matricule, firstName, lastName` (plus class/level where needed). Attendance rows exposed to teachers are reduced to `studentId, present`. Admin endpoints are unchanged.
- **Proof:** `security-http` "teacher responses do not expose CIN, e-mail or phone".

### 9. CSV formula injection — Medium
- **Attack scenario:** a student or teacher name imported from a spreadsheet starting with `=`, `+`, `-` or `@` runs as a formula when an administrator opens the exported CSV. A name containing `;` also broke columns.
- **Fix:** new `src/lib/csv.ts`. Every cell is quoted, and leading formula characters are prefixed with `'`. Used by the reports export and the teacher-credentials export.
- **Proof:** `security-units` "formula injection is neutralised".

### 10. Upload MIME spoofing — Medium
- **Attack scenario:** an HTML or SVG file renamed `.pdf` / `.png` uploaded as a justificatif.
- **Fix:** new `src/lib/upload-signature.ts` checks the file's magic bytes (PDF, PNG, JPEG, WEBP) against its extension. Stored names are now fully random UUIDs. Files are served with a type from the allow-list, `nosniff`, `Cache-Control: private, no-store`, and an RFC 5987-encoded filename. Admin-only on read and write. Storage stays outside `public/`, and paths go through `path.basename`.
- **Proof:** `security-units` "a renamed file is rejected by its content signature", and `security-http` "spoofed justificatif files are rejected" (HTML-as-PDF, EXE and SVG → 400).

### 11–19. Low-severity fixes
- **#11 Middleware dot bypass:** only non-API public files can skip the gate now. Handlers already authenticated, so this was defence in depth. *Test:* `/api/admin/users.json` → 401.
- **#12 Login timing:** unknown e-mails are compared against a dummy bcrypt hash, so response time no longer reveals whether an account exists.
- **#13 `authFailure()` helper:** applied to 49 catch blocks, so a teacher calling an admin write endpoint now gets 403 (previously 400 "e-mail already used"). *Test:* "a teacher cannot call admin endpoints" covers 10 endpoints.
- **#14 Cron:** constant-time comparison of SHA-256 digests, a minimum secret length of 16, and the route allowed through the middleware (it was unreachable without a cookie). *Test:* the cron test returns 401 with no or a wrong secret.
- **#15 Body size:** the middleware rejects a `Content-Length` over 12 MB (413) before parsing. *Test:* "oversized bodies are refused".
- **#16 Settings:** validated with zod as an integer from 1 to 100.
- **#17 JWT:** algorithm allow-list (`HS256`).
- **#18 Caching and fingerprinting:** `no-store` on `/api/*`; `X-Powered-By` removed.
- **#19 Demo seed:** refuses to run when `NODE_ENV=production`. Also fixed a pre-existing type error in `prisma/seed.ts` that blocked `tsc`.

### 20. Build-tool dependencies — Low
- **Fix:** prisma and @prisma/client upgraded from 6.19.0 to 6.19.3 (fixes `effect`), and `overrides: { "deepmerge-ts": "^8.0.2" }` added. `prisma validate`, `generate` and `migrate status` were verified after the change.

## Remaining Vulnerabilities

| # | Severity | Location | Why it remains | Blocks external audit | Manual remediation |
|---|---|---|---|---|---|
| 1 | **High** (security hygiene; privacy impact: no known production or student data exposure, test data only) | Git history, commit `1a8b9f8` on `origin/main` (GitHub): `prisma/dev.db` (development database with password hashes) | Removing it needs a history rewrite and a force-push: destructive and outward-facing | **Yes**, until done | See steps below |
| 2 | Medium | `next.config.ts` CSP | `script-src` keeps `'unsafe-inline'`, which Next.js inline bootstrap scripts need. Nonce-based CSP would force every page to render dynamically | No | Move to a nonce-based CSP in the proxy (middleware) if the auditor requires it |
| 3 | ~~Low~~ **Fixed (second pass, P6)** | `src/lib/auth.ts` | — | — | Logout now revokes server-side; sessions last 12 h |
| 4 | Low | `src/lib/rate-limit.ts` | Limits (login, search, imports) are in memory, per process. The per-IP limit trusts `X-Forwarded-For`. The per-account limit lets an attacker lock an account out for 15 minutes | No | Behind several instances, enforce limits at the reverse proxy or in Redis; make the proxy overwrite `X-Forwarded-For` |
| 8 | Low | `Student.cin` column | CINs are stored in plaintext in SQLite (no field-level encryption) | No | Encrypt the disk or volume and the backups (REQUIRES PRODUCTION/INFRASTRUCTURE VERIFICATION). Field-level encryption would need a key manager outside the repository |
| 9 | Low | `AuditLog` | Written but not displayed; no retention policy | No | Add a read-only admin page and a retention period |
| 10 | Info | Logout | Logout revokes **all** of that user's sessions (all devices), because revocation is per account | No | Acceptable trade-off; a per-session table would allow single-device logout |
| 5 | Low (dev only) | `eslint-config-next` → `fast-glob` → `micromatch` → `braces` | No patched `braces` release exists. Runs only during lint, on developer-controlled globs | No | Update when upstream ships a fix |
| 6 | Info | `src/middleware.ts` | Next 16 deprecates the `middleware` file name in favour of `proxy` (it still works) | No | Rename to `proxy.ts` when convenient |
| 7 | Info | Deployment | The `Secure` cookie flag and HSTS assume HTTPS in production. Over plain HTTP, login will not work in production mode | No | Serve only over HTTPS (TLS at the reverse proxy) |

**Steps for Remaining #1:**

The committed file is a development database with test data only. There is no student-data disclosure to handle, so the remediation is purely technical.

1. **Purge the file from history:** `git filter-repo --path prisma/dev.db --invert-paths` (or BFG), then `git push --force` to `origin`. Ask every collaborator to re-clone.
2. **Prevent recurrence:** already done in the repository. `*.db` and `*.db-journal` are git-ignored and the file is untracked. Optionally, add a pre-commit or CI check that rejects `*.db` files.
3. **Retire the test passwords.** The test accounts' passwords are now effectively public in hashed form. Never reuse them, and never deploy this development database. If the administrator password seeded from `.env` is, or was, also used on any real or production account, change it there.
4. **`AUTH_SECRET` was never committed.** `.env` is ignored and the history scan found no secret values, so no secret rotation is needed for this finding.

## Authentication Security

- Passwords: bcrypt with cost 12; minimum 8 characters on every creation/reset path (users API, teacher import).
- Login: zod-validated input, rate limiting, equal timing for unknown accounts, a generic error message, and failure logging.
- Sessions: HS256 JWT in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), 7-day expiry, bound to the current password hash. The user and `active` flag are re-checked in the database on every request. Deactivation takes effect immediately.
- `AUTH_SECRET`: the app refuses to start in production with a missing, short (<32) or placeholder secret.
- There is no MFA, OAuth or SSO in the application.

## Authorization / RBAC Security

There are three roles: ADMIN, DEPARTMENT_HEAD and PROF. The role always comes from the database, never from the client or the token.

- **ADMIN:** `/api/admin/*` uses `requireAdmin`, and the `/admin` layout redirects non-admins server-side.
- **Schedule management (ADMIN and DEPARTMENT_HEAD):** `requireScheduleManager`.
- **Teachers:**
    - Sessions: `canAccessSession` (professor of the session).
    - Classes: `canAccessClass` (teaches at least one session of the class).
    - Reports and eliminated students: scoped to those classes.
    - Attendance taking: limited to the first 90 minutes of the session, enforced server-side.
- **Design note:** a department head can create or modify any session and assign any teacher. This is intended, and documented here for the auditor.

## IDOR / BOLA Assessment

All id-based routes were traced:

- `/api/sessions/:id` (GET/PUT): professor ownership is checked. On PUT, submitted student ids must all belong to the session's class and be active.
- `/api/classes/:id`, `/api/reports?classId`, `/api/elimines?classId`: class access is checked.
- `/api/admin/classes/:id/students` PATCH/DELETE: the student must belong to the class in the URL. A class change is validated against an existing class.
- Justificatif read/write: admin-only. The file path comes from the database, never from the request.

Tested over HTTP: a teacher gets 403 on another teacher's session (GET and PUT) and on another class's details, reports and eliminated list.

## API Security

- Every handler authenticates server-side. The middleware is a first gate only.
- Unauthenticated access is limited to `/` (login page), `/api/auth/login`, and `/api/cron/notifications` (bearer secret).
- Mass assignment: every write uses an explicit zod schema and explicit Prisma `data` fields. No request body is spread into Prisma.
- Responses are minimized for teacher-facing endpoints (fix #8). Admin listings are capped (`take: 200/500`).
- Limits:
    - 12 MB maximum request size.
    - 5 MB per uploaded file.
    - 5,000 rows per import and 100 sheets per workbook.
    - 500 teachers per import.
    - 500 marks per attendance save.

## Input Validation

zod validates every JSON body: e-mails, lengths, enums, integer ranges, and `HH:MM` / `YYYY-MM-DD` formats. Imported spreadsheets are parsed into fixed fields. E-mails from the CIN file are validated before being written.

There is no SQL/NoSQL/command/template injection surface. There are no `$queryRaw`/`$executeRaw`, `eval`, `new Function`, or `child_process` calls (verified by search).

## XSS / CSRF

- **XSS:** all rendering goes through React escaping. There is no `dangerouslySetInnerHTML` or `innerHTML`. Notification e-mails escape every interpolated value. Uploaded files are never served as HTML (allow-listed types, `nosniff`, signature check). The CSP is a second layer.
- **CSRF:** `SameSite=Lax` cookie plus the Origin / `Sec-Fetch-Site` check on every state-changing API call. There are no state-changing GET handlers (verified).
- **Redirects:** all are to fixed internal paths, so there is no open redirect.

## File Upload Security

| Upload | Who | Controls |
|---|---|---|
| Justificatif (PDF/JPG/PNG/WEBP) | Admin | Extension allow-list, magic-byte check, 5 MB, random UUID name, stored outside `public/` (`uploads/`, or `UPLOAD_DIR`), `basename` on every path, served admin-only with `nosniff` and `no-store` |
| Scolarité / CIN-e-mail / teacher / schedule spreadsheets | Admin, or department head for the schedule | Extension allow-list, 5 MB, row and sheet caps, patched SheetJS 0.20.3, fixed-field parsing (no object spread from file headers) |

## Secrets Assessment

- `.env` and `.env*` are git-ignored and were never committed (history scanned with values redacted).
- `.env.example` holds placeholders only.
- No `NEXT_PUBLIC_*` variables exist, so no server secret reaches the browser bundle.
- No credentials are hardcoded in runtime code.
- `prisma/seed.ts` contains demo-only default passwords for local test accounts (values not reproduced here). These are now blocked in production (fix #19).
- **Exposed:** password hashes of test accounts inside the development database `prisma/dev.db` in Git history (test data only; Remaining #1). Hash values are not reproduced in this report.

## Dependency Security

| Package | Before | After | Reason |
|---|---|---|---|
| next, eslint-config-next | 16.3.4 | 16.3.8 | Critical advisory |
| xlsx | 0.18.5 (npm) | 0.20.3 (SheetJS CDN, integrity-pinned) | Prototype pollution and ReDoS |
| prisma, @prisma/client | 6.19.0 | 6.19.3 | `effect` advisory |
| deepmerge-ts (transitive) | 7.1.5 | 8.0.x (override) | Stack exhaustion advisory |
| brace-expansion (transitive) | vulnerable | patched (`npm audit fix`) | DoS advisory |

## HTTP Security Headers

These were verified on `next start`:

- `Content-Security-Policy` (see fix #6)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cache-Control: no-store` on the API
- No `X-Powered-By`

## CORS

No CORS headers are configured anywhere, so browsers apply the same-origin policy. There is no wildcard and no reflected origin. Nothing to fix.

## Session / Cookie Security

The session cookie is `issatkr_session`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Max-Age` **12 hours**. It holds no personal data: only the user id, the password fingerprint and the session version, and it is signed (HS256).

A token is rejected when any of these applies:

- it has expired;
- the signature or algorithm is wrong;
- the user is inactive;
- the password has changed since login;
- the user has logged out since login (`sessionVersion` bumped).

## Webhook / Integration Security

- **Inbound:** only `/api/cron/notifications`. It uses a bearer secret (minimum 16 characters) compared in constant time, and refuses when `CRON_SECRET` is unset.
- **Outbound:** SMTP through nodemailer. Credentials come from the environment, recipients from the database, and the HTML body is escaped.
- There are no OAuth callbacks or third-party webhooks.

## Docker / Deployment Security

There is no Dockerfile, compose file or platform config in the repository. Recommendations:

- Run `next start` as a non-root user behind a TLS-terminating reverse proxy that overwrites `X-Forwarded-For`.
- Keep `uploads/` and the SQLite file outside the web root, readable only by the app user, and back them up.
- Set `NODE_ENV=production`, a random `AUTH_SECRET` of 32+ characters, and `CRON_SECRET`.
- Never run `npm run db:seed` in production (now enforced).

## Logging / Error Handling

- Clients only receive generic French error messages. No stack traces, Prisma errors or file paths are returned (all handlers wrap work in try/catch).
- Authorization failures are now reported as 401/403 rather than 400/500 (fix #13).
- Failed logins are logged with the staff e-mail and IP. No passwords, tokens or secrets are logged (verified by search).
- **All server error logging goes through `logServerError()`.** Prisma error messages are never logged; only the error code and field names are. Other messages have e-mails and digit runs (CIN, phone) redacted. No raw `console.error` remains in `src/`.
- SMTP error messages are stored, truncated, in `NotificationLog` and are visible to admins only.
- **Audit trail:** `AuditLog` records actor, role, action, target, IP and time for 24 sensitive actions, never the values (see P5).

## Tests Executed

| Suite | Result |
|---|---|
| `npm test` (`tsx --test tests/**/*.test.ts`): 28 tests, including `security-units` (7) and `privacy-units` (7) | **27 pass, 0 fail, 1 skipped** (the HTTP suite, which needs `SECURITY_BASE_URL`) |
| `tests/security-http.test.ts` against `next start` (production build), with admin and teacher accounts | **20/20 pass** |
| `tests/attendance-window.test.ts` (90-minute teacher limit) | pass |
| `tsc --noEmit` | pass (0 errors) |
| `eslint .` | pass (0 problems) |

Run the HTTP suite with: `SECURITY_BASE_URL=http://localhost:3000 npx tsx --test tests/security-http.test.ts` (it reads the account credentials from `.env`).

## Build Status

`next build` (Next.js 16.3.8, Turbopack) succeeds. All routes compile. The production server was started and exercised by the HTTP security suite.

## Dependency Scan Results

- `npm audit --omit=dev`: **0 vulnerabilities** (after the second pass fixed `sharp` 0.35.5 and `source-map-js` 1.2.2).
- `npm audit` (including dev): **5 high**, all one dev-only chain: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` (no upstream fix; lint-time only).
- Before remediation: 1 critical and 11 high.

## Final Risk Assessment

**FAIL (blocking) until Remaining #1 is completed manually; PASS WITH WARNINGS afterwards.**

The application code has no known exploitable Critical or High vulnerability:

- Authentication, authorization and IDOR boundaries are enforced server-side and covered by tests.
- Production dependencies are clean.
- Headers, CSRF, upload and data-exposure controls are in place.

The blocking item is outside the code: the development database in the pushed Git history. Purging it from history clears it. It is a security-hygiene issue (it contains password hashes of test accounts). **It contained test/development data only: no known production or student data exposure.**

The remaining warnings are defence-in-depth improvements and are not exploitable on their own:

- CSP `'unsafe-inline'`
- in-memory rate limiting
- CINs in plaintext at rest, without disk encryption confirmed
- the audit log has no viewer
- a dev-only lint dependency

Several controls can only be confirmed on the production infrastructure; they are listed under *REQUIRES PRODUCTION/INFRASTRUCTURE VERIFICATION*.

## Production-Readiness Pass (2026-10-07)

Changes made while preparing the deployment (see `DEPLOYMENT.md`):

| Item | Change | Verification |
|---|---|---|
| Authentication audit I-1 (no self-service password change) | **Fixed.** `POST /api/auth/password` + page **Mon mot de passe**: the current password is required, rate limited (5 per 15 min), other sessions are revoked, this device stays signed in, and the change is audited | Production-build e2e: wrong current password → 400; other device → 401; old password → 401; new password → 200 |
| I-2 (department head self-assignment) | **Not a vulnerability: intended business functionality.** All 8 conditions now hold: I-2a is fixed, so schedule create/update/delete/import are audited with the logged-in user as actor (`selfAssigned` flag) | e2e: `schedule.create` audit entry names the department head, `selfAssigned: true` |
| I-6 (bcrypt 72-byte truncation) | **Fixed for every new password**: maximum 72 bytes (`src/lib/password-policy.ts`) on account creation and edit, teacher import, self-service change and the first-admin script. Login still accepts existing passwords | e2e: 40× "é" (80 bytes) → 400; `create-admin` refuses 74 bytes |
| I-7 (last administrator) | **Fixed.** The last active admin cannot demote themselves | e2e: 400 |
| I-3 (moving an already-recorded session) | **Open: NEEDS HUMAN DECISION** (business rule) | — |
| I-4 (no MFA for admins) | **Open: NEEDS HUMAN DECISION** | — |
| I-5 (teacher import can create ADMIN accounts) | **Open: NEEDS HUMAN DECISION** | — |
| Production configuration | The server **refuses to start** (exit code 1) with a weak or placeholder `AUTH_SECRET`, a missing `DATABASE_URL` or `UPLOAD_DIR`, or a development/test database path | Tested: 3 bad configurations → exit 1, `[config] error` names the variable only |
| Build no longer migrates | `npm run build` = `prisma generate && next build`. Migration is an explicit `prisma migrate deploy` step | Build without any `.env` succeeds; migrations reproduce `schema.prisma` exactly (`prisma migrate diff`: no difference) |
| Health endpoint | `GET /health` → `{"status":"ok"}` / 503; no data, version or configuration | Tested |
| Logs and bundles | No secret, password, CIN or student name in server logs, the client bundle or the standalone server bundle; no env var names or API hosts in client code | Automated value scan (values not printed) |
