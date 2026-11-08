# DMS recommendations

Based on [DMS-FEATURE-AUDIT.md](DMS-FEATURE-AUDIT.md). Nothing here is critical to data integrity: orders, results, payments and reports are transactional and audited. The P0 items are about running it safely in production.

## P0: needed to run safely

1. **Automated database backup and a tested restore.** There is none in the app. A lost database loses every patient and report. Run `pg_dump` nightly to storage outside the server, keep 14 days, and test a restore once. *Needs hosting decisions; not built in code.*
2. **Keep `dev.log` and `*.log` out of version control.** Logs can hold patient data. One line in `.gitignore`. *Done: `*.log` added to `.gitignore`.*
3. **Payment double-submit.** *Done.* A double-click on Save payment recorded the amount twice.

## P1: needed for efficient daily operation

| # | Item | Why | What it needs |
| --- | --- | --- | --- |
| 4 | Critical result acknowledgement | Labs must prove a critical value was reported | *Done.* Optional later: SMS to the referring doctor |
| 5 | Patient visit history screen | Reception cannot see a patient's orders, invoices and bookings in one place | A read-only endpoint and tab; no migration |
| 6 | Order-confirmation and report-ready SMS | Patients ask "is it ready?" by phone | Two SMS purposes and templates (small migration on `SmsConfiguration`); report-ready on release |
| 7 | Referring-doctor list | `referredBy` is free text, so spelling differences split the same doctor into many | New `Referrer` table, a select on the order form, free-text kept for old orders |
| 8 | Commission tracking | Only if the centre pays referrers | Depends on item 7 and a business rule from the owner (percent or flat, per test or per order) |
| 9 | Lab departments | Department statistics and routing | `department` on tests; the existing `category` can be migrated into it |
| 10 | Stronger duplicate check | Same phone and similar name, or same name and date of birth, slips through | Warn, do not block, then let staff continue |
| 11 | Discount control | A flat discount with no reason or limit is an easy leak | Reason field and a maximum percent unless `billing:void`-level permission |
| 12 | Signature block on the report | Reports usually show the pathologist's degree, registration number and signature | Fields on the user or a settings row, plus an image upload |

## P2: later

- Reagent consumption per test (deduct stock when a test is received).
- Per-department report templates.
- Per-patient contact history view (SMS and e-mail).
- Branch support, only if a second location opens.
- Analyser integration (needs the analyser's protocol and hardware).
- Server-generated PDF for attaching to messages, only if a printed page is no longer enough.

## Technical clean-ups

- Replace the pasted lock number `41680271` with one named constant. A typo today would silently remove a race protection.
- Move the development LAN address in `src/lib/auth.ts` to an environment variable.
- `finance.test.ts` "works out expected cash" fails in the full parallel run but passes alone; make it independent of other tests' dates.
