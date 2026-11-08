# UI/UX fix report: dialogs, forms and layouts

Date: 2026-11-08. Approach: fix the shared components first, so no page needs a one-off fix.
**Checked in a browser** (production build of the current code served on a spare port, signed in as admin, dark theme): Edit doctor, Add staff, the confirm dialog and the Doctors page at 1280px and at phone width (375px). Typecheck, lint and the production build pass. Pages other than Doctors and Staff & roles were not opened.

## Problems identified (all from the shared layer)

| # | Problem | Source |
| --- | --- | --- |
| 1 | The page behind a dialog still scrolled | Shared `Modal` never locked it |
| 2 | On a long form the heading and the Save / Cancel row scrolled out of view | `.modal` scrolls as one block; the footer sits at the end of the form |
| 3 | Confirm dialogs: the Cancel and Confirm buttons touched the dialog edge | `.modal-actions` has no padding when it is a direct child of the dialog |
| 4 | Every dialog containing a form was forced to 860px, even for one or two fields | `.modal:has(.modal-form)` width rule beat each dialog's own size |
| 5 | A short form was split into two columns, leaving a half-empty row | Two-column grid applied to every modal form |
| 6 | A second scrollbar was possible on the backdrop | `.modal-backdrop` had `overflow-y: auto` while the dialog also scrolls |
| 7 | When a dialog's heading sits inside a two-column form it took only half the width, so the close button floated mid-dialog (seen in Edit doctor and Add staff) | The two-column grid rule did not list `.modal-heading` |
| 8 | On phones the "Add doctor" button label was squeezed onto two lines | Shared `.panel-header` let the text push the button narrow |

Already fine: dialog focus trap, Escape and backdrop close, focus return, mobile full-width buttons, one-column forms on phones, 16px inputs on touch devices, layering (modal 40, toast 50, my action menu 30).

## Problems fixed

- **1:** `src/components/shared/modal.tsx` locks `body` scroll while any dialog is open. A counter keeps it locked when a confirm opens on top of a form, and releases it when the last one closes.
- **2:** the heading (direct child) and the Save / Cancel row of dialog forms are `position: sticky`, so they stay in view while the middle scrolls.
- **3:** a dialog's own `.modal-actions` now has padding.
- **4 and 5:** a short form (no field group, no grid row, at most six children) gets a 520px, one-column dialog. Longer forms keep the wide two-column layout, and dialogs with an explicit size (patient, purchase, new order, order details) are left alone.
- **6:** the backdrop no longer scrolls; the dialog scrolls itself.
- **7:** `.modal-form > .modal-heading` spans all columns, so the close button sits at the right edge (measured: 21px from the edge).
- **8:** header action buttons keep one line; on phones the header wraps and the button sits under the text.

## Verified in the browser

| Check | Result |
| --- | --- |
| Body scroll while a dialog is open | Locked; released on close; stays locked when a confirm opens over a form |
| Save / Cancel row of the long Edit doctor form | Pinned to the bottom edge of the dialog at 1280x720 and at 375x812 |
| Confirm dialog | Buttons 21px from the edge; Cancel closes it without deactivating anyone |
| Phone dialog | Fits the screen (351px in 375px), full-width stacked buttons, no sideways scroll |
| Doctors page on a phone | Rows become cards, filters stack, no sideways scroll, header button on one line |
| Escape key | Closes the dialog |

All rules sit in one block at the end of `src/app/globals.css` so they win over the older layers, and the footer rule is limited to forms inside a `.modal`, so inline page forms are unaffected.

## Modified files

- `src/components/shared/modal.tsx`
- `src/app/globals.css` (one block appended)
- `docs/UI-UX-FIX-REPORT.md`

## Components standardized

`Modal` (scroll lock), dialog structure (heading, scrolling body, pinned footer), confirm dialog buttons, modal widths, modal form columns.

## Responsive behaviour

Unchanged where it already worked (phones: full-width dialog, stacked full-width buttons, one column). The pinned footer's side margins have a phone variant.

## Remaining issues

- **Short-form width rule not exercised.** No dialog I opened qualified (both had a grid or field groups), so the 520px one-column layout is untested. A form that lands on the wrong side of it needs one explicit size class.
- **Required-field marks:** labels wrap their inputs (`<label class="form-field">Text<input/></label>`), so a CSS-only asterisk is not reliable. This needs a small shared field component or a one-time pass over the forms.
- **Dialogs whose heading sits inside the form** (for example Staff accounts) scroll with the form; only direct-child headings are pinned.
- **Page layouts:** pages already share the `panel-card` and `panel-header` pattern. Only Doctors and Staff & roles were opened; no page-specific changes were made, since the brief says not to redesign working pages without a clear reason. The other modules (billing, inventory, finance, reports, orders, settings) still need a browser pass.
- **Light theme** was not checked; the review ran in the dark theme.
- **Modal sizes** are still a mix of explicit widths (`470`, `560`, `680`, `760`, `860`, `900`) in older CSS; they should be moved onto three tokens (small, medium, wide) later.
