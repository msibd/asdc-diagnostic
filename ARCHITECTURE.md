# Architecture

## Overview

A single-center diagnostic laboratory system. One Next.js application serves the public website, the staff dashboard and a JSON API. All state lives in PostgreSQL, accessed through Prisma with the `pg` driver adapter. Authentication uses Better Auth with e-mail and password.

```text
Browser ──► Next.js App Router
             ├─ (public) / and public_website/   public site, booking and review forms
             ├─ (auth)/login                     staff sign-in (password or QR approval)
             ├─ (dashboard)/…                    staff pages (server-guarded per role)
             └─ api/…                            JSON API, one route file per resource
                    │
                    ▼
        authorize(permission) ─► route handler ─► module service ─► Prisma ─► PostgreSQL
                                        │
                                        └─► writeAuditEvent (same transaction as the change)
```

## Folder layout

```text
src/
├── app/
│   ├── (public)/ (auth)/ (dashboard)/   pages; dashboard pages call requireSection()
│   ├── api/                              API routes (see API_DOCUMENTATION.md)
│   └── public_website/                   public site: components, queries, public API routes
├── modules/                              feature code; each folder holds what it needs
│   ├── appointments/  patients/  orders/  expenses/  billing/
│   ├── dashboard/  clinic/  auth/
│   └── …/{schemas,services,queries,components}
├── lib/                                  cross-cutting code
│   ├── permissions.ts      roles, permissions, page-to-permission map
│   ├── admin-session.ts    getStaffSession() and authorize()
│   ├── section-access.ts   requireSection() page guard
│   ├── api.ts              apiError, parseBody, parseQuery, isPrismaError
│   ├── audit.ts            writeAuditEvent (optionally inside a transaction)
│   ├── rate-limit.ts       fixed-window limiter for public endpoints
│   └── clinic-date.ts      Asia/Dhaka date helpers
├── components/shared/      Modal, PatientSelect, session provider …
└── generated/prisma/       Prisma client (generated; not committed)
prisma/                     schema, migrations, seed scripts
tests/                      Vitest suites (real handlers, real sessions, test database)
scripts/                    operational scripts
```

## Request flow and layering

1. **Authorization first.** Every protected route starts with `authorize(request.headers, "<permission>")`. It checks the Better Auth session, that the account has a staff role, and that the role holds the permission. Failures are `401` (no session) or `403` (no permission).
2. **Validation.** Input is parsed with zod (or the existing hand-written appointment parser). New routes use `parseBody` / `parseQuery` from `src/lib/api.ts`, which give one consistent `{ error }` response with status `400`.
3. **Service layer.** Business rules that more than one route needs, or that need a transaction, live in `modules/*/services` (appointment scheduling, patient creation, lab orders, results and reports). Small single-purpose routes keep their query inline rather than add a pass-through layer.
4. **Audit.** State changes write an `AuditEvent`. For money and laboratory records the audit row is written inside the same database transaction, so a change can never be committed without its audit entry.

## Roles and permissions

