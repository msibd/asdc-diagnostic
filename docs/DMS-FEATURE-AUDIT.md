# DMS feature audit

Audited on 2026-11-08 from the code, `prisma/schema.prisma` (996 lines, 36 migrations), 72 API routes, `src/lib/permissions.ts` and 33 test files.
Status means the backend, database, validation, permission check and UI were all found, not just a page.

Status key: **Implemented**, **Partial**, **Missing**, **N/A**.
Test baseline before any change: 570 of 571 passed. The one failure (`finance.test.ts`, cash closing) passes when run alone, so it is flaky under the full parallel run.

## 1. Patient management

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Registration and unique patient ID | Implemented | `PID-00001` from a database sequence inside a transaction: `src/modules/patients/services/patient-service.ts` |
| Profile and medical history | Implemented | `Patient` has sex, date of birth, address, emergency contact, medical history, allergies, notes |
| Search | Implemented | Trigram indexes on name, phone, code, e-mail (`20261106000000_add_trigram_search_indexes`) |
| Duplicate detection | Partial | Blocks only the same name (case-insensitive) and same phone. A misspelt name with the same phone, or the same person on a second phone, is not caught. Date of birth is not used. |
| Visit history | Partial | Bookings, orders and invoices all link to the patient, but there is no per-patient timeline screen. The record can be disabled but not deleted once it has history (correct). |

## 2. Doctor management

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Doctor profiles and specialties | Implemented | `DoctorProfile`, `DoctorSchedule`, `src/modules/doctors/*`. The `primary` profile drives booking hours and the report letterhead and cannot be deleted. |
| Referring doctor | Partial | `TestOrder.referredBy` is free text only. There is no referring-doctor list, so nothing can be reported per referrer. |
| Commission | Missing | Depends on a referring-doctor list and a business rule (percentage, flat, per test). Not built on assumption. |

## 3. Test and service catalog

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Categories and catalog | Implemented | `ClinicService.kind` is TEST, PANEL or SERVICE; `category` is a free-text string |
| Pricing and packages | Implemented | Panels (`TestPanelItem`) are billed once at the panel price and expand into member tests |
| Parameters and reference ranges | Implemented | `TestParameter`, `TestReferenceRange` by sex and age band, with critical limits |
| Departments | Missing | Only the `category` string. No department model, and no routing or statistics by department. |

## 4. Test orders

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Booking, several tests per order | Implemented | `createOrder` creates order, items, samples and invoice together: `src/modules/orders/services/order-service.ts` |
| Sample collection and tracking | Implemented | `Sample` with collected, received and rejected stamps and the person who did each |
| Status management | Implemented | `TestOrderStatus`, kept in step by `syncOrderStatus` |
| Barcode generation and scanning | Implemented | One barcoded sample per sample type; `receiveByCode`. A USB scanner works only as a keyboard into the scan field (hardware dependency). |
| Rejection and recollection | Implemented | A rejected sample is replaced by a new pending one (`replacesId`) |

## 5. Laboratory

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Workflow | Implemented | Collect, receive, enter, approve, release |
| Result entry | Implemented | `result-service.ts`; the same rules run in the browser and on the server |
| Normal and abnormal flags | Implemented | `ResultFlag`: normal, low, high, critical low/high, abnormal |
| Verification and approval | Implemented | `results:verify` (pathologist), with send-back reason |
| Critical result alerts | Partial | Red banner on screen. Until now nothing recorded that anyone was told. **Fixed in this pass: who was told, by whom, and when is now recorded.** Still no automatic call or SMS to the doctor. |

## 6. Reports

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Professional PDF | Partial | A4 print page via the browser's "Save as PDF". Deliberate (Bangla rendering); no server-side PDF file exists to attach to a message. |
| Report templates | Partial | One fixed layout. No per-department or per-test template. |
| Digital signature | Partial | Prints the approving pathologist's name only. No signature image, degree or registration number. |
| Approval and publishing | Implemented | Released only when every test is approved; content frozen into `snapshot` |
| Revision history | Implemented | Withdraw with a reason, correct, release as the next version; all versions kept |
| Patient access | Implemented | Secret link plus PIN, wrong attempts counted in the database, QR check page that shows no results |

## 7. Billing and payments

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Invoices | Implemented | `invoiceCode` sequence; items copy name and price |
| Discounts | Partial | One flat amount per invoice. No reason, no maximum, no role limit. |
| Due, partial and multiple payments | Implemented | Locked transaction; payment cannot exceed the balance. **Fixed in this pass: the Save payment button no longer allows a double submit.** |
| Refunds and history | Implemented | `billing/payments/[id]/refund`, `billing:refund` permission |
| Payment methods | Implemented | Cash, card, mobile banking, bank transfer |
| Daily collection | Implemented | `api/billing/daily-collection`, `api/finance/daily` |

## 8. Inventory

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Items, stock in/out, suppliers, purchases | Implemented | `InventoryItem`, `StockBatch`, `StockMovement` (never edited), `Supplier`, `StockPurchase` |
| Alerts and expiry | Implemented | Low, out, expiring and expired counts; oldest-expiry-first use |
| Reagent use per test | Missing | Stock is reduced by hand. Running a test does not deduct reagents. |

## 9. Accounting and finance

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Income and expenses | Implemented | `Expense` with categories and voiding |
| Daily and monthly reports | Implemented | `api/reports` takes any date range, so a month is a range |
| Cash management | Implemented | `CashClosing`, one row per day |
| Profit and loss | Implemented | Revenue, expenses by category, net: `api/reports/route.ts` |

## 10. Staff and access control

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Staff, roles, permissions | Implemented | 7 default roles, editable, enforced per route with `authorize`; deactivated accounts cannot sign in |
| Activity log | Implemented | `AuditEvent` written inside the same transaction as the change; viewer at `api/security/audit` |

## 11. Dashboard and reports

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Registrations, orders, completed tests, revenue, dues | Implemented | `api/dashboard/summary`, `api/reports` |
| Department-wise statistics | Missing | No department model |
| Doctor-wise statistics | Partial | Appointments only. Orders cannot be grouped by referrer. |

## 12. Communication

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| SMS provider and settings | Implemented | BulkSMSBD, encrypted key, daily per-number and total limits |
| Order confirmation | Missing | SMS purposes are appointment booked, report ready, tests only |
| Report-ready notice | Partial | Staff send the link by hand. Nothing is sent when the report is released. |
| Patient contact history | Partial | `SmsLog` and `EmailAuditLog` exist, but there is no per-patient view. The full number and text are not stored (by design). |

## 13. System settings

| Feature | Status | Evidence and gaps |
| --- | --- | --- |
| Centre information | Implemented | Website content and the primary doctor profile feed the letterhead |
| Branches | N/A | Single centre by design (README) |
| Invoice and report settings | Partial | Letterhead comes from the clinic profile. No screen for invoice prefix, footer text or terms. |
| SMS and e-mail settings | Implemented | `sms:manage`, `email:manage` (admin only) |
| Backup | Missing | No backup or restore in the app. This is an operations job (see recommendations). |

## Cross-cutting findings

- Security: authentication, rate limits and the report PIN flow are careful. The only issues found were the payment double-submit (fixed) and the items below.
- One advisory-lock number `41680271` is pasted in 10 files and serialises payments, orders and bookings. Fine for one centre; see recommendations.
- `dev.log` is not in `.gitignore`. A fixed LAN address is in the development sign-in config (`src/lib/auth.ts:18`).
- Not checked: SMS delivery against the real provider, real barcode scanners, printed output, and the screens of every module in a browser (the dev server needs a login).
