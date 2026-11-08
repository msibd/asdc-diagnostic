# ASDC Diagnostic: Diagnostic Center Management System

A management system for a pathology and diagnostic center, built with Next.js (App Router), React, TypeScript, Better Auth, Prisma and PostgreSQL. Reception books tests and takes payment, the lab collects and tracks samples by barcode, technicians enter results, a pathologist approves them, and the patient receives a verified report by SMS, e-mail or print. It also covers bookings, invoices and payments, expenses and cash closing, reagent inventory, reports, and a bilingual (English and Bangla) public website.

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Folder layout, request flow, roles and permissions, key decisions |
| [DATABASE.md](DATABASE.md) | Tables, relationships, constraints, indexes, migrations |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Every API route, its permission, input and output |
| [SEEDING.md](SEEDING.md) | Starter catalog, demo data, demo logins and how to run the seeds safely |

## From booking to report

1. **Test catalog** (Tests & services). Tests (with sample type, report time, fasting rule, result parameters and normal ranges by sex and age), panels (packages of tests) and plain services such as home collection.
2. **Order** (Test orders). Reception picks the patient and the tests; the invoice and one barcoded sample per sample type are created together. A panel is billed once, at its own price, and expands into its tests.
3. **Samples.** Collect, receive (by scanning the barcode) or reject with a reason; a rejected sample is replaced by a new pending one. Labels and a patient slip can be printed.
4. **Results.** Technicians type values; each is compared with the normal range for that patient's sex and age and flagged Low, High, Critical or Abnormal. The same rules run in the browser (preview) and on the server (what is saved).
5. **Approval.** A pathologist approves each test, or sends it back with a reason.
6. **Release.** When every test is approved the report is released: its content is frozen, it gets a code and a QR verification code, and the patient can be sent a private link by SMS or e-mail. A released report can be withdrawn (with a reason), corrected and released again as the next version.

Patients open their report at `/r/<token>` with a PIN (the last 4 digits of the phone number on file). Anyone can check that a printed report is genuine at `/verify` or by scanning its QR code; that page shows no results and only a masked name.

> **Medical responsibility.** The starter normal ranges in `prisma/seed-lab-tests.ts` are common adult textbook values to get started. They depend on the analyser, reagent kit and local population, so the laboratory's pathologist must review them before real patients are reported against them. Starter prices are 0 on purpose.

> **Reports are printed from the browser.** The report is an A4 print page; use **Print / Save as PDF**. This keeps Bangla names correct, which server-side PDF libraries do not render reliably.

## Roles

| Role | Access |
| --- | --- |
| `admin` | Everything, including staff accounts and roles, expenses, reports, the catalog, settings, audit log and security. |
| `receptionist` | Front desk: patients (not delete), bookings (not delete), test orders, collecting samples, invoices and payments (not void or refund), sending report links, and read-only access to the catalog. |
| `lab_staff` ("Laboratory staff") | Collects, receives and rejects samples, enters results, sends report links, records reagent stock use. |
| `pathologist` | Everything lab staff can do, plus approving or returning results and releasing or withdrawing reports. |
| `doctor` | Consulting doctor: sees patients, their test orders and released reports. |
| `accountant` | Money: billing, refunds, expenses, cash closing, inventory purchases and reports; can view test orders. |
| `user` | Can sign in but has no access. |

Permissions are enforced on the server for every page and API route (`src/lib/permissions.ts`); hiding a menu item is only a convenience. An administrator can edit these roles and add others under **Users & roles**.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a PostgreSQL database you control. Set `BETTER_AUTH_URL` to the app's public origin (it is also used to build the report links sent to patients) and replace `BETTER_AUTH_SECRET` with a random secret.
3. Set `ADMIN_NAME` and `ADMIN_EMAIL` in `.env`. The seed command securely prompts for the initial administrator password in the terminal; the password is not saved in an environment file.
4. Generate the Prisma client, create the database tables, and seed the administrator:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

5. Optionally add the starter test catalog and public-website wording (see [SEEDING.md](SEEDING.md)):

   ```bash
   pnpm db:seed:lab
   pnpm db:seed:website
   ```

6. Start the app with `pnpm dev` and sign in at `/login`.

