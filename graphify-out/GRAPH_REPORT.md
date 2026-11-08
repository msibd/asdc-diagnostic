# Graph Report - asdc_diagnostic  (2026-11-08)

## Corpus Check
- 415 files · ~239,991 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .example 1, (none) 1, .toml 1)

## Summary
- 2999 nodes · 7838 edges · 117 communities (103 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

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
- admin-session.ts
- requestJson
- doctors-section.tsx
- seed-demo.ts
- clinic-website.tsx
- package.json
- report-rules.ts
- helpers.ts
- auth.test.ts
- result-service.ts
- addClinicDays
- users-tab.tsx
- recovery-service.ts
- admin-dashboard.tsx
- call
- export-service.ts
- commonInputTypes.ts
- clinic-website.tsx
- dependencies
- app/api/appointments/route.ts
- report-service.ts
- website-content/route.ts
- doctor-queries.ts
- prisma.ts
- lucide-react
- clinic-queries.ts
- seed-website-content.ts
- app/layout.tsx
- website-content-management.tsx
- appointment-service.ts
- seed.ts
- services/[id]/route.ts
- client.ts
- usePublicLanguage
- dashboard-overview.tsx
- email.test.ts
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
- appointment-details-dialog.tsx
- results.test.ts
- dotenv
- DMS implementation report
- PrismaClient
- website-layout.ts
- rate-limit.ts
- password-recovery.test.ts
- Database
- DMS feature audit
- new-order-dialog.tsx
- appointments.test.ts
- security/password/route.ts
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
- (dashboard)/layout.tsx
- allowBuilds
- price-list/page.tsx
- security-view.tsx
- Prisma__UserClient
- sw.js
- Prisma__AccountClient
- Prisma__SessionClient
- Prisma__AppointmentClient
- Prisma__VerificationClient
- client.ts
- PrismaClientBaseOptions
- AGENTS.md
- CLAUDE.md
- dotenv
- email-schema.ts
- eslint.config.mjs

## God Nodes (most connected - your core abstractions)
1. `authorize()` - 152 edges
2. `next` - 132 edges
3. `prisma` - 101 edges
4. `apiError()` - 95 edges
5. `call()` - 81 edges
6. `writeAuditEvent()` - 80 edges
7. `react` - 74 edges
8. `lucide-react` - 65 edges
9. `requestJson()` - 55 edges
10. `parseBody()` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Relationships and deletion rules` --references--> `ClinicService`  [INFERRED]
  DATABASE.md → src/app/public_website/components/types.ts
- `5. Laboratory` --references--> `ResultFlag`  [INFERRED]
  docs/DMS-FEATURE-AUDIT.md → src/modules/orders/services/result-rules.ts
- `7. Components` --references--> `Modal()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/shared/modal.tsx
- `Components standardized` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx
- `Problems identified (all from the shared layer)` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx

## Import Cycles
- None detected.

## Communities (117 total, 14 thin omitted)

### Community 0 - "prismaNamespace.ts"
Cohesion: 0.02
Nodes (116): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, Args, At, AtLeast, AtLoose, AtStrict (+108 more)

### Community 1 - "email-config-service.ts"
Cohesion: 0.20
Nodes (18): AuditClient, maskEmail(), writeEmailAudit(), EmailSettingsError, loadMailConfig(), readRow(), recordTest(), sendSystemEmail() (+10 more)

### Community 2 - "clinic-date.ts"
Cohesion: 0.08
Nodes (39): GET(), itemSelect, GET(), GET(), POST(), GET(), getClinicDateKey(), dateOnly (+31 more)

### Community 3 - "User.ts"
Cohesion: 0.02
Nodes (85): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableStringFieldUpdateOperationsInput, StringFieldUpdateOperationsInput, User$accountsArgs (+77 more)

### Community 4 - "patient-schema.ts"
Cohesion: 0.11
Nodes (29): GET(), DELETE(), GET(), PATCH(), patientStatusSchema, GET(), buildPatientWhere(), getPatientById() (+21 more)

### Community 5 - "Account.ts"
Cohesion: 0.03
Nodes (74): AccountAggregateArgs, AccountCountAggregateInputType, AccountCountAggregateOutputType, AccountCountArgs, AccountCountOrderByAggregateInput, AccountCreateArgs, AccountCreateInput, AccountCreateManyAndReturnArgs (+66 more)

### Community 6 - "Session.ts"
Cohesion: 0.03
Nodes (73): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs, SessionCountOrderByAggregateInput (+65 more)

### Community 7 - "orders-section.tsx"
Cohesion: 0.05
Nodes (63): lucide-react, metadata, metadata, CLINIC_TIME_ZONE, formatClinicDate(), formatClinicDateTime(), formatClinicTime(), getClinicMonthKey() (+55 more)

### Community 8 - "DashboardSectionPage"
Cohesion: 0.09
Nodes (38): AccessPage(), instant, AppointmentsPage(), instant, BillingPage(), instant, DoctorsPage(), instant (+30 more)

### Community 9 - "authorize"
Cohesion: 0.13
Nodes (45): DELETE(), GET(), GET(), PUT(), POST(), POST(), POST(), POST() (+37 more)

### Community 10 - "Appointment.ts"
Cohesion: 0.04
Nodes (53): AggregateAppointment, AppointmentAggregateArgs, AppointmentCountAggregateInputType, AppointmentCountAggregateOutputType, AppointmentCountArgs, AppointmentCountOrderByAggregateInput, AppointmentCreateArgs, AppointmentCreateInput (+45 more)

### Community 11 - "purchases-tab.tsx"
Cohesion: 0.09
Nodes (43): @tanstack/react-query, QueryMeta, formatDay(), Metric(), ExportButtons(), Filters, HistoryTab(), typeLabel (+35 more)

### Community 12 - "Verification.ts"
Cohesion: 0.04
Nodes (52): AggregateVerification, GetVerificationAggregateType, GetVerificationGroupByPayload, VerificationAggregateArgs, VerificationCountAggregateInputType, VerificationCountAggregateOutputType, VerificationCountArgs, VerificationCountOrderByAggregateInput (+44 more)

### Community 13 - "requestJson"
Cohesion: 0.11
Nodes (29): blankToNull(), CatalogKind, emptyParameter(), emptyRange, emptyService, InvoiceRecord, numberOrNull(), ParameterForm (+21 more)

### Community 14 - "Modal"
Cohesion: 0.07
Nodes (42): @hookform/resolvers, react-hook-form, byOrder(), GalleryImage, GalleryManagement(), deleteImage(), move(), send() (+34 more)

### Community 15 - "react"
Cohesion: 0.08
Nodes (35): react, AdminSessionContext, AdminSessionValue, useAdminSession(), useConfirm(), useLiveRefresh(), can(), AccessSection() (+27 more)

### Community 16 - "order-service.ts"
Cohesion: 0.08
Nodes (33): 4. Test orders, GET(), CreateOrderInput, canCancelOrder(), canChangeSamples(), CatalogKind, CatalogMember, CatalogRow (+25 more)

### Community 17 - "website-layout.ts"
Cohesion: 0.11
Nodes (22): BilingualInput(), CardListEditor(), ChipListEditor(), Errors, ICON_LABELS, NAV_TITLES, Path, prune() (+14 more)

### Community 18 - "doctors/[id]/route.ts"
Cohesion: 0.08
Nodes (44): contentSecurityPolicy, nextConfig, next, GET(), profileSchema, PUT(), Context, GET() (+36 more)

### Community 19 - "sms-service.ts"
Cohesion: 0.07
Nodes (63): GET(), PUT(), POST(), POST(), hitRateLimit(), SmsSettings, saveSettings(), decryptSecret() (+55 more)

### Community 20 - "admin-session.ts"
Cohesion: 0.13
Nodes (18): DELETE(), GET(), instant, LoginPage(), Failure, getStaffSession(), ADMIN_ONLY_PERMISSIONS, ALL_PERMISSIONS (+10 more)

### Community 21 - "requestJson"
Cohesion: 0.09
Nodes (34): formatStatus(), statusModifier(), emptyInvoiceForm(), emptyInvoiceItem(), invoiceFormSchema, InvoiceFormValues, invoiceInputSchema, isMoney() (+26 more)

### Community 22 - "doctors-section.tsx"
Cohesion: 0.07
Nodes (44): EmptyState(), initials(), AppointmentTable(), statusClass(), statusNames, days, DoctorAvatar(), dateTime (+36 more)

### Community 23 - "seed-demo.ts"
Cohesion: 0.13
Nodes (14): allergyList, areas, DEMO_PRICES, femaleNames, histories, seedBookings(), maleNames, OrderSpec (+6 more)

### Community 24 - "clinic-website.tsx"
Cohesion: 0.36
Nodes (16): HeroServiceSlider(), localize(), categoryName(), DetailsModal(), feeLabel(), IconName, iconName(), numberFormat() (+8 more)

### Community 25 - "package.json"
Cohesion: 0.10
Nodes (28): devDependencies, tailwindcss@4.3.4, @tailwindcss/turbopack@4.3.4, tsx@^4.23.15, @types/jsbarcode@^3.11.4, @types/node@^20, @types/nodemailer@^8.0.2, @types/pg@^8.23.1 (+20 more)

### Community 26 - "report-rules.ts"
Cohesion: 0.11
Nodes (24): instant, metadata, OrderReportPage(), ReportView(), View, instant, metadata, ReportPage() (+16 more)

### Community 27 - "helpers.ts"
Cohesion: 0.14
Nodes (20): vitest, addUser(), run, get(), run, CallOptions, createSession(), createUser() (+12 more)

### Community 28 - "auth.test.ts"
Cohesion: 0.19
Nodes (24): POST(), POST(), GET(), POST(), PUT(), PATCH(), POST(), createOrderSchema (+16 more)

### Community 29 - "result-service.ts"
Cohesion: 0.09
Nodes (43): GET(), Draft, draftFrom(), FlagChip(), OrderResultsPanel(), acknowledge(), previewFlag(), deriveOrderStatus() (+35 more)

### Community 30 - "addClinicDays"
Cohesion: 0.16
Nodes (17): GET(), querySchema, GET(), querySchema, dhakaMidnightUtc(), GET(), dateOnly(), expenseSelect (+9 more)

### Community 31 - "users-tab.tsx"
Cohesion: 0.13
Nodes (19): ColumnMeta, cx(), DataTable(), DataTableColumn, dataTableColumns(), dataTableFeatures, Features, column (+11 more)

### Community 32 - "recovery-service.ts"
Cohesion: 0.21
Nodes (18): POST(), schema, createResetToken(), generateOtp(), hashOtp(), hashResetToken(), hmacKey(), normalizeEmail() (+10 more)

### Community 33 - "admin-dashboard.tsx"
Cohesion: 0.11
Nodes (27): AppointmentResponse, AppointmentValidationError, createAppointmentRequest(), deleteAppointmentRequest(), readResponse(), updateAppointmentRequest(), updateAppointmentStatusRequest(), AppointmentFieldErrors (+19 more)

### Community 34 - "call"
Cohesion: 0.06
Nodes (34): refundPayment(), edit(), editRole(), issue(), refund(), page(), create(), list() (+26 more)

### Community 35 - "export-service.ts"
Cohesion: 0.08
Nodes (22): GET(), querySchema, Permission, ExpenseInput, expenseInputSchema, expenseListQuerySchema, expenseVoidSchema, EXPORT_DATASETS (+14 more)

### Community 36 - "commonInputTypes.ts"
Cohesion: 0.07
Nodes (27): BoolFilter, BoolWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, EnumAppointmentStatusFilter, EnumAppointmentStatusWithAggregatesFilter (+19 more)

### Community 37 - "clinic-website.tsx"
Cohesion: 0.17
Nodes (19): Chrome(), ClinicHours(), ClinicWebsiteContent(), formatTime(), phoneLinks(), SectionHead(), Tick(), weekdayNames (+11 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, better-auth@^1.7.15, @better-auth/prisma-adapter@^1.7.15, date-fns@4.4.0, @date-fns/tz@1.5.0, @hookform/resolvers@7.0.3, jsbarcode@3.12.1, lucide-react@^1.66.0 (+21 more)

### Community 39 - "app/api/appointments/route.ts"
Cohesion: 0.24
Nodes (9): bookingsPageQuery, dayKey, GET(), BOOKINGS_PAGE_SIZE, BookingsFilters, bookingsWhere(), listAppointments(), listAppointmentsPage() (+1 more)

### Community 40 - "report-service.ts"
Cohesion: 0.07
Nodes (44): GET(), POST(), POST(), instant, metadata, VerifyReportPage(), POST(), refundRateLimit() (+36 more)

### Community 41 - "website-content/route.ts"
Cohesion: 0.15
Nodes (21): GET(), PUT(), buildEmbedUrl(), extractMapUrl(), isAllowedHost(), MapLinkError, MapLocation, parseMapLocation() (+13 more)

### Community 42 - "doctor-queries.ts"
Cohesion: 0.10
Nodes (32): AboutView(), AboutPage(), instant, metadata, DoctorsShell(), DoctorsSkeleton(), DoctorList(), DoctorsPage() (+24 more)

### Community 43 - "prisma.ts"
Cohesion: 0.12
Nodes (32): zod, paymentSchema, POST(), POST(), voidSchema, POST(), refundSchema, GET() (+24 more)

### Community 44 - "lucide-react"
Cohesion: 0.16
Nodes (11): EmailSettings, ACTION_LABELS, EmailSettings(), post(), submit(), Form, GMAIL, HistoryRow (+3 more)

### Community 45 - "clinic-queries.ts"
Cohesion: 0.22
Nodes (13): HomePage(), instant, metadata, GET(), GET(), ClinicWebsite(), instant, metadata (+5 more)

### Community 46 - "seed-website-content.ts"
Cohesion: 0.20
Nodes (11): seedCatalog(), main(), seedLabCatalog(), BLOOD_STEPS, CONTENT, force, isBlank(), main() (+3 more)

### Community 47 - "app/layout.tsx"
Cohesion: 0.13
Nodes (17): sonner@2.0.8, sonner, geistMono, geistSans, hindSiliguri, metadata, publicSans, RootLayout() (+9 more)

### Community 48 - "website-content-management.tsx"
Cohesion: 0.16
Nodes (21): CATEGORIES, categoryOf(), DEFAULTS, Draft, Errors, FieldKey, ImagePreview(), SECTION_CATEGORY (+13 more)

### Community 49 - "appointment-service.ts"
Cohesion: 0.11
Nodes (31): DELETE(), PATCH(), POST(), POST(), runAfterResponse(), enforcePublicRateLimit(), publicRateLimits, firstFieldError() (+23 more)

### Community 50 - "seed.ts"
Cohesion: 0.31
Nodes (5): main(), seedAdmin(), main(), Keypress, promptHidden()

### Community 51 - "services/[id]/route.ts"
Cohesion: 0.08
Nodes (39): CatalogError, GET(), PATCH(), updateSchema, CatalogError, GET(), POST(), serviceSchema (+31 more)

### Community 52 - "client.ts"
Cohesion: 0.18
Nodes (6): config, decodeBase64AsWasm(), LogOptions, PrismaClientConstructor, @prisma/client@^7.10.1, @prisma/client

### Community 53 - "usePublicLanguage"
Cohesion: 0.24
Nodes (16): DoctorCard(), DoctorDirectory(), Pagination(), DoctorPhoto(), DoctorProfileView(), Section(), PublicClinicIdentity, formatFee() (+8 more)

### Community 54 - "dashboard-overview.tsx"
Cohesion: 0.22
Nodes (10): recharts@^3.10.1, recharts, AppointmentsBarChart, AppointmentsChart(), KpiCard(), Overview(), overviewColors, OverviewEmpty() (+2 more)

### Community 55 - "email.test.ts"
Cohesion: 0.27
Nodes (13): emailTestEmail(), escapeHtml(), layout(), paragraph(), passwordChangedEmail(), passwordChangeOtpEmail(), passwordResetOtpEmail(), reportReadyEmail() (+5 more)

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
Cohesion: 0.12
Nodes (20): instant, metadata, Page(), instant, metadata, Page(), instant, metadata (+12 more)

### Community 65 - "reviews.test.ts"
Cohesion: 0.24
Nodes (13): GET(), POST(), getPublishedReviews(), namesOverlap(), phoneMatchKeys(), REVIEW_LIMITS, ReviewSubmission, reviewSubmissionSchema (+5 more)

### Community 66 - "access-schema.ts"
Cohesion: 0.11
Nodes (32): submitReview(), compactPhone(), CONTACT_LIMITS, validateEmail(), validatePersonName(), validatePhone(), isPermission(), passwordResetSchema (+24 more)

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
Cohesion: 0.07
Nodes (51): POST(), uploadSchema, csvCell(), csvLine(), parseCsv(), autoMap(), downloadTemplate(), ImportDialog() (+43 more)

### Community 71 - "qr-login-plugin.ts"
Cohesion: 0.25
Nodes (15): isStaffAccount(), activeStatuses, approve, cancel, complete, create, expireIfNeeded(), findValidSession() (+7 more)

### Community 72 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, admin:reset-password, build, db:generate, db:migrate, db:seed, db:seed:demo, db:seed:lab (+8 more)

### Community 73 - "appointment-management.tsx"
Cohesion: 0.19
Nodes (14): formatClinicWeekday(), bookingKeys, BookingsFilters, BookingsPage, TABLES, useBookingsPage(), AppointmentManagement(), CalendarMode (+6 more)

### Community 74 - "appointment-details-dialog.tsx"
Cohesion: 0.43
Nodes (5): AppointmentDetailsDialog(), AdminUser, Appointment, DashboardSummary, formatRequestId()

### Community 75 - "results.test.ts"
Cohesion: 0.16
Nodes (12): born(), code(), enter(), ids, makePatient(), makeTest(), RangeSeed, readyOrder() (+4 more)

### Community 76 - "dotenv"
Cohesion: 0.25
Nodes (3): pg@^8.23.1, pg, match

### Community 77 - "DMS implementation report"
Cohesion: 0.14
Nodes (11): DMS implementation report, Migrations, Modified files, Not done, and why, Verification, What was implemented, DMS recommendations, P0: needed to run safely (+3 more)

### Community 79 - "website-layout.ts"
Cohesion: 0.13
Nodes (16): bilingual(), card, contactEmail, facebookUrl, fillBoth(), mapUrl, mergeBilingual(), NAV_ANCHORS (+8 more)

### Community 80 - "rate-limit.ts"
Cohesion: 0.23
Nodes (10): POST(), schema, POST(), schema, clientIp(), Limit, completePasswordReset(), enforce() (+2 more)

### Community 81 - "password-recovery.test.ts"
Cohesion: 0.23
Nodes (9): GET(), isEmailEnabled(), lastCode(), mail, newStaff(), request(), sent, verified() (+1 more)

### Community 82 - "Database"
Cohesion: 0.19
Nodes (13): Users and roles (administrator only), Roles and permissions, Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`, Database, Deliberately not modelled, Indexes, Migrations, Relationships and deletion rules (+5 more)

### Community 83 - "DMS feature audit"
Cohesion: 0.15
Nodes (13): 10. Staff and access control, 11. Dashboard and reports, 12. Communication, 13. System settings, 1. Patient management, 2. Doctor management, 3. Test and service catalog, 5. Laboratory (+5 more)

### Community 84 - "new-order-dialog.tsx"
Cohesion: 0.36
Nodes (8): Website content, label(), PatientSelect(), choose(), close(), onKeyDown(), openList(), PatientSelectChoice

### Community 85 - "appointments.test.ts"
Cohesion: 0.22
Nodes (10): patientListParamsSchema, POST(), createPatient(), DuplicatePatientError, book(), booking(), create(), setStatus() (+2 more)

### Community 86 - "security/password/route.ts"
Cohesion: 0.27
Nodes (10): clientIp(), POST(), clientIp(), POST(), schema, changePasswordWithCode(), enforce(), maskEmail() (+2 more)

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

### Community 94 - "booking-form.tsx"
Cohesion: 0.24
Nodes (13): BookingForm(), submitAppointment(), dhakaDateKey(), formatDate(), formatTime(), getDhakaParts(), getWhatsAppNumber(), toMinutes() (+5 more)

### Community 95 - "auth.ts"
Cohesion: 0.29
Nodes (6): better-auth, GET, handlers, auth, trustedOrigins, qrLoginPlugin

### Community 96 - "UI/UX fix report: dialogs, forms and layouts"
Cohesion: 0.22
Nodes (8): Components standardized, Modified files, Problems fixed, Problems identified (all from the shared layer), Remaining issues, Responsive behaviour, UI/UX fix report: dialogs, forms and layouts, Verified in the browser

### Community 97 - "enums.ts"
Cohesion: 0.22
Nodes (7): Account, Appointment, $Enums, Session, User, Verification, AppointmentStatus

### Community 98 - "Demo data (`pnpm db:seed:demo`)"
Cohesion: 0.22
Nodes (8): Demo data (`pnpm db:seed:demo`), Demo logins (development only), Public website wording (`pnpm db:seed:website`), Repeatable and safe, Resetting, Seed data, Starter test catalog (`pnpm db:seed:lab`), What is created

### Community 99 - "(dashboard)/layout.tsx"
Cohesion: 0.17
Nodes (12): DashboardLayout(), instant, metadata, AdminIdentity, AdminSessionProvider(), QueryProvider(), RealtimeQuerySync(), authClient (+4 more)

### Community 100 - "allowBuilds"
Cohesion: 0.29
Nodes (6): allowBuilds, esbuild, prisma, @prisma/engines, sharp, unrs-resolver

### Community 101 - "price-list/page.tsx"
Cohesion: 0.43
Nodes (5): instant, metadata, PriceListPage(), reportTime(), PrintButton()

### Community 102 - "security-view.tsx"
Cohesion: 0.80
Nodes (5): post(), SecurityView(), checkFields(), sendCode(), updatePassword()

### Community 104 - "sw.js"
Cohesion: 0.33
Nodes (3): IS_LOCAL, PUBLIC_PAGES, SHELL_URLS

### Community 109 - "client.ts"
Cohesion: 0.22
Nodes (7): Account, Appointment, $Enums, PrismaClient, Session, User, Verification

### Community 110 - "PrismaClientBaseOptions"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

### Community 114 - "dotenv"
Cohesion: 0.29
Nodes (4): dotenv@^18.0.9, prisma@7.10.1, dotenv, prisma

### Community 115 - "email-schema.ts"
Cohesion: 0.33
Nodes (6): email, EmailSettingsInput, emailSettingsSchema, isPrivateHost(), PROVIDERS, testSendSchema

### Community 116 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.4, eslint, eslint-config-next

## Knowledge Gaps
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `client.ts` to `prismaNamespace.ts`, `User.ts`, `commonInputTypes.ts`, `prismaNamespaceBrowser.ts`, `Account.ts`, `Session.ts`, `Appointment.ts`, `Verification.ts`, `client.ts`, `package.json`?**
  _High betweenness centrality (0.343) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `authorize()` (e.g. with `10. Staff and access control` and `Verification`) actually correct?**
  _`authorize()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `prismaNamespace.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.017094017094017096 - nodes in this community are weakly interconnected._
- **Why does `next` connect `doctors/[id]/route.ts` to `clinic-date.ts`, `patient-schema.ts`, `orders-section.tsx`, `DashboardSectionPage`, `authorize`, `Modal`, `order-service.ts`, `sms-service.ts`, `admin-session.ts`, `doctors-section.tsx`, `clinic-website.tsx`, `package.json`, `report-rules.ts`, `auth.test.ts`, `result-service.ts`, `addClinicDays`, `recovery-service.ts`, `admin-dashboard.tsx`, `clinic-website.tsx`, `dependencies`, `app/api/appointments/route.ts`, `report-service.ts`, `website-content/route.ts`, `doctor-queries.ts`, `prisma.ts`, `clinic-queries.ts`, `app/layout.tsx`, `website-content-management.tsx`, `appointment-service.ts`, `services/[id]/route.ts`, `usePublicLanguage`, `dashboard-overview.tsx`, `Design system and platform checklist`, `brand.ts`, `reviews.test.ts`, `logger.ts`, `appointment-insights.tsx`, `import-service.ts`, `rate-limit.ts`, `password-recovery.test.ts`, `appointments.test.ts`, `security/password/route.ts`, `forgot-password-form.tsx`, `auth.ts`, `(dashboard)/layout.tsx`, `price-list/page.tsx`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Should `clinic-date.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07542087542087542 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `orders-section.tsx` to `purchases-tab.tsx`, `requestJson`, `Modal`, `react`, `website-layout.ts`, `sms-service.ts`, `admin-session.ts`, `requestJson`, `doctors-section.tsx`, `clinic-website.tsx`, `package.json`, `report-rules.ts`, `result-service.ts`, `users-tab.tsx`, `admin-dashboard.tsx`, `clinic-website.tsx`, `dependencies`, `report-service.ts`, `lucide-react`, `website-content-management.tsx`, `usePublicLanguage`, `dashboard-overview.tsx`, `access-schema.ts`, `appointment-insights.tsx`, `import-service.ts`, `appointment-management.tsx`, `appointment-details-dialog.tsx`, `forgot-password-form.tsx`, `review-management.tsx`, `booking-form.tsx`, `(dashboard)/layout.tsx`, `price-list/page.tsx`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Should `User.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._