# Graph Report - asdc_diagnostic  (2026-11-08)

## Corpus Check
- 430 files · ~258,736 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .example 1, (none) 1, .toml 1)

## Summary
- 3159 nodes · 8142 edges · 140 communities (124 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7bf91df0`
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
- apiError
- Appointment.ts
- Modal
- Verification.ts
- requestJson
- lucide-react
- email-config-service.ts
- order-service.ts
- website-layout.ts
- doctors/[id]/route.ts
- sms-service.ts
- password-change.test.ts
- requestJson
- doctors-section.tsx
- seed-demo.ts
- email-settings.tsx
- package.json
- report-rules.ts
- helpers.ts
- auth.test.ts
- result-service.ts
- prisma.ts
- users-tab.tsx
- recovery-service.ts
- admin-dashboard.tsx
- results.test.ts
- export-service.ts
- commonInputTypes.ts
- react
- dependencies
- react
- report-service.ts
- voice-service.ts
- doctor-queries.ts
- prisma.ts
- rate-limit.ts
- next
- seed-website-content.ts
- app/layout.tsx
- website-content-management.tsx
- appointment-service.ts
- auth.ts
- prisma.ts
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
- localize
- logger.ts
- appointment-insights.tsx
- prismaNamespaceBrowser.ts
- import-service.ts
- qr-login-plugin.ts
- scripts
- appointment-management.tsx
- patient-rules.ts
- app/api/appointments/route.ts
- dotenv
- DMS implementation report
- PrismaClient
- website-layout.ts
- gallery-management.tsx
- password-recovery.test.ts
- call
- sms.test.ts
- 01 — Live Admin Dashboard Review
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
- password-change-service.ts
- appointment-actions.ts
- enums.ts
- Demo data (`pnpm db:seed:demo`)
- patient-schema.ts
- allowBuilds
- price-list/page.tsx
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
- secret-box.ts
- patient-form-modal.tsx
- map-link.test.ts
- appointment-schema.ts
- ASH_SHIFA_DMS_Client_User_Manual_BN.md
- appointments.test.ts
- booking-form.tsx
- readPatientResponse
- UI/UX fix report: dialogs, forms and layouts
- ভূমিকা অনুযায়ী দৈনিক কাজ
- expense-schema.ts
- voice-settings.tsx
- website-content-schema.ts
- ওয়েবসাইট, রিভিউ ও প্রশাসন
- বুকিং (Appointment)
- csv.ts
- বিলিং
- খরচ ও দিনের হিসাব বন্ধ
- নমুনা সংগ্রহ ও ল্যাবে গ্রহণ
- ফলাফল এন্ট্রি, যাচাই ও রিপোর্ট
- Dashboard চেনা
- লগইন ও লগআউট
- এই নির্দেশিকা সম্পর্কে
- রোগী নিবন্ধন ও খোঁজা
- app/not-found.tsx

## God Nodes (most connected - your core abstractions)
1. `authorize()` - 160 edges
2. `next` - 136 edges
3. `prisma` - 103 edges
4. `apiError()` - 102 edges
5. `writeAuditEvent()` - 82 edges
6. `call()` - 82 edges
7. `react` - 75 edges
8. `lucide-react` - 67 edges
9. `parseBody()` - 58 edges
10. `requestJson()` - 56 edges

## Surprising Connections (you probably didn't know these)
- `7. Components` --references--> `Modal()`  [INFERRED]
  DESIGN_SYSTEM.md → src/components/shared/modal.tsx
- `Components standardized` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx
- `Problems identified (all from the shared layer)` --references--> `Modal()`  [INFERRED]
  docs/UI-UX-FIX-REPORT.md → src/components/shared/modal.tsx
- `10. Staff and access control` --references--> `authorize()`  [INFERRED]
  docs/DMS-FEATURE-AUDIT.md → src/lib/admin-session.ts
- `Verification` --references--> `authorize()`  [INFERRED]
  docs/DMS-IMPLEMENTATION-REPORT.md → src/lib/admin-session.ts

## Import Cycles
- None detected.

## Communities (140 total, 16 thin omitted)

### Community 0 - "prismaNamespace.ts"
Cohesion: 0.02
Nodes (116): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, Args, At, AtLeast, AtLoose, AtStrict (+108 more)

### Community 1 - "email-config-service.ts"
Cohesion: 0.23
Nodes (12): GET(), PUT(), getPublicSettings(), readRow(), saveSettings(), email, EmailSettingsInput, emailSettingsSchema (+4 more)

### Community 2 - "clinic-date.ts"
Cohesion: 0.07
Nodes (38): GET(), itemSelect, POST(), POST(), GET(), POST(), dateOnly, EXPIRY_WARNING_DAYS (+30 more)

### Community 3 - "User.ts"
Cohesion: 0.02
Nodes (85): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, NullableStringFieldUpdateOperationsInput, StringFieldUpdateOperationsInput, User$accountsArgs (+77 more)

### Community 4 - "patient-schema.ts"
Cohesion: 0.11
Nodes (29): GET(), DELETE(), GET(), PATCH(), patientStatusSchema, GET(), patientListParamsSchema, POST() (+21 more)

### Community 5 - "Account.ts"
Cohesion: 0.03
Nodes (74): AccountAggregateArgs, AccountCountAggregateInputType, AccountCountAggregateOutputType, AccountCountArgs, AccountCountOrderByAggregateInput, AccountCreateArgs, AccountCreateInput, AccountCreateManyAndReturnArgs (+66 more)

### Community 6 - "Session.ts"
Cohesion: 0.03
Nodes (73): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs, SessionCountOrderByAggregateInput (+65 more)

### Community 7 - "orders-section.tsx"
Cohesion: 0.06
Nodes (59): instant, metadata, VerifyReportPage(), CLINIC_TIME_ZONE, formatClinicDate(), formatClinicDateTime(), formatClinicTime(), getClinicMonthKey() (+51 more)

### Community 8 - "DashboardSectionPage"
Cohesion: 0.05
Nodes (61): 02 — Complete Application Feature Audit, 1. Pages and routes, 2. Roles and permissions, 3.10 Reports, 3.11 Inventory, 3.12 Website, reviews and gallery, 3.13 Administration, 3.1 Sign-in and account (+53 more)

### Community 9 - "apiError"
Cohesion: 0.10
Nodes (48): POST(), POST(), PATCH(), POST(), PATCH(), POST(), schema, DELETE() (+40 more)

### Community 10 - "Appointment.ts"
Cohesion: 0.04
Nodes (53): AggregateAppointment, AppointmentAggregateArgs, AppointmentCountAggregateInputType, AppointmentCountAggregateOutputType, AppointmentCountArgs, AppointmentCountOrderByAggregateInput, AppointmentCreateArgs, AppointmentCreateInput (+45 more)

### Community 11 - "Modal"
Cohesion: 0.08
Nodes (42): GalleryImage, ImageFields, ConfirmOptions, focusableSelector, focusableWithin(), Modal(), handleKeyDown(), formatDay() (+34 more)

### Community 12 - "Verification.ts"
Cohesion: 0.04
Nodes (52): AggregateVerification, GetVerificationAggregateType, GetVerificationGroupByPayload, VerificationAggregateArgs, VerificationCountAggregateInputType, VerificationCountAggregateOutputType, VerificationCountArgs, VerificationCountOrderByAggregateInput (+44 more)

### Community 13 - "requestJson"
Cohesion: 0.12
Nodes (28): blankToNull(), CatalogKind, emptyParameter(), emptyRange, emptyService, InvoiceRecord, numberOrNull(), ParameterForm (+20 more)

### Community 14 - "lucide-react"
Cohesion: 0.10
Nodes (18): lucide-react, metadata, EmptyState(), Button(), ButtonProps, AppointmentTable(), statusClass(), statusNames (+10 more)

### Community 15 - "email-config-service.ts"
Cohesion: 0.20
Nodes (18): AuditClient, maskEmail(), writeEmailAudit(), EmailSettingsError, loadMailConfig(), recordTest(), sendSystemEmail(), sendTestEmail() (+10 more)

### Community 16 - "order-service.ts"
Cohesion: 0.08
Nodes (32): 4. Test orders, GET(), canCancelOrder(), canChangeSamples(), CatalogKind, CatalogMember, CatalogRow, groupBySample() (+24 more)

### Community 17 - "website-layout.ts"
Cohesion: 0.11
Nodes (22): BilingualInput(), CardListEditor(), ChipListEditor(), Errors, ICON_LABELS, NAV_TITLES, NewsItem, NewsListEditor() (+14 more)

### Community 18 - "doctors/[id]/route.ts"
Cohesion: 0.15
Nodes (23): GET(), profileSchema, PUT(), Context, DELETE(), GET(), Outcome, PATCH() (+15 more)

### Community 19 - "sms-service.ts"
Cohesion: 0.24
Nodes (19): POST(), POST(), hitRateLimit(), maskPhone(), normalizeBdMobile(), phoneHash(), clinicName(), getPublicSmsSettings() (+11 more)

### Community 20 - "password-change.test.ts"
Cohesion: 0.28
Nodes (6): TEST_PASSWORD, change(), freshIp(), mail, requestCode(), sent

### Community 21 - "requestJson"
Cohesion: 0.09
Nodes (41): bdtCurrency, formatStatus(), statusModifier(), emptyInvoiceForm(), emptyInvoiceItem(), BillingSection(), createInvoice(), recordPayment() (+33 more)

### Community 22 - "doctors-section.tsx"
Cohesion: 0.06
Nodes (51): useConfirm(), useLiveRefresh(), initials(), ClinicOperations(), days, PrintableInvoice, ClinicSection, liveTables (+43 more)

### Community 23 - "seed-demo.ts"
Cohesion: 0.13
Nodes (14): allergyList, areas, DEMO_PRICES, femaleNames, histories, seedBookings(), maleNames, OrderSpec (+6 more)

### Community 24 - "email-settings.tsx"
Cohesion: 0.18
Nodes (10): ACTION_LABELS, EmailSettings(), post(), submit(), Form, GMAIL, HistoryRow, Settings (+2 more)

### Community 25 - "package.json"
Cohesion: 0.08
Nodes (33): eslintConfig, devDependencies, eslint@^9, eslint-config-next@16.4.4, tailwindcss@4.3.4, @tailwindcss/turbopack@4.3.4, tsx@^4.23.15, @types/jsbarcode@^3.11.4 (+25 more)

### Community 26 - "report-rules.ts"
Cohesion: 0.14
Nodes (17): instant, metadata, OrderReportPage(), ReportView(), View, instant, metadata, ReportPage() (+9 more)

### Community 27 - "helpers.ts"
Cohesion: 0.12
Nodes (23): vitest, addUser(), run, CallOptions, createSession(), createUser(), patientInput(), patientNumber (+15 more)

### Community 28 - "auth.test.ts"
Cohesion: 0.18
Nodes (24): POST(), POST(), GET(), POST(), PUT(), PATCH(), POST(), CreateOrderInput (+16 more)

### Community 29 - "result-service.ts"
Cohesion: 0.09
Nodes (44): 5. Laboratory, Draft, draftFrom(), FlagChip(), OrderResultsPanel(), acknowledge(), previewFlag(), deriveOrderStatus() (+36 more)

### Community 30 - "prisma.ts"
Cohesion: 0.11
Nodes (36): zod, GET(), querySchema, GET(), querySchema, dhakaMidnightUtc(), GET(), GET() (+28 more)

### Community 31 - "users-tab.tsx"
Cohesion: 0.13
Nodes (19): ColumnMeta, cx(), DataTable(), DataTableColumn, dataTableColumns(), dataTableFeatures, Features, column (+11 more)

### Community 32 - "recovery-service.ts"
Cohesion: 0.24
Nodes (15): createResetToken(), generateOtp(), hashOtp(), hashResetToken(), hmacKey(), normalizeEmail(), OTP_LENGTH, OTP_MAX_ATTEMPTS (+7 more)

### Community 33 - "admin-dashboard.tsx"
Cohesion: 0.12
Nodes (20): updateAppointmentStatusRequest(), AccessSection, AdminDashboard(), changeStatus(), AppointmentManagement, AppointmentStatus, ClinicOperations, EmailSettings (+12 more)

### Community 34 - "results.test.ts"
Cohesion: 0.16
Nodes (12): born(), code(), enter(), ids, makePatient(), makeTest(), RangeSeed, readyOrder() (+4 more)

### Community 35 - "export-service.ts"
Cohesion: 0.11
Nodes (18): GET(), querySchema, EXPORT_DATASETS, EXPORT_PERMISSIONS, ExportDataset, isExportDataset(), escapeHtml(), renderPrintable() (+10 more)

### Community 36 - "commonInputTypes.ts"
Cohesion: 0.07
Nodes (27): BoolFilter, BoolWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, EnumAppointmentStatusFilter, EnumAppointmentStatusWithAggregatesFilter (+19 more)

### Community 37 - "react"
Cohesion: 0.13
Nodes (27): Chrome(), Announcement, AnnouncementTicker(), ClinicHours(), ClinicWebsiteContent(), formatTime(), phoneLinks(), SectionHead() (+19 more)

### Community 38 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @better-auth/prisma-adapter@^1.7.15, date-fns@4.4.0, @date-fns/tz@1.5.0, jsbarcode@3.12.1, lucide-react@^1.66.0, next@16.4.4, nodemailer@^10.3.1 (+19 more)

### Community 39 - "react"
Cohesion: 0.10
Nodes (22): react, AdminIdentity, AdminSessionContext, AdminSessionValue, useAdminSession(), can(), AccessSection(), Draft (+14 more)

### Community 40 - "report-service.ts"
Cohesion: 0.07
Nodes (51): GET(), POST(), POST(), instant, metadata, VerifyLandingPage(), POST(), refundRateLimit() (+43 more)

### Community 41 - "voice-service.ts"
Cohesion: 0.16
Nodes (23): POST(), Answer, call(), checkVoiceSetup(), describeVoiceStatus(), failure(), networkFailure(), sendBroadcast() (+15 more)

### Community 42 - "doctor-queries.ts"
Cohesion: 0.09
Nodes (35): AboutView(), AboutPage(), instant, metadata, DoctorsShell(), DoctorsSkeleton(), DoctorList(), DoctorsPage() (+27 more)

### Community 43 - "prisma.ts"
Cohesion: 0.21
Nodes (18): paymentSchema, POST(), POST(), refundSchema, GET(), POST(), computeInvoiceTotals(), formatCents() (+10 more)

### Community 44 - "rate-limit.ts"
Cohesion: 0.23
Nodes (10): POST(), schema, POST(), schema, clientIp(), Limit, completePasswordReset(), enforce() (+2 more)

### Community 45 - "next"
Cohesion: 0.08
Nodes (30): contentSecurityPolicy, nextConfig, next, DELETE(), PATCH(), POST(), voidSchema, GET() (+22 more)

### Community 46 - "seed-website-content.ts"
Cohesion: 0.20
Nodes (11): seedCatalog(), main(), seedLabCatalog(), BLOOD_STEPS, CONTENT, force, isBlank(), main() (+3 more)

### Community 47 - "app/layout.tsx"
Cohesion: 0.15
Nodes (15): geistMono, geistSans, hindSiliguri, metadata, publicSans, RootLayout(), viewport, AppToaster() (+7 more)

### Community 48 - "website-content-management.tsx"
Cohesion: 0.17
Nodes (20): CATEGORIES, categoryOf(), DEFAULTS, Draft, Errors, FieldKey, ImagePreview(), SECTION_CATEGORY (+12 more)

### Community 49 - "appointment-service.ts"
Cohesion: 0.26
Nodes (15): ACTIVE, AppointmentConflictError, assertNotDuplicate(), assertSlotFree(), clinicTimeLabel(), createAppointment(), getClinicTime(), patientForVisit() (+7 more)

### Community 50 - "auth.ts"
Cohesion: 0.10
Nodes (16): better-auth@^1.7.15, main(), seedAdmin(), better-auth, main(), GET, handlers, instant (+8 more)

### Community 51 - "prisma.ts"
Cohesion: 0.09
Nodes (43): CatalogError, GET(), PATCH(), updateSchema, CatalogError, GET(), POST(), GET() (+35 more)

### Community 52 - "client.ts"
Cohesion: 0.11
Nodes (13): Account, Appointment, $Enums, PrismaClient, Session, User, Verification, config (+5 more)

### Community 53 - "usePublicLanguage"
Cohesion: 0.21
Nodes (16): DoctorCard(), DoctorDirectory(), Pagination(), DoctorPhoto(), DoctorProfileView(), Section(), PublicClinicIdentity, formatFee() (+8 more)

### Community 54 - "dashboard-overview.tsx"
Cohesion: 0.09
Nodes (29): label(), PatientSelect(), choose(), close(), onKeyDown(), openList(), PatientSelectChoice, AppointmentRecord (+21 more)

### Community 55 - "templates.ts"
Cohesion: 0.61
Nodes (8): emailTestEmail(), escapeHtml(), layout(), paragraph(), passwordChangedEmail(), passwordChangeOtpEmail(), passwordResetOtpEmail(), reportReadyEmail()

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
Cohesion: 0.09
Nodes (32): instant, metadata, Page(), instant, metadata, Page(), HomePage(), instant (+24 more)

### Community 65 - "reviews.test.ts"
Cohesion: 0.22
Nodes (13): GET(), POST(), getPublishedReviews(), namesOverlap(), phoneMatchKeys(), REVIEW_LIMITS, ReviewSubmission, words() (+5 more)

### Community 66 - "localize"
Cohesion: 0.39
Nodes (15): HeroServiceSlider(), localize(), categoryName(), DetailsModal(), feeLabel(), IconName, iconName(), numberFormat() (+7 more)

### Community 67 - "logger.ts"
Cohesion: 0.15
Nodes (15): GET(), onRequestError(), ClinicChange, ensureListener(), globalForRealtime, ListenerState, RealtimeGlobal, Subscriber (+7 more)

### Community 68 - "appointment-insights.tsx"
Cohesion: 0.15
Nodes (15): recharts@^3.10.1, recharts, DayBar, HourBar, StatusSlice, TONES, AppointmentInsights(), CLINIC_HOURS (+7 more)

### Community 69 - "prismaNamespaceBrowser.ts"
Cohesion: 0.12
Nodes (15): AccountScalarFieldEnum, AnyNull, AppointmentScalarFieldEnum, DbNull, Decimal, JsonNull, ModelName, NullsOrder (+7 more)

### Community 70 - "import-service.ts"
Cohesion: 0.05
Nodes (51): POST(), uploadSchema, parseCsv(), serviceSchema, feeRangeCheck(), feeRangeError, OFFERED_ICON_KEYS, SERVICE_ICON_KEYS (+43 more)

### Community 71 - "qr-login-plugin.ts"
Cohesion: 0.25
Nodes (15): isStaffAccount(), activeStatuses, approve, cancel, complete, create, expireIfNeeded(), findValidSession() (+7 more)

### Community 72 - "scripts"
Cohesion: 0.12
Nodes (16): scripts, admin:reset-password, build, db:generate, db:migrate, db:seed, db:seed:demo, db:seed:lab (+8 more)

### Community 73 - "appointment-management.tsx"
Cohesion: 0.12
Nodes (21): @tanstack/react-query@5.106.1, @tanstack/react-query, QueryMeta, QueryProvider(), RealtimeQuerySync(), formatClinicWeekday(), bookingKeys, BookingsFilters (+13 more)

### Community 74 - "patient-rules.ts"
Cohesion: 0.33
Nodes (9): firstPatientFieldError(), PATIENT_FIELD_ORDER, PatientFieldInput, text(), validateDateOfBirth(), validateLongText(), validatePatientFields(), TODAY (+1 more)

### Community 75 - "app/api/appointments/route.ts"
Cohesion: 0.21
Nodes (10): bookingsPageQuery, dayKey, GET(), BOOKINGS_PAGE_SIZE, BookingsFilters, bookingsWhere(), listAppointments(), listAppointmentsPage() (+2 more)

### Community 76 - "dotenv"
Cohesion: 0.13
Nodes (7): dotenv@^18.0.9, pg@^8.23.1, prisma@7.10.1, dotenv, pg, prisma, match

### Community 77 - "DMS implementation report"
Cohesion: 0.08
Nodes (23): 10. Staff and access control, 11. Dashboard and reports, 12. Communication, 13. System settings, 1. Patient management, 2. Doctor management, 3. Test and service catalog, 6. Reports (+15 more)

### Community 79 - "website-layout.ts"
Cohesion: 0.11
Nodes (19): LayoutIcon(), announcement, announcementLink, bilingual(), card, CardIcon, contactEmail, facebookUrl (+11 more)

### Community 80 - "gallery-management.tsx"
Cohesion: 0.50
Nodes (8): byOrder(), GalleryManagement(), deleteImage(), move(), send(), submitImage(), Preview(), notify()

### Community 81 - "password-recovery.test.ts"
Cohesion: 0.20
Nodes (10): GET(), isEmailEnabled(), complete(), configureEmail(), lastCode(), mail, request(), sent (+2 more)

### Community 82 - "call"
Cohesion: 0.09
Nodes (27): edit(), editRole(), create(), input(), list(), patch(), read(), remove() (+19 more)

### Community 83 - "sms.test.ts"
Cohesion: 0.18
Nodes (12): call(), checkBalance(), CODE_MESSAGES, describeGatewayCode(), GatewayResult, networkFailure(), sendSms(), SmsCredentials (+4 more)

### Community 84 - "01 — Live Admin Dashboard Review"
Cohesion: 0.13
Nodes (14): 01 — Live Admin Dashboard Review, 10. Functional issues, 11. UI/UX issues, 12. Usability recommendations (no code changed in this review), 13. Areas requiring further verification, 1. Overall overview, 2. Sidebar and navigation, 3. Header and user profile (+6 more)

### Community 85 - "sms-settings.tsx"
Cohesion: 0.15
Nodes (17): Form, HistoryRow, PURPOSE, Settings, smsParts(), SmsSettings(), post(), run() (+9 more)

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
Cohesion: 0.29
Nodes (6): API, Authentication, Conventions, Patient reviews, Public API (no sign-in), Website content

### Community 93 - "ASDC Diagnostic: Diagnostic Center Management System"
Cohesion: 0.20
Nodes (10): ASDC Diagnostic: Diagnostic Center Management System, Backup and recovery, Demo data, Deploying database changes, Doctor directory, From booking to report, Local setup, Roles (+2 more)

### Community 94 - "Database"
Cohesion: 0.22
Nodes (13): Users and roles (administrator only), Roles and permissions, Constraints added by `20261106043000_integrity_constraints_and_invoice_sequence`, Database, Deliberately not modelled, Indexes, Migrations, Relationships and deletion rules (+5 more)

### Community 95 - "password-change-service.ts"
Cohesion: 0.28
Nodes (11): clientIp(), POST(), clientIp(), POST(), schema, changePasswordWithCode(), enforce(), maskEmail() (+3 more)

### Community 96 - "appointment-actions.ts"
Cohesion: 0.20
Nodes (12): AppointmentResponse, AppointmentValidationError, createAppointmentRequest(), deleteAppointmentRequest(), readResponse(), updateAppointmentRequest(), AppointmentFieldErrors, AppointmentStatusValue (+4 more)

### Community 97 - "enums.ts"
Cohesion: 0.22
Nodes (7): Account, Appointment, $Enums, Session, User, Verification, AppointmentStatus

### Community 98 - "Demo data (`pnpm db:seed:demo`)"
Cohesion: 0.22
Nodes (8): Demo data (`pnpm db:seed:demo`), Demo logins (development only), Public website wording (`pnpm db:seed:website`), Repeatable and safe, Resetting, Seed data, Starter test catalog (`pnpm db:seed:lab`), What is created

### Community 99 - "patient-schema.ts"
Cohesion: 0.15
Nodes (14): invoiceFormSchema, InvoiceFormValues, invoiceInputSchema, isMoney(), LIMITS, money(), purchaseFormSchema, formText (+6 more)

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

### Community 109 - "appointment-rules.ts"
Cohesion: 0.19
Nodes (18): submitReview(), compactPhone(), CONTACT_LIMITS, validateEmail(), validatePersonName(), validatePhone(), phone(), APPOINTMENT_LIMITS (+10 more)

### Community 110 - "PrismaClientBaseOptions"
Cohesion: 0.67
Nodes (3): PrismaClientBaseOptions, PrismaClientOptionsWithAccelerateUrl, PrismaClientOptionsWithAdapter

### Community 114 - "secret-box.ts"
Cohesion: 0.31
Nodes (11): GET(), PUT(), decryptSecret(), encryptSecret(), keyIdOf(), keys(), needsReencryption(), parseKey() (+3 more)

### Community 115 - "patient-form-modal.tsx"
Cohesion: 0.18
Nodes (12): @hookform/resolvers@7.0.3, react-hook-form@7.91.0, @hookform/resolvers, react-hook-form, ageFrom(), emptyPatientForm, FieldProps, FormField() (+4 more)

### Community 116 - "map-link.test.ts"
Cohesion: 0.31
Nodes (9): buildEmbedUrl(), extractMapUrl(), isAllowedHost(), MapLinkError, MapLocation, parseMapLocation(), resolveMapLink(), isSafeMapEmbed() (+1 more)

### Community 117 - "appointment-schema.ts"
Cohesion: 0.29
Nodes (10): POST(), POST(), runAfterResponse(), enforcePublicRateLimit(), publicRateLimits, firstFieldError(), parseAppointmentInput(), parseCreateAppointment() (+2 more)

### Community 118 - "ASH_SHIFA_DMS_Client_User_Manual_BN.md"
Cohesion: 0.18
Nodes (10): অর্ডারের তালিকা, টাকা গ্রহণ (অর্ডার থেকে), টেস্ট অর্ডার দেওয়া, টেস্ট ও সেবার তালিকা, ডাক্তারের প্রোফাইল, রিপোর্টস (আয়-ব্যয়ের সারাংশ), শব্দকোষ, স্টক (Inventory) (+2 more)

### Community 119 - "appointments.test.ts"
Cohesion: 0.24
Nodes (8): book(), run, booking(), create(), setStatus(), clinicTime(), ensureDoctorSchedule(), book()

### Community 120 - "booking-form.tsx"
Cohesion: 0.42
Nodes (9): BookingForm(), submitAppointment(), dhakaDateKey(), formatDate(), formatTime(), getDhakaParts(), getWhatsAppNumber(), toMinutes() (+1 more)

### Community 121 - "readPatientResponse"
Cohesion: 0.27
Nodes (8): parseBody(), PatientRequestError, readPatientResponse(), ResponseBody, removePatient(), savePatient(), togglePatientStatus(), PatientFieldErrors

### Community 122 - "UI/UX fix report: dialogs, forms and layouts"
Cohesion: 0.22
Nodes (8): Components standardized, Modified files, Problems fixed, Problems identified (all from the shared layer), Remaining issues, Responsive behaviour, UI/UX fix report: dialogs, forms and layouts, Verified in the browser

### Community 123 - "ভূমিকা অনুযায়ী দৈনিক কাজ"
Cohesion: 0.29
Nodes (7): অ্যাকাউন্ট্যান্ট, অ্যাডমিনিস্ট্রেটর (মালিক), ডাক্তার, প্যাথলজিস্ট, ভূমিকা অনুযায়ী দৈনিক কাজ, রিসেপশনিস্ট, ল্যাব স্টাফ

### Community 124 - "expense-schema.ts"
Cohesion: 0.29
Nodes (4): ExpenseInput, expenseInputSchema, expenseListQuerySchema, expenseVoidSchema

### Community 125 - "voice-settings.tsx"
Cohesion: 0.43
Nodes (6): Form, Settings, toForm(), VoiceSettings(), run(), submit()

### Community 126 - "website-content-schema.ts"
Cohesion: 0.33
Nodes (5): CONTENT_LIMITS, highlights(), text(), WebsiteContentInput, websiteContentSchema

### Community 127 - "ওয়েবসাইট, রিভিউ ও প্রশাসন"
Cohesion: 0.33
Nodes (6): SMS ও ইমেইল সেটিংস, ওয়েবসাইট, রিভিউ ও প্রশাসন, ওয়েবসাইটের লেখা, কর্মী যোগ ও ভূমিকা, নিজের পাসওয়ার্ড ও নিরাপত্তা, রোগীর রিভিউ

### Community 128 - "বুকিং (Appointment)"
Cohesion: 0.33
Nodes (6): অবস্থা বদলানো, ওয়েবসাইটের অনুরোধ নিশ্চিত করা, নতুন বুকিং, বুকিং (Appointment), রিমাইন্ডার, সরাসরি আসা রোগী (Walk-in)

### Community 129 - "csv.ts"
Cohesion: 0.60
Nodes (4): csvCell(), csvLine(), exportPatientsCsv(), patientsToCsv()

### Community 130 - "বিলিং"
Cohesion: 0.50
Nodes (4): আলাদা বিল তৈরি, টাকা গ্রহণ (Billing থেকে), বিলিং, বিল বাতিল ও টাকা ফেরত

### Community 131 - "খরচ ও দিনের হিসাব বন্ধ"
Cohesion: 0.50
Nodes (4): খরচ ও দিনের হিসাব বন্ধ, খরচ লেখা, দিনের নগদ হিসাব বন্ধ (Close the day), দিনের সারাংশ

### Community 132 - "নমুনা সংগ্রহ ও ল্যাবে গ্রহণ"
Cohesion: 0.50
Nodes (4): নমুনা বাতিল (Reject), নমুনা সংগ্রহ (Mark collected), নমুনা সংগ্রহ ও ল্যাবে গ্রহণ, ল্যাবে নমুনা গ্রহণ (Receive samples)

### Community 133 - "ফলাফল এন্ট্রি, যাচাই ও রিপোর্ট"
Cohesion: 0.50
Nodes (4): ফলাফল এন্ট্রি, ফলাফল এন্ট্রি, যাচাই ও রিপোর্ট, যাচাই ও অনুমোদন (প্যাথলজিস্ট), রিপোর্ট রিলিজ ও রোগীকে দেওয়া

### Community 135 - "Dashboard চেনা"
Cohesion: 0.67
Nodes (3): Dashboard চেনা, KPI কার্ডের মানে, বাম মেনুর অংশগুলো

### Community 136 - "লগইন ও লগআউট"
Cohesion: 0.67
Nodes (3): "Email অথবা পাসওয়ার্ড সঠিক নয়" দেখালে, পাসওয়ার্ড ভুলে গেলে, লগইন ও লগআউট

### Community 137 - "এই নির্দেশিকা সম্পর্কে"
Cohesion: 0.67
Nodes (3): এই নির্দেশিকা সম্পর্কে, কে কী করতে পারেন (ভূমিকা), কীভাবে পড়বেন

### Community 138 - "রোগী নিবন্ধন ও খোঁজা"
Cohesion: 0.67
Nodes (3): নতুন রোগী নিবন্ধন, রোগী খোঁজা, সম্পাদনা ও অন্যান্য কাজ, রোগী নিবন্ধন ও খোঁজা

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `client.ts` to `prismaNamespace.ts`, `User.ts`, `commonInputTypes.ts`, `Account.ts`, `prismaNamespaceBrowser.ts`, `Session.ts`, `Appointment.ts`, `Verification.ts`, `package.json`?**
  _High betweenness centrality (0.321) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `authorize()` (e.g. with `2. Roles and permissions` and `10. Staff and access control`) actually correct?**
  _`authorize()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `prismaNamespace.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.017094017094017096 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `email-config-service.ts`, `clinic-date.ts`, `patient-schema.ts`, `orders-section.tsx`, `DashboardSectionPage`, `apiError`, `app/not-found.tsx`, `Modal`, `lucide-react`, `order-service.ts`, `doctors/[id]/route.ts`, `sms-service.ts`, `doctors-section.tsx`, `package.json`, `report-rules.ts`, `auth.test.ts`, `prisma.ts`, `admin-dashboard.tsx`, `react`, `dependencies`, `react`, `report-service.ts`, `voice-service.ts`, `doctor-queries.ts`, `prisma.ts`, `rate-limit.ts`, `app/layout.tsx`, `website-content-management.tsx`, `auth.ts`, `prisma.ts`, `usePublicLanguage`, `dashboard-overview.tsx`, `Design system and platform checklist`, `brand.ts`, `reviews.test.ts`, `localize`, `logger.ts`, `appointment-insights.tsx`, `import-service.ts`, `app/api/appointments/route.ts`, `password-recovery.test.ts`, `forgot-password-form.tsx`, `password-change-service.ts`, `price-list/page.tsx`, `secret-box.ts`, `appointment-schema.ts`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Should `clinic-date.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07138047138047138 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `orders-section.tsx`, `Modal`, `requestJson`, `lucide-react`, `requestJson`, `doctors-section.tsx`, `email-settings.tsx`, `package.json`, `report-rules.ts`, `result-service.ts`, `users-tab.tsx`, `admin-dashboard.tsx`, `react`, `dependencies`, `doctor-queries.ts`, `app/layout.tsx`, `website-content-management.tsx`, `auth.ts`, `usePublicLanguage`, `dashboard-overview.tsx`, `localize`, `appointment-insights.tsx`, `import-service.ts`, `appointment-management.tsx`, `sms-settings.tsx`, `forgot-password-form.tsx`, `review-management.tsx`, `security-view.tsx`, `patient-form-modal.tsx`, `booking-form.tsx`, `voice-settings.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Should `User.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.023255813953488372 - nodes in this community are weakly interconnected._