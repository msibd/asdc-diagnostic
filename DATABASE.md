# Database

PostgreSQL, managed with Prisma (`prisma/schema.prisma`, SQL migrations in `prisma/migrations/`). Money is `DECIMAL(12,2)`; calendar-only values (date of birth, follow-up date, expense date) are `DATE`; everything else that is a moment in time is `TIMESTAMP(3)` stored as UTC. The clinic's time zone, Asia/Dhaka (UTC+6), is applied in application code (`src/lib/clinic-date.ts`).

## Tables

| Area | Table | Purpose |
| --- | --- | --- |
| Auth | `user`, `account`, `session`, `verification`, `rateLimit`, `QrLoginSession` | Better Auth tables, plus rate-limit counters and QR sign-in approvals. `user.role` is the key of a `Role` (for example `admin`, `receptionist`, `lab_staff`, `pathologist`) or `user` for no access. |
| People | `Patient` | Registration, contact details, sex (needed to choose the right normal range), medical history, allergies. `patientCode` is `PID-nnnnn` from a sequence. `isActive` disables a patient without deleting history. |
| | `DoctorProfile`, `DoctorSchedule` | The center's contact profile (`id = 'primary'`: name, phone, address, e-mail; it supplies the report letterhead) and the weekly working hours (one row per weekday). |
| Scheduling | `Appointment` | A booking. May be unlinked from a patient (website visitor) and carries its own name/phone for that case. Status: `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. Source: `DIRECT`, `WHATSAPP`, `ADMIN`. |
| Catalog | `ClinicService` | The test catalog and price list: code, name, category, price, and (by `kind`) a lab `TEST` with sample type, report time and fasting rule, a `PANEL`, or a plain `SERVICE` such as home collection. Public-website fields (Bangla text, icon, steps) live here too. |
| | `TestParameter`, `TestReferenceRange` | What a test reports (name, unit, display order) and its normal ranges, optionally per sex and age band, with critical limits. |
| | `TestPanelItem` | Which tests a panel contains. |
| Laboratory | `TestOrder` | A lab order (`ORD-nnnnnn` from a sequence): patient, priority, referred-by text, linked invoice and the order's status from `ORDERED` through `VERIFIED` and `DELIVERED` (report released) or `CANCELLED`. |
| | `TestOrderItem` | One test to perform. A panel is expanded into its tests. Holds the result status (`PENDING`, `ENTERED`, `VERIFIED`) and who entered or approved it; name, code and sample type are copied so later catalog edits never rewrite an old order. |
| | `Sample` | One specimen with a barcode (`SMP-nnnnnn` from a sequence): `PENDING`, `COLLECTED`, `RECEIVED` or `REJECTED`, who handled it and when. A rejected sample is replaced by a new one (`replacesId`). |
| | `TestResult` | One measured value. The typed text, the number it was read as, the flag (`NORMAL`, `LOW`, `HIGH`, `CRITICAL_LOW`, `CRITICAL_HIGH`, `ABNORMAL`), and a copy of the parameter name, unit and reference-range text as they were when saved. |
| | `LabReport` | A report released to the patient (`RPT-nnnnnn`): its content frozen as a JSON `snapshot`, a version number, a secret link token, a verification code, status `ISSUED` or `WITHDRAWN`, and delivery and viewing counters. |
| Billing | `ClinicService` | (See Catalog above.) |
| | `Invoice`, `InvoiceItem` | An invoice (`INV-nnnnnn` from a sequence) and its lines. Totals are derived, never stored. |
| | `Payment` | A payment against an invoice: method, amount, `POSTED` or `REFUNDED`. |
| | `Expense` | An expense by category; voided, never deleted. |
| | `CashClosing` | The end-of-day cash count, one per day, with the expected cash snapshot. |
| Inventory | `InventoryItem`, `StockBatch` | A reagent or consumable and its received lots (expiry per lot); `quantity` equals the sum of its lots. |
| | `StockMovement`, `StockPurchase`, `Supplier` | Signed stock changes (never edited), purchases (`PUR-nnnnn`) and suppliers. |
| Website | `ClinicReview`, `ClinicGalleryImage` | Moderated reviews and gallery image URLs for the public site. |
| Access | `Role` | A named set of permissions; `user.role` stores its key. `user.isActive` deactivates an account without deleting it. |
| Email, SMS | `EmailConfiguration`, `EmailAuditLog` | SMTP settings (password encrypted, key in the environment) and the e-mail history. |
| | `SmsConfiguration`, `SmsLog` | SMS provider settings (API key encrypted) and the SMS history (masked numbers only, never message text or links). |
| | `PasswordResetOtp`, `PasswordResetAuthorization` | Hashed one-time codes and single-use reset tokens. |
| Audit | `AuditEvent` | Who did what to which record, and when. |

## Relationships and deletion rules

- Everything laboratory or financial that points at a `Patient` (orders, invoices) uses `ON DELETE RESTRICT`: a patient with any history cannot be deleted (the API also checks, and offers disabling instead).
- `Invoice → InvoiceItem` and `Invoice → Payment` are `RESTRICT`; invoices are voided, not deleted.
- Lab records are never deleted: `TestOrder`, `TestOrderItem`, `Sample`, `TestResult` and `LabReport` all use `RESTRICT`. A mistaken order is cancelled with a reason; a mistaken report is withdrawn and corrected.
- `TestParameter` and `TestReferenceRange` belong to their test and are removed with it (`CASCADE`); `TestPanelItem` removes with its panel, but a test that is inside a panel cannot be deleted (`RESTRICT`).
- A released report's `snapshot` is a copy: editing the patient, the catalog or the center's letterhead afterwards never changes it.
- Links to a `user` (examiner, creator, actor) and to an `Appointment` or `ClinicService` use `SET NULL`, so removing a user or service never destroys the record that referenced it.
- `Appointment.patientId` is `SET NULL` because an appointment can exist without a registered patient.

## Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`

