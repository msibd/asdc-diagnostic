# Design system and platform checklist

How the interface is built, what is in place, and what is still open. Tokens live in
[src/app/design-tokens.css](src/app/design-tokens.css); shared behaviour (states, badges, tooltips, accessibility modes)
is the last section of [src/app/globals.css](src/app/globals.css).

Legend: **Done** was already in the project, **Added** was added in this pass, **Open** is a known gap with a recommendation.

## 1. Layout and structure

| Item | Status | Notes |
| --- | --- | --- |
| Container, content width | Done | `.content` pads the dashboard; the public site uses `max-w-7xl` with `px-4 sm:px-6 lg:px-8`. `--page-gutter` (fluid) and `--measure` (68ch reading width) added. |
| Grid, flexbox, columns | Done | CSS Grid for cards/forms (`auto-fit`/`auto-fill` + `minmax`, so columns reflow without media queries); flex for toolbars. |
| Sidebar layout | Done | Fixed 185px sidebar, collapsible to 64px, drawer under 760px, skip link, focus handling. |
| Header and footer | Done | Sticky top bar with breadcrumb, search, profile. Public site has header, sections, footer. |
| Section structure | Done | Dashboard pages = heading + cards; public site = full-width banded sections. |

## 2. Spacing

| Item | Status | Notes |
| --- | --- | --- |
| Spacing scale | Added | `--space-1` … `--space-16` (4px base), `--section-gap`, `--card-padding`. |
| Margin, padding, gap | Open | Shared dashboard content gutters and responsive page padding use the spacing tokens. Existing component rules still contain raw px; migrate them as they are touched. |
| Whitespace | Done | Cards carry 16-20px padding; section gaps 16-24px. |

## 3. Typography

| Item | Status | Notes |
| --- | --- | --- |
| Font family | Done | Geist Sans / Mono through `next/font` (self-hosted, no layout shift). Bangla falls back to the system Bengali font. |
| Size scale | Added | `--text-xs` … `--text-3xl`, fluid (`clamp`). Nothing below 12px: all 11px/11.5px rules were raised to 12px. |
| Weight, line height, tracking | Added | `--weight-*`, `--leading-*` (1.7 for Bangla), `--tracking-*`. |
| Heading hierarchy | Added | Headings get `text-wrap: balance`, paragraphs `text-wrap: pretty`. |
| Readability | Added | Faint text colour raised to 5.3:1; Bangla gets 1.7 line height. |
| Open | Open | About 80 distinct font-size declarations remain in old CSS; consolidate onto the scale over time. |

## 4. Colour

| Item | Status | Notes |
| --- | --- | --- |
| Primary / secondary / accent | Added | `--brand-50…800` (teal), `--accent` (blue). |
| Surfaces, text, borders | Added | `--surface-page/1/2/3`, `--text-1/2/3`, `--border-1/2`; light and dark values. |
| Success / warning / error / info | Added | Each has `-bg`, `-border`, `-text`; text passes 4.5:1 on its background. `.badge-success|warning|danger|info|neutral` use them. |
| Contrast | Done / Open | Key text pairs checked (see tokens file). About 500 older hex colours are not yet on tokens. |
| Light and dark theme | Done | `data-theme` set before first paint (no flash); `color-scheme` set so native controls match; theme-color meta follows the device. |

## 5. Responsive design

| Item | Status | Notes |
| --- | --- | --- |
| Breakpoints | Added | Documented: 520 / 760 / 1100 / 1600. |
| Fluid layout and type | Done / Added | `auto-fit` grids; fluid `--text-*` scale. |
| Navigation transformation | Done | Sidebar → drawer under 760px; tab bars scroll horizontally. |
| Responsive images | Done | `next/image` with explicit dimensions and fixed aspect ratios (no layout shift). |
| Mobile first | Open | Existing CSS is desktop-first (`max-width` queries, 60 of them). New components should be written mobile-first (`min-width`). A rewrite of old CSS is not worth the risk. |

## 6. Visual hierarchy

| Item | Status | Notes |
| --- | --- | --- |
| Primary vs secondary actions | Done | Gradient primary button, outlined secondary, red for destructive. |
| Card titles | Done | Tinted label with accent edge; public headings use a highlighter stroke. |
| Consistency | Added | One elevation scale (`--shadow-1…4`), one radius scale, one z-index scale, one motion scale. |

## 7. Components

| Component | Status | Notes |
| --- | --- | --- |
| Buttons, cards, inputs, dropdowns | Done | `button-primary/secondary`, `panel-card`, `form-field`. Focus ring on inputs added. |
| Modals | Done | Shared `Modal`: focus trap, Esc, backdrop, focus return. |
| Tables | Done | `data-table` in a scroll wrapper. |
| Tabs | Done | `wc-tab` bar used by website content, inventory, finance, access. |
| Breadcrumbs | Done | "Clinic / Page" in the top bar. |
| Pagination | Added / Open | `.pagination` styles added. Lists use cursor "Load more"; page numbers only where counts are known. |
| Badges | Added | `.badge-*` family (older `invoice-status`, `status-pill` keep working). |
| Tooltips | Added | Every icon button with an `aria-label` shows it on hover and keyboard focus (CSS only). |
| Skeletons | Added | `.skeleton` plus `loading.tsx` for the dashboard. |
| Navigation menus | Done | Grouped sidebar, role-filtered, `aria-current`. |

## 8. Interaction