The seed command creates the administrator with Better Auth and assigns the `admin` role. Public email sign-up is disabled in Better Auth. Existing administrators can change their password from **Security**.

**Adding staff.** Staff accounts are created by an administrator under **Users & roles** in the dashboard (no self sign-up). Each account gets a role (see above); a deactivated account can no longer sign in.

**Messages to patients.** SMS (BulkSMSBD) and e-mail (SMTP) are configured under **SMS Settings** and **E-mail & SMTP Settings**. Both stay off until their connection test passes.

## Doctor directory

Doctors are managed under **Doctors** in the dashboard (`/dashboard/doctors`; needs the "edit the doctor profile" permission). Each profile has a photo address, designation, qualifications, specialization, experience, biography, weekly hours and two switches: **Active** and **Published**. The public website lists a doctor, at `/doctors` and `/doctors/<slug>`, only when both are on; phone, e-mail and address are never shown there.

- The profile with id `primary` is the clinic's original single doctor. Its weekly hours decide when patients can book, and its phone and address feed report letterheads, so it can be hidden but not deleted. Other doctors are directory profiles: their hours are shown on their page, but online booking still follows the primary profile (appointments are not assigned to a doctor yet).
- The **Book appointment** buttons go to the existing booking form on the home page.
- Profile photos are public `https://` image addresses, like the rest of the website's images.

## Demo data

For a development database that holds no real records:

```bash
pnpm db:seed:demo
```

This creates a fictional center with 30 patients, 26 test orders in every stage (to collect, in the lab, results entered, approved, released, cancelled), a rejected-and-recollected sample, a critical result, a withdrawn-and-corrected report, bookings, invoices with full, partial and no payment, and expenses. It refuses to run against a database that already holds real patients, orders or invoices, and it is safe to run again. See [SEEDING.md](SEEDING.md).

## Testing

Tests use a dedicated database (by default the `DATABASE_URL` name with `_test` added, for example `asdc_diagnostic_test`) that is emptied before every run; the test runner refuses any database whose name does not end in `_test`. Set `TEST_DATABASE_URL` to choose another.

```bash
pnpm test:db:prepare   # once: creates the test database and applies all migrations
pnpm test              # runs the suite
```

The suite calls the real route handlers with real Better Auth sessions. It covers authentication, role permissions, patients, bookings and conflict prevention, the test catalog, orders and samples, result flagging and reference-range selection, approval, report release, withdrawal and verification, the patient PIN and its rate limit, billing, finance, inventory, SMS and e-mail, password recovery and the public website.

## Scripts

- `pnpm dev`: start the Next.js development server
- `pnpm build`: create a production build (runs `prisma generate` first)
- `pnpm lint`: run ESLint
- `pnpm test` / `pnpm test:watch`: run the automated tests
- `pnpm test:db:prepare`: create and migrate the test database
- `pnpm db:generate`: generate the Prisma client
- `pnpm db:migrate`: apply schema changes during development (`prisma migrate dev`)
- `pnpm exec prisma migrate deploy`: apply pending migrations in production
- `pnpm db:seed`: create the configured administrator
- `pnpm db:seed:lab`: add the starter test catalog (existing codes are never touched)
- `pnpm db:seed:website`: add starter public-website wording and Bangla names for the starter tests
- `pnpm db:seed:demo`: load fictional demo data (development databases only)
- `pnpm admin:reset-password`: reset an administrator's password

## Deploying database changes

New migrations are plain SQL under `prisma/migrations/`. In production run `pnpm exec prisma migrate deploy`. The integrity-constraint migration adds its checks as `NOT VALID`, so it never fails on existing data; see [DATABASE.md](DATABASE.md) to validate old rows afterwards. The `remove_dental` migration permanently drops the old dental tables (dental chart, examination records, treatment plans and sessions, prescriptions): export anything you still need before applying it. Back up the database before applying migrations.

## Backup and recovery

The application stores everything in PostgreSQL, so a backup is a database backup. Use `pg_dump` on a schedule (and before every migration) and keep copies off the server; to recover, restore into an empty database and run `pnpm exec prisma migrate deploy` to confirm the schema is current. Uploaded files are not stored: gallery entries hold public image URLs only. Released reports are stored inside the database (their content is frozen when they are released), so the same backup keeps them.
