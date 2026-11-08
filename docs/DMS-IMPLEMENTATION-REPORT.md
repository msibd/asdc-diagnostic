# DMS implementation report

Date: 2026-11-08. Scope: audit of all 13 modules, then the smallest fixes that needed no business decision and no database migration. Larger items are in [DMS-RECOMMENDATIONS.md](DMS-RECOMMENDATIONS.md) and were deliberately not started.

## What was implemented

| Item | Priority | Change |
| --- | --- | --- |
| Critical result acknowledgement | P1 | New route `src/app/api/orders/[id]/critical-ack/route.ts`. `POST` (needs `results:enter`) records who was told about a critical result; `GET` (needs `orders:read`) returns the latest record. Stored in the existing `AuditEvent` table, so **no migration**. Refuses an order with no critical value (409), a blank name (400), and users without permission (403). The red banner in `order-results-panel.tsx` now shows who was told and when, or a short form to record it. |
| Payment double-submit | P0 | `billing-section.tsx`: the Save payment button is disabled while the request runs, so a double-click cannot record the amount twice. |
| Logs out of version control | P0 | `*.log` added to `.gitignore`. |
| Doctors page redesign | UI | Earlier in this session: action menu, TanStack-based table (shared `DataTable` extended with optional class and label options), responsive cards. |

## Modified files

- `src/app/api/orders/[id]/critical-ack/route.ts` (new)
- `src/modules/orders/components/order-results-panel.tsx`
- `src/modules/clinic/components/billing-section.tsx`
- `src/app/globals.css` (3 small rules for the acknowledgement form, plus the Doctors page block)
- `src/components/shared/data-table.tsx`, `src/modules/doctors/components/doctors-section.tsx`
- `tests/results.test.ts` (2 new cases)
- `.gitignore`, `docs/DMS-*.md`

## Migrations

None. `prisma validate` passes and the schema is unchanged.

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Pass |
| `eslint src tests` | Pass |
| `next build` | Pass; `/api/orders/[id]/critical-ack` is in the route list. Built into a temporary folder so the running dev server was not touched. |
| `vitest run` | 572 passed, 1 failed (573). The failure is `finance.test.ts` "works out expected cash from real payments, refunds and expenses". It failed the same way before any change, and passes when run alone (3/3), so it is flaky in the parallel run. |
| New tests | Acknowledgement is recorded and read back; refused with no critical value, a blank name, a role without `results:enter`, and an unknown order |
| Permissions | Receptionist gets 403 on `POST` and can read via `GET`; unauthenticated users are refused by `authorize` |

## Not done, and why

- Items 5 to 12 in the recommendations (visit history screen, order and report-ready SMS, referring-doctor list, commission, departments, duplicate check, discount control, signature block). Each needs a migration or a business rule from the centre. They were not guessed.
- Backups: an operations task outside the app.
- Not checked: the new banner and the Doctors page in a browser (the dev server needs an admin login), SMS delivery, barcode hardware.