| Item | Status | Notes |
| --- | --- | --- |
| Hover / focus / active | Done / Added | Hover on cards and buttons; 2px focus ring everywhere; pressed state (1px push, 98% scale). |
| Loading states | Done / Added | Per-section loading text, button "Saving…", route skeleton. |
| Form validation | Done / Added | Inline messages; invalid fields now also get a red border (`aria-invalid`). |
| Transitions, animation | Added | Motion tokens; every transition/animation is switched off for people who ask for reduced motion. |

## 9. Accessibility (WCAG 2.2 AA)

| Item | Status | Notes |
| --- | --- | --- |
| Keyboard | Done | Skip link, focus ring, tab order, Esc closes drawers and modals, mobile drawer leaves the tab order when closed. |
| Screen readers | Done | Landmarks, `aria-current`, live regions, labelled icon buttons, labelled form fields. |
| Touch targets | Added | 44px minimum on touch devices (`pointer: coarse`). |
| Reduced motion | Added | Global, not per component. |
| High contrast (forced colors) | Added | Borders and focus outline survive Windows High Contrast. |
| Contrast | Done / Open | See colour section; run an automated audit (axe or Lighthouse) in a browser before release. |

## 10. Performance

| Item | Status | Notes |
| --- | --- | --- |
| Fonts | Done | `next/font`, self-hosted, swap, no CLS. |
| Images | Done / Open | Dimensions always set. Gallery and hero images come from links the clinic pastes, so they use `unoptimized`; uploading to storage would let Next resize and convert them. |
| CSS size | Open | `globals.css` is about 10,800 lines (one render-blocking file). Recommendation: split by area as it is touched; tokens make that safe. |
| CLS | Done | Fixed image ratios, skeleton shapes match real content, no late-inserted banners. |
| Caching | Done | Cache Components, tag-based invalidation for public content. |

## 11. Next.js 16.4 features

| Feature | Status | Notes |
| --- | --- | --- |
| App Router, Server Components, Route Handlers | Done | |
| Cache Components (`cacheComponents`) | Done | On. Route handlers must not export `runtime` (docs) and none do; they run on Node.js, which SMTP needs. |
| Partial prefetching, `instant` | Done | On. |
| Turbopack | Done | Default bundler. |
| `next/font`, `next/image`, `next/link` | Done | |
| Metadata API | Done / Added | `metadataBase`, title template, Open Graph, per-section `robots`. |
| Viewport and theme colour | Added | Light/dark theme-color, `color-scheme`. |
| `manifest` (PWA) | Done | Theme colour corrected to the brand teal. |
| `robots.ts`, `sitemap.ts` | Added | Public site indexable; staff area and API excluded. |
| `error.tsx` | Done | Dashboard. |
| `global-error.tsx` | Added | Own document, light/dark. |
| `not-found.tsx` | Added | Branded 404. |
| `loading.tsx` | Added | Dashboard skeleton. |
| Security headers | Done / Added | nosniff, frame deny, referrer, permissions; HSTS (production); `poweredByHeader` off. |
| Redirects | Done | |
| Open | Open | `opengraph-image` (needs a designed share image), a Content-Security-Policy (needs a nonce setup and a full browser pass), React Compiler (lint rules are on, the compiler is not enabled), `proxy.ts` (not needed: pages guard themselves on the server). |

## 12. Tailwind CSS and custom CSS: who does what

Tailwind CSS **4.3.4** (latest stable, pinned exactly together with `@tailwindcss/turbopack` 4.3.4). Tailwind 4 has no
config file; its theme is in `globals.css` (`@theme`).

**Use Tailwind utilities inline for:** the layout, spacing, sizing and colour of a component that is written once in
TSX: cards, lists, toolbars, empty/error/loading screens, the public website. The design tokens are Tailwind colours,
so one class is right in both themes and no `dark:` prefix is needed:

```
bg-surface-1  text-ink-1/2/3  border-line-1/2  bg-success-bg text-success-text  rounded-card  shadow-card
bg-brand-500  text-accent     p-4 gap-3 (4px grid, same as --space-*)             dark: (follows data-theme)
```

**Keep custom CSS (globals.css) for:** things utilities do badly or that many components share.
- the shared components used by hundreds of elements (`panel-card`, `button-primary/secondary`, `data-table`, `form-field`, `modal`, `nav-item`, badges) so a restyle is one edit;
- the sidebar, top bar and the dashboard's large grid/chart layouts, and the dark-theme overrides of older rules;
- keyframes, `:has()`/sibling/state selectors, print and forced-colors rules, third-party chart styling;
- the tokens themselves (`design-tokens.css`).

**Converted in this pass** (and their CSS deleted, 590 lines / 92 rules): patient reviews, gallery manager, 404 page,
dashboard loading skeleton. New screens should be written with utilities, reusing the shared component classes for
buttons, cards and inputs.

**Rules**
- Write whole class names (`bg-warning-bg`), never build them from strings, or Tailwind cannot see them. Use lookup maps for states.
- Do not redefine Tailwind's own variable names in `:root` (`--text-*`, `--radius-*`, `--leading-*`, `--tracking-*`, `--shadow-sm…`, `--ease-*`). The design tokens use `--fs-*`, `--r-*`, `--lh-*`, `--ls-*` for that reason.
- Not yet converted (about 10,500 lines): dashboard, billing, patients, appointments, treatments, expenses, inventory, access, email settings. Move a screen over only when it is being changed anyway, and delete its old rules in the same change.