These repeat rules the API already enforces, so that a bug or a manual SQL change cannot store impossible data.

| Table | Rule |
| --- | --- |
| `Invoice` | `subtotal`, `discount`, `tax` ≥ 0; `discount` ≤ `subtotal` + `tax` |
| `InvoiceItem` | `quantity` > 0; `unitPrice`, `amount` ≥ 0 |
| `Payment`, `Expense` | `amount` > 0 |
| `ClinicService` | `standardPrice` ≥ 0; `durationMinutes` > 0 |
| `DoctorProfile` | `consultationFee` ≥ 0 |
| `Appointment` | `durationMinutes` > 0 |
| `DoctorSchedule` | `dayOfWeek` between 0 and 6 |
| `ClinicReview` | `rating` between 1 and 5 |

They are created `NOT VALID`: PostgreSQL enforces them for every new or changed row immediately but does not scan existing rows, so the migration cannot fail on old data. To check old rows as well, run for each constraint (it errors and names the problem if a row violates it):

```sql
ALTER TABLE "Invoice" VALIDATE CONSTRAINT "Invoice_amounts_nonnegative_chk";
```

The same migration creates `invoice_code_seq`, used for new invoice numbers. Later migrations add `test_order_code_seq`, `sample_code_seq` and `report_code_seq` for order, sample-barcode and report codes.

## Indexes

Beyond primary and unique keys, indexes exist for the screens that use them: patient list ordering and search (trigram GIN indexes on name, phone, code and e-mail), appointment lists by date, status, patient, service and source, invoice lists by patient, status and date, payment lookups by invoice and by status and date, examination history by patient and date, follow-up dates, expenses by date and category, and audit lookups by record and by actor. Each is justified by a query in the application; indexes with no query behind them are not added. Trigram indexes on `Appointment` and `Patient` text columns increase write cost slightly and are the price of fast partial-match search.

## Migrations

```bash
pnpm exec prisma migrate deploy      # production and CI: apply pending migrations
pnpm db:migrate                      # development: create and apply a migration
pnpm exec prisma migrate status      # what is applied
pnpm exec prisma validate            # check the schema file
```

A fresh database can be built from scratch by `migrate deploy`; the test database setup does exactly that. The latest migrations are:

1. `20261106042841_clinical_records_and_expenses`: `Expense` and enum `ExpenseCategory` (it also created the dental tables, removed again below).
2. `20261106043000_integrity_constraints_and_invoice_sequence`: constraints above and `invoice_code_seq`.
3. `20261107000000_inventory_cash_closing_no_show`: inventory tables, `CashClosing`, appointment status `NO_SHOW` and source `WALK_IN`.
4. `20261107010000_inventory_finance_realtime`: live-update triggers for the new tables.
5. `20261107020000_roles_and_user_status`: the `Role` table, `user.isActive`, and the fixed role list constraint removed.
6. `20261107030000_user_phone`: `user.phone`.
7. `20261107040000_email_settings_and_password_recovery`: e-mail settings, e-mail audit log, OTP and reset-authorization tables.
8. `20261107050000_sms_settings`: SMS settings and SMS log.
9. `20261108000000_lab_test_catalog`: catalog kinds, sample type, report time, fasting, `TestParameter`, `TestReferenceRange`, `TestPanelItem`.
10. `20261109000000_test_orders_and_samples`: `TestOrder`, `TestOrderItem`, `Sample`, `Patient.sex`, order and sample code sequences, live-update triggers, lab permissions on the built-in roles.
11. `20261110000000_lab_results`: result status on each ordered test, `TestResult`, flags.
12. `20261111000000_lab_reports`: `LabReport` (frozen reports, link token, verification code), report code sequence.
13. `20261112000000_remove_dental`: **drops** the dental tables (`DentalChartEntry`, `ExaminationRecord`, `TreatmentPlan`, `TreatmentSession`, `Prescription`, `PrescriptionMedication`), the enums `ToothCondition` and `TreatmentPlanStatus` and `Patient.dentalHistory`; changes a few defaults to diagnostic ones; removes the dental permissions from saved roles and replaces the "Dental assistant" role with "Laboratory staff". This cannot be undone: export anything you still need first.

## Deliberately not modelled

- **Inventory valuation beyond the basics.** Stock is tracked per lot with last-purchase cost; there are no purchase returns or transfers, and no link between a test and the reagent it uses.
- **A `Center` or settings table.** There is one center; its name and contact details are configuration of the public site and the contact profile, not data with its own lifecycle.
- **Referring doctors as records.** "Referred by" is free text on the order. A referrer table (for commission reports) can be added later.
- **Age bands for children in the starter ranges.** The range model supports them; the starter catalog defines adult ranges only.
- **Multiple branches.** `DoctorProfile` (the center's contact profile) is a single row with a fixed id by design.
- **Soft delete on patients and appointments.** Patients are disabled (`isActive`), appointments are cancelled, invoices and expenses are voided. A generic `deletedAt` column on every table would add filtering everywhere for no extra protection.
