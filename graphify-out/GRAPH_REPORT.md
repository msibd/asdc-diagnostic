# Graph Report - asdc_diagnostic  (2026-11-08)

## Corpus Check
- 417 files · ~241,387 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .example 1, (none) 1, .toml 1)

## Summary
- 3010 nodes · 7862 edges · 120 communities (105 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `37cd4c22`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prismaNamespace.ts
- email-config-service.ts
- clinic-date.ts
- User.ts
- patient-schema.ts
- Account.ts
- Session.ts
- orders-section.tsx
- DashboardSectionPage
- authorize
- Appointment.ts
- purchases-tab.tsx
- Verification.ts
- requestJson
- Modal
- react
- order-service.ts
- website-layout.ts
- doctors/[id]/route.ts
- sms-service.ts
- next
- expenses-section.tsx
- doctors-section.tsx
- seed-demo.ts
- clinic-website.tsx
- package.json
- report-rules.ts
- auth.test.ts
- auth.test.ts
- result-service.ts
- prisma.ts
- users-tab.tsx
- recovery-service.ts
- admin-dashboard.tsx
- call
- export-service.ts
- commonInputTypes.ts
- clinic-website.tsx
- dependencies
- lucide-react
- report-service.ts
- website-content/route.ts
- doctor-queries.ts
- prisma.ts
- lab-reports.test.ts
- permissions.ts
- seed-website-content.ts
- app/layout.tsx
- website-content-management.tsx
- appointment-service.ts
- seed.ts
- services/[id]/route.ts
- client.ts
- usePublicLanguage
- dashboard-overview.tsx
- templates.ts
- compilerOptions
- Staff API
- Design system and platform checklist
- AccountDelegate
- AppointmentDelegate
- SessionDelegate
- UserDelegate
- VerificationDelegate
- brand.ts
- reviews.test.ts
- access-schema.ts
- logger.ts
- appointment-insights.tsx
- prismaNamespaceBrowser.ts
- import-service.ts
- qr-login-plugin.ts
- scripts
- appointment-management.tsx
- patient-rules.ts
- results.test.ts
- dotenv
- DMS implementation report
- PrismaClient
- website-layout.ts
- gallery-management.tsx
- password-recovery.test.ts
- test-catalog.test.ts
- service-public-fields.ts
- Modal
- sms-settings.tsx
- website-content.test.ts
- Architecture
- forgot-password-form.tsx
- main
- review-management.tsx
- seed-lab-tests.ts
- API
- ASDC Diagnostic: Diagnostic Center Management System
- booking-form.tsx
- auth.ts
- UI/UX fix report: dialogs, forms and layouts
- enums.ts
- Demo data (`pnpm db:seed:demo`)
- billing-schema.ts
- allowBuilds
- price-list/page.tsx
- security-view.tsx
- Prisma__UserClient
- sw.js
- Prisma__AccountClient
- Prisma__SessionClient
- Prisma__AppointmentClient
- Prisma__VerificationClient
- validatePhone
- PrismaClientBaseOptions
- AGENTS.md
- CLAUDE.md
- password-change.test.ts
- import.test.ts
- eslint.config.mjs
- public_website/api/appointments/route.ts
- autoMap

## God Nodes (most connected - your core abstractions)
1. `authorize()` - 152 edges
2. `next` - 133 edges
3. `prisma` - 101 edges
4. `apiError()` - 95 edges
5. `call()` - 81 edges
6. `writeAuditEvent()` - 80 edges
7. `react` - 74 edges
8. `lucide-react` - 66 edges
9. `requestJson()` - 55 edges
10. `parseBody()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Request flow and layering` --references--> `parseQuery()`  [INFERRED]
  ARCHITECTURE.md → src/lib/api.ts
- `What was implemented` --references--> `DataTable()`  [INFERRED]
  docs/DMS-IMPLEMENTATION-REPORT.md → src/components/shared/data-table.tsx
- `7. Components` --references--> `Modal()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/shared/modal.tsx
- `Components standardized` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx
- `Problems identified (all from the shared layer)` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx

## Import Cycles
- None detected.

## Communities (120 total, 15 thin omitted)

### Community 0 - "prismaNamespace.ts"
Cohesion: 0.02
Nodes (116): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, Args, At, AtLeast, AtLoose, AtStrict (+108 more)

### Community 1 - "email-config-service.ts"
Cohesion: 0.12
Nodes (38): GET(), PUT(), POST(), POST(), writeEmailAudit(), EmailSettingsError, getPublicSettings(), loadMailConfig() (+30 more)

### Community 2 - "clinic-date.ts"
Cohesion: 0.07
Nodes (46): GET(), querySchema, GET(), querySchema, GET(), itemSelect, GET(), GET() (+38 more)

### Community 3 - "User.ts"
Cohesion: 0.02
Nodes (85): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableStringFieldUpdateOperationsInput, StringFieldUpdateOperationsInput, User$accountsArgs (+77 more)

### Community 4 - "patient-schema.ts"
Cohesion: 0.14
Nodes (26): DELETE(), GET(), PATCH(), patientStatusSchema, GET(), patientListParamsSchema, POST(), buildPatientWhere() (+18 more)

### Community 5 - "Account.ts"
Cohesion: 0.03
Nodes (74): AccountAggregateArgs, AccountCountAggregateInputType, AccountCountAggregateOutputType, AccountCountArgs, AccountCountOrderByAggregateInput, AccountCreateArgs, AccountCreateInput, AccountCreateManyAndReturnArgs (+66 more)

### Community 6 - "Session.ts"
Cohesion: 0.03
Nodes (73): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs, SessionCountOrderByAggregateInput (+65 more)

### Community 7 - "orders-section.tsx"
Cohesion: 0.06
Nodes (59): CLINIC_TIME_ZONE, formatClinicDate(), formatClinicDateTime(), formatClinicTime(), getClinicMonthKey(), inClinic(), ageLabel(), bdtCurrency (+51 more)

### Community 8 - "DashboardSectionPage"
Cohesion: 0.09
Nodes (38): AccessPage(), instant, AppointmentsPage(), instant, BillingPage(), instant, DoctorsPage(), instant (+30 more)

### Community 9 - "authorize"
Cohesion: 0.16
Nodes (37): DELETE(), GET(), POST(), PATCH(), POST(), POST(), POST(), PATCH() (+29 more)

### Community 10 - "Appointment.ts"
Cohesion: 0.04
Nodes (53): AggregateAppointment, AppointmentAggregateArgs, AppointmentCountAggregateInputType, AppointmentCountAggregateOutputType, AppointmentCountArgs, AppointmentCountOrderByAggregateInput, AppointmentCreateArgs, AppointmentCreateInput (+45 more)

### Community 11 - "purchases-tab.tsx"
Cohesion: 0.08
Nodes (46): @tanstack/react-query@5.106.1, @hookform/resolvers, react-hook-form, @tanstack/react-query, QueryMeta, QueryProvider(), RealtimeQuerySync(), formatDay() (+38 more)

### Community 12 - "Verification.ts"
Cohesion: 0.04
Nodes (52): AggregateVerification, GetVerificationAggregateType, GetVerificationGroupByPayload, VerificationAggregateArgs, VerificationCountAggregateInputType, VerificationCountAggregateOutputType, VerificationCountArgs, VerificationCountOrderByAggregateInput (+44 more)

### Community 13 - "requestJson"
Cohesion: 0.07
Nodes (45): createInvoice(), recordPayment(), blankToNull(), CatalogKind, emptyParameter(), emptyRange, emptyService, InvoiceRecord (+37 more)

### Community 14 - "Modal"
Cohesion: 0.08
Nodes (32): EmptyState(), Button(), ButtonProps, parseBody(), PatientRequestError, readPatientResponse(), ResponseBody, formValuesFrom() (+24 more)

### Community 15 - "react"
Cohesion: 0.08
Nodes (40): react, AdminSessionContext, AdminSessionValue, useAdminSession(), PatientSelectChoice, can(), statusModifier(), AccessSection() (+32 more)

### Community 16 - "order-service.ts"
Cohesion: 0.07
Nodes (35): 4. Test orders, GET(), GET(), canCancelOrder(), canChangeSamples(), CatalogKind, CatalogMember, CatalogRow (+27 more)

### Community 17 - "website-layout.ts"
Cohesion: 0.11
Nodes (23): BilingualInput(), CardListEditor(), ChipListEditor(), Errors, ICON_LABELS, NAV_TITLES, NewsItem, NewsListEditor() (+15 more)

### Community 18 - "doctors/[id]/route.ts"
Cohesion: 0.10
Nodes (37): GET(), profileSchema, PUT(), Context, GET(), Outcome, PATCH(), refreshPublicPages() (+29 more)

### Community 19 - "sms-service.ts"
Cohesion: 0.11
Nodes (40): POST(), GET(), PUT(), POST(), POST(), hitRateLimit(), call(), checkBalance() (+32 more)

### Community 20 - "next"
Cohesion: 0.09
Nodes (23): contentSecurityPolicy, nextConfig, next, GET(), GET(), querySchema, clientIp(), POST() (+15 more)

### Community 21 - "expenses-section.tsx"
Cohesion: 0.22
Nodes (12): localDate(), categories, emptyForm(), ExpenseList, ExpensesSection(), confirmVoid(), submit(), methods (+4 more)

### Community 22 - "doctors-section.tsx"
Cohesion: 0.07
Nodes (40): useLiveRefresh(), days, liveTables, DoctorAvatar(), DoctorDetailsDialog(), Row(), closedWeek(), DoctorFormDialog() (+32 more)

### Community 23 - "seed-demo.ts"
Cohesion: 0.13
Nodes (14): allergyList, areas, DEMO_PRICES, femaleNames, histories, seedBookings(), maleNames, OrderSpec (+6 more)

### Community 24 - "clinic-website.tsx"
Cohesion: 0.39
Nodes (15): HeroServiceSlider(), localize(), categoryName(), DetailsModal(), feeLabel(), IconName, iconName(), numberFormat() (+7 more)

### Community 25 - "package.json"
Cohesion: 0.09
Nodes (30): devDependencies, prisma@7.10.1, tailwindcss@4.3.4, @tailwindcss/turbopack@4.3.4, tsx@^4.23.15, @types/jsbarcode@^3.11.4, @types/node@^20, @types/nodemailer@^8.0.2 (+22 more)

### Community 26 - "report-rules.ts"
Cohesion: 0.17
Nodes (14): ReportView(), View, instant, metadata, ReportPage(), Opened, PublicReport(), QrCode() (+6 more)

### Community 27 - "auth.test.ts"
Cohesion: 0.12
Nodes (25): vitest, bookingsPageQuery, dayKey, GET(), BOOKINGS_PAGE_SIZE, BookingsFilters, bookingsWhere(), listAppointments() (+17 more)

### Community 28 - "auth.test.ts"
Cohesion: 0.20
Nodes (22): POST(), POST(), POST(), PUT(), PATCH(), POST(), CreateOrderInput, createOrderSchema (+14 more)

### Community 29 - "result-service.ts"
Cohesion: 0.10
Nodes (36): 5. Laboratory, GET(), ResultState, OrderError, syncOrderStatus(), ageYearsAt(), evaluateValue(), Evaluation (+28 more)

### Community 30 - "prisma.ts"
Cohesion: 0.10
Nodes (26): dhakaMidnightUtc(), GET(), dateOnly(), expenseSelect, GET(), POST(), closingSchema, GET() (+18 more)

### Community 31 - "users-tab.tsx"
Cohesion: 0.13
Nodes (19): ColumnMeta, cx(), DataTable(), DataTableColumn, dataTableColumns(), dataTableFeatures, Features, column (+11 more)

### Community 32 - "recovery-service.ts"
Cohesion: 0.11
Nodes (34): POST(), schema, POST(), schema, POST(), schema, clientIp(), Limit (+26 more)

### Community 33 - "admin-dashboard.tsx"
Cohesion: 0.14
Nodes (19): createAppointmentRequest(), deleteAppointmentRequest(), readResponse(), updateAppointmentRequest(), updateAppointmentStatusRequest(), AccessSection, AdminDashboard(), changeStatus() (+11 more)

### Community 34 - "call"
Cohesion: 0.06
Nodes (37): edit(), editRole(), roleByKey(), roles(), create(), setStatus(), pay(), refund() (+29 more)

### Community 35 - "export-service.ts"
Cohesion: 0.10
Nodes (22): GET(), querySchema, csvLine(), parseCsv(), EXPORT_DATASETS, EXPORT_PERMISSIONS, ExportDataset, isExportDataset() (+14 more)

### Community 36 - "commonInputTypes.ts"
Cohesion: 0.07
Nodes (27): BoolFilter, BoolWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, EnumAppointmentStatusFilter, EnumAppointmentStatusWithAggregatesFilter (+19 more)

### Community 37 - "clinic-website.tsx"
Cohesion: 0.19
Nodes (19): Chrome(), Announcement, AnnouncementTicker(), ClinicHours(), ClinicWebsiteContent(), formatTime(), phoneLinks(), SectionHead() (+11 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, @better-auth/prisma-adapter@^1.7.15, date-fns@4.4.0, @date-fns/tz@1.5.0, @hookform/resolvers@7.0.3, jsbarcode@3.12.1, lucide-react@^1.66.0, next@16.4.4 (+21 more)

### Community 39 - "lucide-react"
Cohesion: 0.09
Nodes (17): lucide-react, metadata, metadata, instant, metadata, VerifyReportPage(), PERMISSION_GROUPS, Draft (+9 more)

### Community 40 - "report-service.ts"
Cohesion: 0.10
Nodes (35): GET(), POST(), POST(), instant, metadata, VerifyLandingPage(), POST(), refundRateLimit() (+27 more)

### Community 41 - "website-content/route.ts"
Cohesion: 0.29
Nodes (12): GET(), PUT(), buildEmbedUrl(), extractMapUrl(), isAllowedHost(), MapLinkError, MapLocation, parseMapLocation() (+4 more)

### Community 42 - "doctor-queries.ts"
Cohesion: 0.09
Nodes (36): AboutView(), AboutPage(), instant, metadata, PublicClinicIdentity, DoctorsShell(), DoctorsSkeleton(), DoctorList() (+28 more)

### Community 43 - "prisma.ts"
Cohesion: 0.20
Nodes (20): zod, paymentSchema, POST(), POST(), voidSchema, POST(), refundSchema, GET() (+12 more)

### Community 44 - "lab-reports.test.ts"
Cohesion: 0.12
Nodes (17): patientInput(), action(), code(), enter(), ids, makePatient(), makeTest(), open() (+9 more)

### Community 45 - "permissions.ts"
Cohesion: 0.16
Nodes (18): ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLES, defaultRole(), defaultRoleHasPermission(), defaultsByKey, isPermission(), Permission (+10 more)

### Community 46 - "seed-website-content.ts"
Cohesion: 0.20
Nodes (11): seedCatalog(), main(), seedLabCatalog(), BLOOD_STEPS, CONTENT, force, isBlank(), main() (+3 more)

### Community 47 - "app/layout.tsx"
Cohesion: 0.08
Nodes (25): DashboardLayout(), instant, metadata, geistMono, geistSans, hindSiliguri, metadata, publicSans (+17 more)

### Community 48 - "website-content-management.tsx"
Cohesion: 0.14
Nodes (23): CATEGORIES, categoryOf(), DEFAULTS, Draft, Errors, FieldKey, ImagePreview(), SECTION_CATEGORY (+15 more)

### Community 49 - "appointment-service.ts"
Cohesion: 0.17
Nodes (19): DELETE(), PATCH(), parseAppointmentStatus(), ACTIVE, AppointmentConflictError, assertNotDuplicate(), assertSlotFree(), clinicTimeLabel() (+11 more)

### Community 50 - "seed.ts"
Cohesion: 0.21
Nodes (7): dotenv@^18.0.9, main(), seedAdmin(), dotenv, main(), Keypress, promptHidden()

### Community 51 - "services/[id]/route.ts"
Cohesion: 0.20
Nodes (18): CatalogError, GET(), PATCH(), updateSchema, CatalogError, GET(), POST(), catalogRulesError() (+10 more)

### Community 52 - "client.ts"
Cohesion: 0.11
Nodes (13): Account, Appointment, $Enums, PrismaClient, Session, User, Verification, config (+5 more)

### Community 53 - "usePublicLanguage"
Cohesion: 0.27
Nodes (14): DoctorCard(), DoctorDirectory(), Pagination(), DoctorPhoto(), DoctorProfileView(), Section(), formatFee(), formatNumber() (+6 more)

### Community 54 - "dashboard-overview.tsx"
Cohesion: 0.15
Nodes (15): formatStatus(), AppointmentRecord, AppointmentDetailsDialog(), AppointmentsBarChart, AppointmentsChart(), KpiCard(), Overview(), overviewColors (+7 more)

### Community 55 - "templates.ts"
Cohesion: 0.71
Nodes (7): emailTestEmail(), escapeHtml(), layout(), paragraph(), passwordChangedEmail(), passwordResetOtpEmail(), reportReadyEmail()

### Community 56 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 57 - "Staff API"
Cohesion: 0.11
Nodes (18): Appointment extras, Appointments, Billing, Clinic setup and administration, Daily finance and cash closing (administrator only), Dashboard and reports, E-mail settings (administrator only, `email:manage`), Expenses (+10 more)

### Community 58 - "Design system and platform checklist"
Cohesion: 0.11
Nodes (16): 10. Performance, 11. Next.js 16.4 features, 12. Tailwind CSS and custom CSS: who does what, 1. Layout and structure, 2. Spacing, 3. Typography, 4. Colour, 5. Responsive design (+8 more)

### Community 64 - "brand.ts"
Cohesion: 0.10
Nodes (32): instant, metadata, Page(), instant, metadata, Page(), HomePage(), instant (+24 more)

### Community 65 - "reviews.test.ts"
Cohesion: 0.19
Nodes (16): GET(), POST(), getPublishedReviews(), validatePersonName(), publicRateLimits, namesOverlap(), phoneMatchKeys(), REVIEW_LIMITS (+8 more)

### Community 66 - "access-schema.ts"
Cohesion: 0.11
Nodes (29): validateEmail(), AppointmentResponse, AppointmentValidationError, APPOINTMENT_LIMITS, AppointmentField, AppointmentFieldErrors, AppointmentFieldInput, firstFieldError() (+21 more)

### Community 67 - "logger.ts"
Cohesion: 0.13
Nodes (16): onRequestError(), ClinicChange, ensureListener(), globalForRealtime, ListenerState, RealtimeGlobal, Subscriber, subscribeToClinicChanges() (+8 more)

### Community 68 - "appointment-insights.tsx"
Cohesion: 0.15
Nodes (15): recharts@^3.10.1, recharts, DayBar, HourBar, StatusSlice, TONES, AppointmentInsights(), CLINIC_HOURS (+7 more)

### Community 69 - "prismaNamespaceBrowser.ts"
Cohesion: 0.12
Nodes (15): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, DbNull, Decimal, JsonNull, ModelName, NullsOrder (+7 more)

### Community 70 - "import-service.ts"
Cohesion: 0.12
Nodes (29): POST(), uploadSchema, downloadTemplate(), IMPORT_LIMITS, IMPORT_MODULES, ImportField, ImportMode, ImportModule (+21 more)

### Community 71 - "qr-login-plugin.ts"
Cohesion: 0.25
Nodes (15): isStaffAccount(), activeStatuses, approve, cancel, complete, create, expireIfNeeded(), findValidSession() (+7 more)

### Community 72 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, admin:reset-password, build, db:generate, db:migrate, db:seed, db:seed:demo, db:seed:lab (+8 more)

### Community 73 - "appointment-management.tsx"
Cohesion: 0.15
Nodes (17): formatClinicWeekday(), bookingKeys, BookingsFilters, BookingsPage, TABLES, useBookingsPage(), AppointmentManagement(), CalendarMode (+9 more)

### Community 74 - "patient-rules.ts"
Cohesion: 0.18
Nodes (16): csvCell(), exportPatientsCsv(), patientsToCsv(), firstPatientFieldError(), PATIENT_FIELD_ORDER, PATIENT_LIMITS, PatientField, PatientFieldInput (+8 more)

### Community 75 - "results.test.ts"
Cohesion: 0.21
Nodes (9): born(), code(), ids, makePatient(), makeTest(), RangeSeed, readyOrder(), run (+1 more)

### Community 76 - "dotenv"
Cohesion: 0.25
Nodes (3): pg@^8.23.1, pg, match

### Community 77 - "DMS implementation report"
Cohesion: 0.08
Nodes (23): 10. Staff and access control, 11. Dashboard and reports, 12. Communication, 13. System settings, 1. Patient management, 2. Doctor management, 3. Test and service catalog, 6. Reports (+15 more)

### Community 79 - "website-layout.ts"
Cohesion: 0.11
Nodes (18): LayoutIcon(), announcement, announcementLink, bilingual(), card, CardIcon, contactEmail, facebookUrl (+10 more)

### Community 80 - "gallery-management.tsx"
Cohesion: 0.21
Nodes (13): byOrder(), GalleryImage, GalleryManagement(), deleteImage(), move(), send(), submitImage(), ImageFields (+5 more)

### Community 81 - "password-recovery.test.ts"
Cohesion: 0.19
Nodes (11): GET(), auth, isEmailEnabled(), configureEmail(), lastCode(), mail, newStaff(), request() (+3 more)

### Community 82 - "test-catalog.test.ts"
Cohesion: 0.16
Nodes (12): CATALOG_KINDS, CatalogFields, CatalogKind, parameterSchema, REFERENCE_SEXES, referenceRangeSchema, SAMPLE_TYPES, TEST_LIMITS (+4 more)

### Community 83 - "service-public-fields.ts"
Cohesion: 0.18
Nodes (9): serviceSchema, feeRangeCheck(), feeRangeError, OFFERED_ICON_KEYS, SERVICE_ICON_KEYS, SERVICE_PUBLIC_LIMITS, ServiceIconKey, servicePublicFields (+1 more)

### Community 84 - "Modal"
Cohesion: 0.20
Nodes (13): focusableSelector, focusableWithin(), Modal(), handleKeyDown(), PatientSelect(), choose(), close(), onKeyDown() (+5 more)

### Community 85 - "sms-settings.tsx"
Cohesion: 0.20
Nodes (13): SmsSettings, Form, HistoryRow, PURPOSE, Settings, smsParts(), SmsSettings(), post() (+5 more)

### Community 86 - "website-content.test.ts"
Cohesion: 0.23
Nodes (8): emptyWebsiteContent, highlights(), text(), WebsiteContent, WebsiteContentInput, LAYOUT_DEFAULTS, layoutOverridesSchema, invalidations

### Community 87 - "Architecture"
Cohesion: 0.17
Nodes (12): Architecture, Backup and recovery, Breaking changes in this version, Caching, Concurrency and money, Folder layout, Laboratory workflow, Overview (+4 more)

### Community 88 - "forgot-password-form.tsx"
Cohesion: 0.21
Nodes (8): ForgotPasswordPage(), instant, metadata, ForgotPasswordForm(), savePassword(), post(), Step, STEPS

### Community 89 - "main"
Cohesion: 0.21
Nodes (6): main(), runOrder(), seedExpenses(), takePayments(), valuesFor(), random

### Community 90 - "review-management.tsx"
Cohesion: 0.20
Nodes (10): FILTERS, initials(), Review, ReviewManagement(), Stars(), STATUS_EDGE, STATUS_PILL, statusLabels (+2 more)

### Community 91 - "seed-lab-tests.ts"
Cohesion: 0.17
Nodes (8): Db, negative(), PANELS, Parameter, Range, Sex, Test, TESTS

### Community 92 - "API"
Cohesion: 0.25
Nodes (7): API, Authentication, Conventions, Patient reviews, Public API (no sign-in), Website content, label()

### Community 93 - "ASDC Diagnostic: Diagnostic Center Management System"
Cohesion: 0.20
Nodes (10): ASDC Diagnostic: Diagnostic Center Management System, Backup and recovery, Demo data, Deploying database changes, Doctor directory, From booking to report, Local setup, Roles (+2 more)

### Community 94 - "booking-form.tsx"
Cohesion: 0.12
Nodes (26): Users and roles (administrator only), Roles and permissions, Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`, Database, Deliberately not modelled, Indexes, Migrations, Relationships and deletion rules (+18 more)

### Community 95 - "auth.ts"
Cohesion: 0.25
Nodes (6): better-auth@^1.7.15, better-auth, GET, handlers, trustedOrigins, qrLoginPlugin

### Community 96 - "UI/UX fix report: dialogs, forms and layouts"
Cohesion: 0.22
Nodes (8): Components standardized, Modified files, Problems fixed, Problems identified (all from the shared layer), Remaining issues, Responsive behaviour, UI/UX fix report: dialogs, forms and layouts, Verified in the browser

### Community 97 - "enums.ts"
Cohesion: 0.22
Nodes (7): Account, Appointment, $Enums, Session, User, Verification, AppointmentStatus

### Community 98 - "Demo data (`pnpm db:seed:demo`)"
Cohesion: 0.22
Nodes (8): Demo data (`pnpm db:seed:demo`), Demo logins (development only), Public website wording (`pnpm db:seed:website`), Repeatable and safe, Resetting, Seed data, Starter test catalog (`pnpm db:seed:lab`), What is created

### Community 99 - "billing-schema.ts"
Cohesion: 0.26
Nodes (9): emptyInvoiceForm(), emptyInvoiceItem(), invoiceFormSchema, InvoiceFormValues, invoiceInputSchema, isMoney(), LIMITS, money() (+1 more)

### Community 100 - "allowBuilds"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, prisma, @prisma/engines, sharp, unrs-resolver

### Community 101 - "price-list/page.tsx"
Cohesion: 0.43
Nodes (5): instant, metadata, PriceListPage(), reportTime(), PrintButton()

### Community 102 - "security-view.tsx"
Cohesion: 0.52
Nodes (6): post(), Result, SecurityView(), checkFields(), sendCode(), updatePassword()

### Community 104 - "sw.js"
Cohesion: 0.33
Nodes (3): IS_LOCAL, PUBLIC_PAGES, SHELL_URLS

### Community 109 - "validatePhone"
Cohesion: 0.46
Nodes (6): ReviewsSection(), submitReview(), compactPhone(), CONTACT_LIMITS, validatePhone(), phone()

### Community 110 - "PrismaClientBaseOptions"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

### Community 114 - "password-change.test.ts"
Cohesion: 0.32
Nodes (5): change(), freshIp(), mail, requestCode(), sent

### Community 115 - "import.test.ts"
Cohesion: 0.33
Nodes (6): csv(), newPhone(), patientFile(), patientMapping, run, send()

### Community 116 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.4, eslint, eslint-config-next

### Community 117 - "public_website/api/appointments/route.ts"
Cohesion: 0.60
Nodes (4): POST(), runAfterResponse(), enforcePublicRateLimit(), parseCreateAppointment()

### Community 119 - "autoMap"
Cohesion: 0.67
Nodes (3): autoMap(), choose(), normalize()

## Knowledge Gaps
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `client.ts` to `prismaNamespace.ts`, `User.ts`, `commonInputTypes.ts`, `Account.ts`, `prismaNamespaceBrowser.ts`, `Session.ts`, `Appointment.ts`, `Verification.ts`, `package.json`?**
  _High betweenness centrality (0.347) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `authorize()` (e.g. with `10. Staff and access control` and `Verification`) actually correct?**
  _`authorize()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `prismaNamespace.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.017094017094017096 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `email-config-service.ts`, `clinic-date.ts`, `patient-schema.ts`, `orders-section.tsx`, `DashboardSectionPage`, `authorize`, `order-service.ts`, `doctors/[id]/route.ts`, `sms-service.ts`, `clinic-website.tsx`, `package.json`, `report-rules.ts`, `auth.test.ts`, `auth.test.ts`, `result-service.ts`, `prisma.ts`, `recovery-service.ts`, `admin-dashboard.tsx`, `clinic-website.tsx`, `dependencies`, `lucide-react`, `report-service.ts`, `website-content/route.ts`, `doctor-queries.ts`, `prisma.ts`, `app/layout.tsx`, `website-content-management.tsx`, `appointment-service.ts`, `services/[id]/route.ts`, `usePublicLanguage`, `dashboard-overview.tsx`, `Design system and platform checklist`, `brand.ts`, `reviews.test.ts`, `logger.ts`, `appointment-insights.tsx`, `import-service.ts`, `gallery-management.tsx`, `password-recovery.test.ts`, `forgot-password-form.tsx`, `auth.ts`, `price-list/page.tsx`, `public_website/api/appointments/route.ts`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Should `email-config-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11649659863945579 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `orders-section.tsx`, `purchases-tab.tsx`, `requestJson`, `Modal`, `react`, `website-layout.ts`, `next`, `expenses-section.tsx`, `doctors-section.tsx`, `clinic-website.tsx`, `package.json`, `report-rules.ts`, `users-tab.tsx`, `admin-dashboard.tsx`, `clinic-website.tsx`, `dependencies`, `doctor-queries.ts`, `app/layout.tsx`, `website-content-management.tsx`, `usePublicLanguage`, `dashboard-overview.tsx`, `access-schema.ts`, `appointment-insights.tsx`, `import-service.ts`, `appointment-management.tsx`, `website-layout.ts`, `gallery-management.tsx`, `Modal`, `sms-settings.tsx`, `forgot-password-form.tsx`, `review-management.tsx`, `booking-form.tsx`, `price-list/page.tsx`, `security-view.tsx`, `validatePhone`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Should `clinic-date.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06682692307692308 - nodes in this community are weakly interconnected._