`src/lib/permissions.ts` is the single source of truth. Built-in roles are `admin`, `receptionist`, `lab_staff`, `pathologist`, `doctor`, `accountant` and the default `user` (no access); an administrator can edit them and add others. Each API route and dashboard page names one permission; the sidebar shows only pages the role may open. See the table in [README.md](README.md#roles).

Decisions:

- **Role as a string on the Better Auth user**, pointing at a row of the `Role` table that holds its permission list. Permissions, not role names, are what every route checks, so a custom role works everywhere without code changes.
- **Separation of lab duties.** Entering results (`results:enter`), approving them (`results:verify`) and releasing the report (`results:release`) are three separate permissions. Reception can place orders and take payment but can never enter or approve a result. One person may hold several permissions (a one-person lab uses the administrator), and both the person who entered and the person who approved a result are recorded.
- **Page guards plus API guards.** `requireSection()` redirects a role away from a page it may not open; the API still rejects the same role if it calls the endpoint directly.

## Concurrency and money

- Appointment, payment, void and refund operations take the same PostgreSQL advisory lock (`pg_advisory_xact_lock`), so two simultaneous requests cannot both claim a slot or overpay an invoice.
- All money arithmetic is in integer cents (`src/modules/billing/services/invoice-math.ts`); amounts are stored as `DECIMAL(12,2)`. Invoice totals are not stored: they are always derived from subtotal, discount and tax, so they cannot disagree with the line items.
- Patient codes (`PID-00001`) and invoice numbers (`INV-000001`) come from PostgreSQL sequences, so they are unique and never reused.

## Caching

The public website and its read-only endpoints are cached (`cacheComponents`, tagged invalidation in `src/lib/public-cache.ts`). Everything in the staff dashboard is dynamic: laboratory and financial data is never cached. Staff screens refresh through a Server-Sent Events stream (`/api/realtime`) fed by PostgreSQL `LISTEN`/`NOTIFY`; database triggers publish table and operation names only, never record contents. There is no Redis; the load of a single clinic does not justify it.

## Public website

The public site (`/`, `src/app/public_website`) shows clinic information, services, a gallery of image URLs and moderated reviews, and accepts appointment requests. Requests are saved as `PENDING` with their booking channel (website or WhatsApp; WhatsApp requests are saved before the prefilled message opens). Public POST endpoints are rate limited per client IP in the shared `rateLimit` table, which requires the reverse proxy to overwrite `x-forwarded-for`.

## Laboratory workflow

An order moves through fixed statuses: `ORDERED` → `SAMPLE_COLLECTED` → `RECEIVED` → `IN_PROCESS` → `RESULT_ENTERED` → `VERIFIED` → `DELIVERED` (report released), or `CANCELLED`. The status is never set by hand: it is derived from the samples and from each test's result status (`src/modules/orders/services/order-rules.ts`), so it cannot disagree with them.

- **Placing an order** creates the invoice, the order, one sample per sample type and the tests to perform in one transaction. A panel is billed once and expanded into its tests; selecting the same test twice (alone and in a panel) is refused.
- **Samples** are collected, received (by barcode scan) or rejected. A rejected sample is replaced by a new pending one, so the order asks for a recollection. Once any result exists the samples are locked.
- **Reference ranges** (`result-rules.ts`) are chosen per patient by sex and age at the time of the order; the most specific range wins, and no range is ever guessed (a patient whose sex is not recorded gets no sex-specific range, and the screen says why). Limits are inclusive; a value on a critical limit is critical. The same pure functions run in the browser (preview while typing) and on the server (what is saved), so the two cannot differ.
- **Results are snapshots.** Name, unit and reference text are copied into each `TestResult`; a later catalog edit never changes a saved result.
- **Approval** is per test: the pathologist approves, or sends a test back with a reason (the values are kept for correction). Approved results are locked.
- **Release** freezes the whole report into a JSON snapshot (`LabReport`) with a code and a verification code, and sets the order to `DELIVERED`. Results are locked while a report is out. To correct a mistake the report is **withdrawn** (with a reason), the test is reopened, approved again and a new version is released; the old link then shows only that the report was withdrawn.

### Reports on the public site

- **PDF.** Reports are A4 print pages (Print / Save as PDF in the browser), because server-side PDF libraries do not render Bangla names reliably.
- **Patient link** `/r/<token>`: 144 random bits in the address plus a PIN (the last 4 digits of the phone number on file). Each attempt is counted before the PIN is checked and a correct PIN gives its attempt back, so only wrong guesses use up the allowance (5 per link and 20 per address per 15 minutes) and parallel guessing cannot slip past the limit. If the counter cannot be reached the page refuses rather than allowing unlimited guessing. A wrong link and a wrong PIN give the same answer. The page is never indexed or cached.
- **Verification** `/verify/<code>` (the QR code): a 12-character code without look-alike letters. It confirms the report is genuine or withdrawn and shows only a masked name and the report code, never results.
- **Messages** carry only a link: the SMS and e-mail never include a result, and the link is never written to the SMS or e-mail history.

## Security notes

- Public sign-up is disabled; accounts are created by an administrator.
- Sessions use Better Auth cookies; sign-in is rate limited by Better Auth (database storage).
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`. A Content-Security-Policy is not set: Next.js inline scripts need a nonce-based policy, which is a separate piece of work.
- IDOR: the system is single-tenant, so object ownership is not a boundary; the boundary is the role. Every object route re-checks the role, and tests assert both the allowed and the refused cases.
- Patient privacy: receptionists can read the patient profile (including medical history and allergies, which front-desk staff need for safety alerts) but laboratory results only with `orders:read`, and never the dental or clinical notes that no longer exist in this system.

## Backup and recovery

See [README.md](README.md#backup-and-recovery). Because financial history must stay reconstructable, invoices are voided and expenses are voided (with a reason) instead of deleted, and patients with any history can only be disabled.

## Breaking changes in this version

- Non-admin staff can now sign in; the login screen and dashboard accept `receptionist` as well as `admin`.
- New invoices are numbered `INV-000123` from a sequence (older `INV-XXXXXXXX` codes are unchanged).
- Completed and cancelled appointments can no longer be edited (create a new appointment instead).
- Forbidden API calls now return `403` with "You do not have permission to perform this action." (previously a bare "Unauthorized" for non-admins).
- New tables and constraints: see [DATABASE.md](DATABASE.md). Apply with `pnpm exec prisma migrate deploy`.
