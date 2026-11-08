# Seed data

There are four seed commands. Only the first one is needed for a real installation.

| Command | What it does | Safe on a real database? |
| --- | --- | --- |
| `pnpm db:seed` | Creates the first administrator (it asks for the password in the terminal). | Yes |
| `pnpm db:seed:lab` | Adds the starter test catalog: common tests, their result parameters and normal ranges, and two panels. A code that already exists is never touched. | Yes, but read the warning below |
| `pnpm db:seed:website` | Adds starter wording for the public website (English and Bangla) and Bangla names and short descriptions for the starter tests. Fills only empty fields; `--force` overwrites. | Yes |
| `pnpm db:seed:demo` | Loads a fictional center with orders in every stage. | **No: development databases only** |

## Starter test catalog (`pnpm db:seed:lab`)

Adds 15 items: CBC, ESR, fasting and random blood sugar, HbA1c, lipid profile, liver function, creatinine, uric acid, TSH, urine routine, dengue NS1, HBsAg, and two sample panels (Diabetes Check Package, Basic Health Check-up). It can be run any number of times.

> **Review before real use.** The normal ranges are common adult textbook values to get started. They depend on the analyser, reagent kit and local population, so the laboratory's pathologist must review (and where needed correct) them in **Tests & services** before real patients are reported against them. **Every price is 0** on purpose; set the real prices there too. There are no age bands for children in the starter ranges.

## Public website wording (`pnpm db:seed:website`)

Loads a headline, introduction, booking note, closing message and doctor highlights in English and Bangla, and gives the starter tests and the home-collection service a Bangla name, a short general description and three "how it works" steps. It first makes sure the starter catalog exists, so one command is enough on a fresh database. All wording is general text written for review: edit it under **Website content** and **Tests & services > Public website details**. No prices, report times or claims about your center are invented.

## Demo data (`pnpm db:seed:demo`)

`prisma/seed-demo.ts` loads a fictional center so the dashboard, reports and every module have realistic content. All names, phone numbers, e-mail addresses and amounts are invented. It never reads or copies real data.

The lab orders are **not inserted row by row**: the script drives them through the same functions the application uses (place the order, collect and receive samples, enter results, approve, release the report), so every flag, status, invoice and report in the demo is exactly what the real screens produce.

```bash
pnpm db:seed:demo
```

Use it on an empty development database. For example:

```bash
# create a database and apply the schema, then seed it
createdb asdc_demo
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/asdc_demo" pnpm exec prisma migrate deploy
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/asdc_demo" pnpm db:seed:demo
```

### Demo logins (development only)

| Role | E-mail | Password |
| --- | --- | --- |
| Administrator | `admin@demo.example` | `Demo-Admin#2026` |
| Receptionist | `reception@demo.example` | `Demo-Front#2026` |
| Laboratory staff | `lab@demo.example` | `Demo-Lab#2026` |
| Pathologist | `pathologist@demo.example` | `Demo-Patho#2026` |

These are public, throwaway credentials for a development database. Never create them on a database that real people can reach. Override them with `DEMO_ADMIN_PASSWORD`, `DEMO_RECEPTIONIST_PASSWORD`, `DEMO_LAB_PASSWORD` and `DEMO_PATHOLOGIST_PASSWORD`. A password is only set when an account is first created, so re-running never overwrites one someone changed.

### What is created

| Data | Amount |
| --- | --- |
| Contact profile (`primary`) with the report letterhead and weekly hours (Saturday to Thursday; an existing profile and schedule are left untouched) | 1 |
| Staff accounts (admin, reception, lab, pathologist) | 4 |
| Starter catalog tests priced for the demo (only where the price is still 0) and a home-collection service | 15 tests, 1 service |
| Patients (patient IDs `PID-10001`…`PID-10030`), with medical histories and allergies; one child, one patient whose sex is not recorded | 30 |
| Test orders: 10 released, 2 approved, 3 results entered, 2 part-entered, 3 in the lab, 2 collected, 3 waiting for collection, 1 cancelled | 25 |
| Special cases: a rejected and recollected sample, a critical result, a report withdrawn and re-released as version 2, a released report that is still unpaid, reports with SMS sent and opened online | included above |
| Bookings (completed, no-show, cancelled, confirmed, pending website requests) | 11 |
| Invoices (one per order; paid in full, in two payments, partly, or not at all; one void), with cash, card, mobile banking and bank transfer payments | 26 |
| Expenses over about 90 days (rent, salaries, utilities, reagents and supplies, referral-lab fees, equipment, maintenance, marketing, one voided) | 20 |

Dates are relative to the day you run the script, so the dashboard always has "today", "this week" and "this month" figures.

### Repeatable and safe

- **Idempotent.** Everything the script owns belongs to a `demo-` patient, user, service or booking. A re-run deletes exactly those rows and recreates them, so there are never duplicates and the dates move to today.
- **Refuses real data.** If the database already holds patients, orders or invoices that are not demo rows, the script stops with a message. Pass `--allow-existing-data` only if you really want to add the demo rows next to existing ones.
- **Refuses production.** It exits when `NODE_ENV=production`.
- **Self-checking.** After seeding it re-reads everything and verifies that invoice lines add up to the subtotal, payments never exceed the total, each invoice's status matches its payments, each order's status agrees with its samples and results, every released order has exactly one issued report, a cancelled order's invoice is void, and no two confirmed bookings overlap.

### Resetting

To return to a clean state, drop and recreate the demo database, or simply run the script again (it rebuilds its own rows). To remove the demo data from a database without dropping it, delete the rows owned by the `demo-` patients, users and services.
