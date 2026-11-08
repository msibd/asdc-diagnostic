# Graph Report - asdc_diagnostic  (2026-11-08)

## Corpus Check
- 418 files · ~241,434 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .example 1, (none) 1, .toml 1)

## Summary
- 3014 nodes · 7865 edges · 116 communities (100 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae952f0d`
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
- email-config-service.ts
- order-service.ts
- website-layout.ts
- doctors/[id]/route.ts
- sms-service.ts
- password-change.test.ts
- Modal
- doctors-section.tsx
- seed-demo.ts
- email-settings.tsx
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
- react
- dependencies
- section-shared.tsx
- report-service.ts
- DMS feature audit
- doctor-queries.ts
- prisma.ts
- rate-limit.ts
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
- appointment-modal.tsx
- logger.ts
- appointment-insights.tsx
- prismaNamespaceBrowser.ts
- import-service.ts
- qr-login-plugin.ts
- scripts
- appointment-management.tsx
- patient-rules.ts
- appointment-queries.ts
- dotenv
- DMS implementation report
- PrismaClient
- website-layout.ts
- gallery-management.tsx
- password-recovery.test.ts
- test-catalog.test.ts
- service-public-fields.ts
- PatientSelect
- sms-settings.tsx
- vercel.json
- Architecture
- forgot-password-form.tsx
- main
- review-management.tsx
- seed-lab-tests.ts
- API
- ASDC Diagnostic: Diagnostic Center Management System
- Database
- next.config.ts
- enums.ts
- Demo data (`pnpm db:seed:demo`)
- billing-section.tsx
- allowBuilds
- lucide-react
- security-view.tsx
- Prisma__UserClient
- sw.js
- Prisma__AccountClient
- Prisma__SessionClient
- Prisma__AppointmentClient
- Prisma__VerificationClient
- appointment-rules.ts
- PrismaClientBaseOptions
- AGENTS.md
- CLAUDE.md
- eslint.config.mjs
- appointment-schema.ts

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
- `Relationships and deletion rules` --references--> `ClinicService`  [INFERRED]
  DATABASE.md → src/app/public_website/components/types.ts
- `Request flow and layering` --references--> `parseQuery()`  [INFERRED]
  ARCHITECTURE.md → src/lib/api.ts
- `What was implemented` --references--> `DataTable()`  [INFERRED]
  docs/DMS-IMPLEMENTATION-REPORT.md → src/components/shared/data-table.tsx
- `7. Components` --references--> `Modal()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/shared/modal.tsx
- `10. Staff and access control` --references--> `authorize()`  [INFERRED]
  docs/DMS-FEATURE-AUDIT.md → src/lib/admin-session.ts

## Import Cycles
- None detected.

## Communities (116 total, 16 thin omitted)

### Community 0 - "prismaNamespace.ts"
Cohesion: 0.02
Nodes (116): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, Args, At, AtLeast, AtLoose, AtStrict (+108 more)

### Community 1 - "email-config-service.ts"
Cohesion: 0.18
Nodes (20): GET(), PUT(), POST(), getPublicSettings(), readRow(), saveSettings(), email, EmailSettingsInput (+12 more)

### Community 2 - "clinic-date.ts"
Cohesion: 0.07
Nodes (37): GET(), itemSelect, POST(), GET(), POST(), dateOnly, EXPIRY_WARNING_DAYS, ItemInput (+29 more)

### Community 3 - "User.ts"
Cohesion: 0.02
Nodes (85): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableStringFieldUpdateOperationsInput, StringFieldUpdateOperationsInput, User$accountsArgs (+77 more)

### Community 4 - "patient-schema.ts"
Cohesion: 0.13
Nodes (28): GET(), DELETE(), GET(), PATCH(), patientStatusSchema, GET(), patientListParamsSchema, POST() (+20 more)

### Community 5 - "Account.ts"
Cohesion: 0.03
Nodes (74): AccountAggregateArgs, AccountCountAggregateInputType, AccountCountAggregateOutputType, AccountCountArgs, AccountCountOrderByAggregateInput, AccountCreateArgs, AccountCreateInput, AccountCreateManyAndReturnArgs (+66 more)

### Community 6 - "Session.ts"
Cohesion: 0.03
Nodes (73): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs, SessionCountOrderByAggregateInput (+65 more)

### Community 7 - "orders-section.tsx"
Cohesion: 0.08
Nodes (44): formatClinicDate(), formatClinicTime(), inClinic(), OrderDetailsDialog(), Pending, OrderSlipSheet(), SampleLabelsSheet(), who() (+36 more)

### Community 8 - "DashboardSectionPage"
Cohesion: 0.09
Nodes (38): AccessPage(), instant, AppointmentsPage(), instant, BillingPage(), instant, DoctorsPage(), instant (+30 more)

### Community 9 - "authorize"
Cohesion: 0.10
Nodes (61): next, POST(), voidSchema, GET(), POST(), closingSchema, GET(), POST() (+53 more)

### Community 10 - "Appointment.ts"
Cohesion: 0.04
Nodes (53): AggregateAppointment, AppointmentAggregateArgs, AppointmentCountAggregateInputType, AppointmentCountAggregateOutputType, AppointmentCountArgs, AppointmentCountOrderByAggregateInput, AppointmentCreateArgs, AppointmentCreateInput (+45 more)

### Community 11 - "purchases-tab.tsx"
Cohesion: 0.06
Nodes (63): AdminIdentity, AdminSessionContext, AdminSessionValue, useAdminSession(), formatClinicDateTime(), formatDay(), can(), formatStatus() (+55 more)

### Community 12 - "Verification.ts"
Cohesion: 0.04
Nodes (52): AggregateVerification, GetVerificationAggregateType, GetVerificationGroupByPayload, VerificationAggregateArgs, VerificationCountAggregateInputType, VerificationCountAggregateOutputType, VerificationCountArgs, VerificationCountOrderByAggregateInput (+44 more)

### Community 13 - "requestJson"
Cohesion: 0.10
Nodes (35): blankToNull(), CatalogKind, emptyParameter(), emptyRange, emptyService, InvoiceRecord, numberOrNull(), ParameterForm (+27 more)

### Community 14 - "Modal"
Cohesion: 0.08
Nodes (31): @hookform/resolvers@7.0.3, react-hook-form@7.91.0, @hookform/resolvers, react-hook-form, Button(), ButtonProps, PatientDirectory, parseBody() (+23 more)

### Community 15 - "email-config-service.ts"
Cohesion: 0.19
Nodes (18): POST(), AuditClient, maskEmail(), writeEmailAudit(), EmailSettingsError, loadMailConfig(), recordTest(), sendTestEmail() (+10 more)

### Community 16 - "order-service.ts"
Cohesion: 0.08
Nodes (36): 4. Test orders, canCancelOrder(), canChangeSamples(), CatalogKind, CatalogMember, CatalogRow, deriveOrderStatus(), groupBySample() (+28 more)

### Community 17 - "website-layout.ts"
Cohesion: 0.10
Nodes (24): BilingualInput(), CardListEditor(), ChipListEditor(), Errors, ICON_LABELS, NAV_TITLES, NewsItem, NewsListEditor() (+16 more)

### Community 18 - "doctors/[id]/route.ts"
Cohesion: 0.08
Nodes (46): GET(), profileSchema, PUT(), Context, DELETE(), GET(), Outcome, PATCH() (+38 more)

### Community 19 - "sms-service.ts"
Cohesion: 0.11
Nodes (34): call(), checkBalance(), CODE_MESSAGES, describeGatewayCode(), GatewayResult, networkFailure(), sendSms(), SmsCredentials (+26 more)

### Community 20 - "password-change.test.ts"
Cohesion: 0.17
Nodes (12): clientIp(), POST(), clientIp(), POST(), schema, maskEmail(), TEST_PASSWORD, change() (+4 more)

### Community 21 - "Modal"
Cohesion: 0.09
Nodes (27): Components standardized, Modified files, Problems fixed, Problems identified (all from the shared layer), Remaining issues, Responsive behaviour, UI/UX fix report: dialogs, forms and layouts, Verified in the browser (+19 more)

### Community 22 - "doctors-section.tsx"
Cohesion: 0.07
Nodes (45): EmptyState(), initials(), AppointmentTable(), statusClass(), statusNames, days, DoctorAvatar(), dateTime (+37 more)

### Community 23 - "seed-demo.ts"
Cohesion: 0.13
Nodes (14): allergyList, areas, DEMO_PRICES, femaleNames, histories, seedBookings(), maleNames, OrderSpec (+6 more)

### Community 24 - "email-settings.tsx"
Cohesion: 0.16
Nodes (11): EmailSettings, ACTION_LABELS, EmailSettings(), post(), submit(), Form, GMAIL, HistoryRow (+3 more)

### Community 25 - "package.json"
Cohesion: 0.10
Nodes (28): devDependencies, tailwindcss@4.3.4, @tailwindcss/turbopack@4.3.4, tsx@^4.23.15, @types/jsbarcode@^3.11.4, @types/node@^20, @types/nodemailer@^8.0.2, @types/pg@^8.23.1 (+20 more)

### Community 26 - "report-rules.ts"
Cohesion: 0.11
Nodes (24): instant, metadata, OrderReportPage(), ReportView(), View, instant, metadata, ReportPage() (+16 more)

### Community 27 - "auth.test.ts"
Cohesion: 0.14
Nodes (24): vitest, bookingsPageQuery, dayKey, GET(), listAppointments(), searchAppointments(), book(), run (+16 more)

### Community 28 - "auth.test.ts"
Cohesion: 0.18
Nodes (24): POST(), POST(), GET(), POST(), PUT(), PATCH(), POST(), CreateOrderInput (+16 more)

### Community 29 - "result-service.ts"
Cohesion: 0.11
Nodes (33): 5. Laboratory, previewFlag(), ageYearsAt(), evaluateValue(), Evaluation, FLAG_LABEL, formatReference(), isAgeBound() (+25 more)

### Community 30 - "prisma.ts"
Cohesion: 0.12
Nodes (31): GET(), querySchema, GET(), querySchema, dhakaMidnightUtc(), GET(), dateOnly(), expenseSelect (+23 more)

### Community 31 - "users-tab.tsx"
Cohesion: 0.13
Nodes (20): @tanstack/react-query, ColumnMeta, cx(), DataTable(), DataTableColumn, dataTableColumns(), dataTableFeatures, Features (+12 more)

### Community 32 - "recovery-service.ts"
Cohesion: 0.17
Nodes (25): sendSystemEmail(), createResetToken(), generateOtp(), hashOtp(), hashResetToken(), hmacKey(), normalizeEmail(), OTP_LENGTH (+17 more)

### Community 33 - "admin-dashboard.tsx"
Cohesion: 0.12
Nodes (23): AppointmentResponse, AppointmentValidationError, createAppointmentRequest(), deleteAppointmentRequest(), readResponse(), updateAppointmentRequest(), updateAppointmentStatusRequest(), AppointmentFieldErrors (+15 more)

### Community 34 - "call"
Cohesion: 0.06
Nodes (37): edit(), editRole(), setStatus(), page(), read(), save(), sendTest(), close() (+29 more)

### Community 35 - "export-service.ts"
Cohesion: 0.11
Nodes (18): GET(), querySchema, Permission, EXPORT_DATASETS, EXPORT_PERMISSIONS, ExportDataset, isExportDataset(), escapeHtml() (+10 more)

### Community 36 - "commonInputTypes.ts"
Cohesion: 0.07
Nodes (27): BoolFilter, BoolWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, EnumAppointmentStatusFilter, EnumAppointmentStatusWithAggregatesFilter (+19 more)

### Community 37 - "react"
Cohesion: 0.09
Nodes (53): Tables, react, Chrome(), Announcement, AnnouncementTicker(), BookingForm(), submitAppointment(), dhakaDateKey() (+45 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, better-auth@^1.7.15, @better-auth/prisma-adapter@^1.7.15, date-fns@4.4.0, @date-fns/tz@1.5.0, jsbarcode@3.12.1, lucide-react@^1.66.0, next@16.4.4 (+19 more)

### Community 39 - "section-shared.tsx"
Cohesion: 0.12
Nodes (19): useConfirm(), useLiveRefresh(), PERMISSION_GROUPS, Draft, draftFrom(), editable(), RoleRow, RolesTab() (+11 more)

### Community 40 - "report-service.ts"
Cohesion: 0.08
Nodes (41): GET(), POST(), POST(), instant, metadata, VerifyReportPage(), POST(), refundRateLimit() (+33 more)

### Community 41 - "DMS feature audit"
Cohesion: 0.17
Nodes (12): 10. Staff and access control, 11. Dashboard and reports, 12. Communication, 13. System settings, 1. Patient management, 2. Doctor management, 3. Test and service catalog, 6. Reports (+4 more)

### Community 42 - "doctor-queries.ts"
Cohesion: 0.10
Nodes (33): AboutView(), AboutPage(), instant, metadata, DoctorsShell(), DoctorsSkeleton(), DoctorList(), DoctorsPage() (+25 more)

### Community 43 - "prisma.ts"
Cohesion: 0.16
Nodes (21): zod, paymentSchema, POST(), POST(), refundSchema, GET(), POST(), computeInvoiceTotals() (+13 more)

### Community 44 - "rate-limit.ts"
Cohesion: 0.27
Nodes (6): POST(), schema, POST(), schema, clientIp(), Limit

### Community 45 - "permissions.ts"
Cohesion: 0.10
Nodes (25): DELETE(), GET(), instant, LoginPage(), getStaffSession(), ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS, DEFAULT_ROLES (+17 more)

### Community 46 - "seed-website-content.ts"
Cohesion: 0.20
Nodes (11): seedCatalog(), main(), seedLabCatalog(), BLOOD_STEPS, CONTENT, force, isBlank(), main() (+3 more)

### Community 47 - "app/layout.tsx"
Cohesion: 0.08
Nodes (29): zustand@^5.0.16, zustand, DashboardLayout(), instant, metadata, geistMono, geistSans, hindSiliguri (+21 more)

### Community 48 - "website-content-management.tsx"
Cohesion: 0.12
Nodes (26): CATEGORIES, categoryOf(), DEFAULTS, Draft, Errors, FieldKey, ImagePreview(), SECTION_CATEGORY (+18 more)

### Community 49 - "appointment-service.ts"
Cohesion: 0.15
Nodes (21): DELETE(), PATCH(), parseAppointmentStatus(), ACTIVE, AppointmentConflictError, assertNotDuplicate(), assertSlotFree(), clinicTimeLabel() (+13 more)

### Community 50 - "seed.ts"
Cohesion: 0.19
Nodes (9): dotenv@^18.0.9, prisma@7.10.1, main(), seedAdmin(), dotenv, prisma, main(), Keypress (+1 more)

### Community 51 - "services/[id]/route.ts"
Cohesion: 0.17
Nodes (20): CatalogError, GET(), PATCH(), updateSchema, CatalogError, GET(), POST(), serviceSchema (+12 more)

### Community 52 - "client.ts"
Cohesion: 0.10
Nodes (13): Account, Appointment, $Enums, PrismaClient, Session, User, Verification, config (+5 more)

### Community 53 - "usePublicLanguage"
Cohesion: 0.21
Nodes (17): DoctorCard(), DoctorDirectory(), Pagination(), DoctorPhoto(), DoctorProfileView(), Section(), PublicClinicIdentity, formatFee() (+9 more)

### Community 54 - "dashboard-overview.tsx"
Cohesion: 0.24
Nodes (10): formatClinicWeekday(), getClinicMonthKey(), AppointmentsBarChart, AppointmentsChart(), KpiCard(), Overview(), overviewColors, OverviewEmpty() (+2 more)

### Community 55 - "templates.ts"
Cohesion: 0.42
Nodes (9): emailTestEmail(), escapeHtml(), layout(), paragraph(), passwordChangedEmail(), passwordChangeOtpEmail(), passwordResetOtpEmail(), reportReadyEmail() (+1 more)

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
Cohesion: 0.20
Nodes (15): GET(), POST(), getPublishedReviews(), validatePersonName(), namesOverlap(), phoneMatchKeys(), REVIEW_LIMITS, ReviewSubmission (+7 more)

### Community 66 - "appointment-modal.tsx"
Cohesion: 0.18
Nodes (14): APPOINTMENT_LIMITS, AppointmentField, AppointmentFieldInput, AppointmentModal(), errorFor(), fieldProps(), handleSubmit(), validateForm() (+6 more)

### Community 67 - "logger.ts"
Cohesion: 0.15
Nodes (15): GET(), onRequestError(), ClinicChange, ensureListener(), globalForRealtime, ListenerState, RealtimeGlobal, Subscriber (+7 more)

### Community 68 - "appointment-insights.tsx"
Cohesion: 0.18
Nodes (13): DayBar, HourBar, StatusSlice, TONES, AppointmentInsights(), CLINIC_HOURS, clinicHourFormat, DayBars (+5 more)

### Community 69 - "prismaNamespaceBrowser.ts"
Cohesion: 0.12
Nodes (15): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, DbNull, Decimal, JsonNull, ModelName, NullsOrder (+7 more)

### Community 70 - "import-service.ts"
Cohesion: 0.11
Nodes (27): parseCsv(), autoMap(), downloadTemplate(), choose(), normalize(), IMPORT_LIMITS, IMPORT_MODULES, ImportField (+19 more)

### Community 71 - "qr-login-plugin.ts"
Cohesion: 0.14
Nodes (21): better-auth, GET, handlers, auth, trustedOrigins, isStaffAccount(), activeStatuses, approve (+13 more)

### Community 72 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, admin:reset-password, build, db:generate, db:migrate, db:seed, db:seed:demo, db:seed:lab (+8 more)

### Community 73 - "appointment-management.tsx"
Cohesion: 0.16
Nodes (16): bookingKeys, BookingsFilters, BookingsPage, TABLES, useBookingsPage(), AppointmentManagement(), CalendarMode, getCalendarDates() (+8 more)

### Community 74 - "patient-rules.ts"
Cohesion: 0.14
Nodes (20): csvCell(), csvLine(), exportPatientsCsv(), patientsToCsv(), firstPatientFieldError(), PATIENT_FIELD_ORDER, PATIENT_LIMITS, PatientField (+12 more)

### Community 75 - "appointment-queries.ts"
Cohesion: 0.29
Nodes (4): BOOKINGS_PAGE_SIZE, BookingsFilters, bookingsWhere(), listAppointmentsPage()

### Community 76 - "dotenv"
Cohesion: 0.25
Nodes (3): pg@^8.23.1, pg, match

### Community 77 - "DMS implementation report"
Cohesion: 0.14
Nodes (11): DMS implementation report, Migrations, Modified files, Not done, and why, Verification, What was implemented, DMS recommendations, P0: needed to run safely (+3 more)

### Community 79 - "website-layout.ts"
Cohesion: 0.08
Nodes (31): PUT(), LayoutIcon(), buildEmbedUrl(), extractMapUrl(), isAllowedHost(), MapLinkError, MapLocation, parseMapLocation() (+23 more)

### Community 80 - "gallery-management.tsx"
Cohesion: 0.24
Nodes (13): sonner@2.0.8, sonner, byOrder(), GalleryImage, GalleryManagement(), deleteImage(), move(), send() (+5 more)

### Community 81 - "password-recovery.test.ts"
Cohesion: 0.17
Nodes (13): GET(), isEmailEnabled(), addUser(), createUser(), unique(), configureEmail(), lastCode(), mail (+5 more)

### Community 82 - "test-catalog.test.ts"
Cohesion: 0.12
Nodes (16): CATALOG_KINDS, CatalogFields, CatalogKind, parameterSchema, REFERENCE_SEXES, referenceRangeSchema, SAMPLE_TYPES, TEST_LIMITS (+8 more)

### Community 83 - "service-public-fields.ts"
Cohesion: 0.21
Nodes (7): feeRangeCheck(), feeRangeError, OFFERED_ICON_KEYS, SERVICE_ICON_KEYS, SERVICE_PUBLIC_LIMITS, ServiceIconKey, servicePublicFields

### Community 84 - "PatientSelect"
Cohesion: 0.36
Nodes (8): Website content, label(), PatientSelect(), choose(), close(), onKeyDown(), openList(), PatientSelectChoice

### Community 85 - "sms-settings.tsx"
Cohesion: 0.20
Nodes (13): SmsSettings, Form, HistoryRow, PURPOSE, Settings, smsParts(), SmsSettings(), post() (+5 more)

### Community 86 - "vercel.json"
Cohesion: 0.50
Nodes (3): buildCommand, regions, $schema

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
Cohesion: 0.22
Nodes (9): FILTERS, initials(), Review, ReviewManagement(), Stars(), STATUS_EDGE, STATUS_PILL, statusLabels (+1 more)

### Community 91 - "seed-lab-tests.ts"
Cohesion: 0.17
Nodes (8): Db, negative(), PANELS, Parameter, Range, Sex, Test, TESTS

### Community 92 - "API"
Cohesion: 0.25
Nodes (5): API, Authentication, Conventions, Patient reviews, Public API (no sign-in)

### Community 93 - "ASDC Diagnostic: Diagnostic Center Management System"
Cohesion: 0.20
Nodes (10): ASDC Diagnostic: Diagnostic Center Management System, Backup and recovery, Demo data, Deploying database changes, Doctor directory, From booking to report, Local setup, Roles (+2 more)

### Community 94 - "Database"
Cohesion: 0.20
Nodes (11): Users and roles (administrator only), Roles and permissions, Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`, Database, Deliberately not modelled, Indexes, Migrations, Relationships and deletion rules (+3 more)

### Community 97 - "enums.ts"
Cohesion: 0.22
Nodes (7): Account, Appointment, $Enums, Session, User, Verification, AppointmentStatus

### Community 98 - "Demo data (`pnpm db:seed:demo`)"
Cohesion: 0.22
Nodes (8): Demo data (`pnpm db:seed:demo`), Demo logins (development only), Public website wording (`pnpm db:seed:website`), Repeatable and safe, Resetting, Seed data, Starter test catalog (`pnpm db:seed:lab`), What is created

### Community 99 - "billing-section.tsx"
Cohesion: 0.09
Nodes (33): ageLabel(), bdtCurrency, belowHundred(), belowThousand(), ONES, takaInWords(), TENS, statusModifier() (+25 more)

### Community 100 - "allowBuilds"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, prisma, @prisma/engines, sharp, unrs-resolver

### Community 101 - "lucide-react"
Cohesion: 0.13
Nodes (8): lucide-react, instant, metadata, PriceListPage(), reportTime(), PrintButton(), metadata, metadata

### Community 102 - "security-view.tsx"
Cohesion: 0.52
Nodes (6): post(), Result, SecurityView(), checkFields(), sendCode(), updatePassword()

### Community 104 - "sw.js"
Cohesion: 0.33
Nodes (3): IS_LOCAL, PUBLIC_PAGES, SHELL_URLS

### Community 109 - "appointment-rules.ts"
Cohesion: 0.27
Nodes (13): submitReview(), compactPhone(), CONTACT_LIMITS, validateEmail(), validatePhone(), phone(), validateAppointmentFields(), validateDateTime() (+5 more)

### Community 110 - "PrismaClientBaseOptions"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

### Community 116 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.4, eslint, eslint-config-next

### Community 117 - "appointment-schema.ts"
Cohesion: 0.24
Nodes (11): POST(), POST(), runAfterResponse(), enforcePublicRateLimit(), publicRateLimits, firstFieldError(), parseAppointmentInput(), parseCreateAppointment() (+3 more)

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `client.ts` to `prismaNamespace.ts`, `User.ts`, `commonInputTypes.ts`, `Account.ts`, `prismaNamespaceBrowser.ts`, `Session.ts`, `Appointment.ts`, `Verification.ts`, `package.json`?**
  _High betweenness centrality (0.347) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `authorize()` (e.g. with `10. Staff and access control` and `Verification`) actually correct?**
  _`authorize()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `prismaNamespace.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.017094017094017096 - nodes in this community are weakly interconnected._
- **Why does `next` connect `authorize` to `email-config-service.ts`, `clinic-date.ts`, `patient-schema.ts`, `orders-section.tsx`, `DashboardSectionPage`, `email-config-service.ts`, `doctors/[id]/route.ts`, `password-change.test.ts`, `doctors-section.tsx`, `package.json`, `report-rules.ts`, `auth.test.ts`, `auth.test.ts`, `prisma.ts`, `admin-dashboard.tsx`, `react`, `dependencies`, `report-service.ts`, `doctor-queries.ts`, `prisma.ts`, `rate-limit.ts`, `permissions.ts`, `app/layout.tsx`, `website-content-management.tsx`, `appointment-service.ts`, `services/[id]/route.ts`, `usePublicLanguage`, `dashboard-overview.tsx`, `Design system and platform checklist`, `brand.ts`, `reviews.test.ts`, `logger.ts`, `appointment-insights.tsx`, `qr-login-plugin.ts`, `gallery-management.tsx`, `password-recovery.test.ts`, `forgot-password-form.tsx`, `next.config.ts`, `[slug]/not-found.tsx`, `lucide-react`, `appointment-schema.ts`?**
  _High betweenness centrality (0.223) - this node is a cross-community bridge._
- **Should `clinic-date.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07315233785822021 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `orders-section.tsx`, `purchases-tab.tsx`, `requestJson`, `Modal`, `Modal`, `doctors-section.tsx`, `email-settings.tsx`, `package.json`, `report-rules.ts`, `users-tab.tsx`, `admin-dashboard.tsx`, `dependencies`, `section-shared.tsx`, `doctor-queries.ts`, `permissions.ts`, `app/layout.tsx`, `website-content-management.tsx`, `usePublicLanguage`, `dashboard-overview.tsx`, `appointment-modal.tsx`, `appointment-insights.tsx`, `import-service.ts`, `appointment-management.tsx`, `gallery-management.tsx`, `PatientSelect`, `sms-settings.tsx`, `forgot-password-form.tsx`, `review-management.tsx`, `billing-section.tsx`, `lucide-react`, `security-view.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Should `User.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._