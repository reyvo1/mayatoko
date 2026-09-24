# CURRENT AUTHORITATIVE RECOVERY — 2026-09-24

Active work item: `T360-20260924-020700` — R0 recovery truth reset and 48/48 audit closure governance.

- Baseline HEAD: `c391fc9fd8c42cb6352317853718cba1415a9603` on `main`.
- Working tree intentionally contains preserved F12R4 changes; do not discard them.
- F12R4 work item `T360-20260923-221011` is BLOCKED behind recovery prerequisites.
- Recovery matrix: `config/recovery-finding-matrix.json` — 48/48 mapped, 0 unmapped.
- Master workflow: `docs/TOKO360-MASTER-RECOVERY-WORKFLOW.md`.
- Required order: R0 → R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8.
- Human Stage-20 remains BLOCKED/PENDING.
- Do not interpret old UI/productization closure notes below as current release readiness; they are historical chronology only.

## Final automation closure — 2026-09-22

UI productization/hardening **UI-P1 through UI-P7 is closed from authoritative GitHub Full System Simulation evidence**.

Final verified source:
- commit: `97346eafe34b1cad9eb24f3072f04d7fd2c0150d`
- regression: **708 PASS**
- Built Browser UAT: **PASS**
- Stage-18 / Stage-19 / Stage-20 automated: **PASS**
- full-system aggregate: **PASS**
- source fingerprint: `328cc5695ff3ab82fa8aaa5dffbbe5828a5e48c1b1f191e852a0881fd7a6c8ad`
- build artifact: `3e5c9d075d12974b4a0e79ae90a639a23ce087549b5aaa4a4616467630b9cbe9`

There are no remaining active UI/productization work items after this closure.

This does **not** claim production readiness. Human Stage-20 UAT remains **PENDING 12/12** and `uat:candidate:verify` must remain fail-closed until valid manual evidence exists. After Human UAT, the remaining release path is UAT-candidate verification, promotion approval/security/DR/provider evidence, production deployment/schema/backup/smoke attestation, then final production-ready verification.

# Toko360 — Current Work

Updated: 2026-09-22 Asia/Makassar

## Last closed work item
UI-P2 Admin Domain Workspaces is CLOSED from the user-confirmed green GitHub baseline:

`b1c561d97813f5e0916d194e0146cbec147a741e`

## Active work item
`T360-20260922-152500` — UI-P3 POS modernization dan operator workspaces.

Phase: VERIFICATION.

Implemented scope:
- reusable `PosShell`;
- workspace Penjualan;
- workspace Shift & Kas;
- workspace Retur;
- workspace Sinkronisasi;
- desktop sticky cart dan responsive mobile workspace;
- existing quote/payment/stock/shift/return/offline replay/idempotency/auth/tenant contracts tetap authoritative.

No database/schema/backend-business-logic change.

## UAT invariant
Human Stage-20 UAT tetap PENDING 12/12 sampai ada human evidence yang sah. Automated simulation tidak boleh mengubah status itu dan `uat:candidate:verify` tetap fail-closed.

## Next gate
Push UI-P3 dari baseline source nyata `b1c561d97813f5e0916d194e0146cbec147a741e`, lalu gunakan GitHub Full System Simulation sebagai heavy validator. UI-P3 tetap VERIFICATION sampai run tersebut hijau.


## UI-P4 current work — 2026-09-22

- Baseline source: `be8007ba2f7ba7f8d98a09a3acb6a2c783599988` (UI-P3 browser fix green).
- UI-P3 CLOSED berdasarkan GitHub Full System Simulation PASS; Human Stage-20 UAT tetap PENDING 12/12.
- UI-P4 Storefront productization aktif di phase VERIFICATION.
- Scope: reusable storefront shell, deep-link home/catalog/product/cart/account, catalog sort/search, detail product, checkout/account separation.
- Backend/schema/business rules tidak diubah. GitHub menjadi validator heavy build/browser/runtime/exact-artifact.

## UI-P5 current work — 2026-09-22
- Baseline source lokal exact: `4c336296fde105b425f94cdf4a5ab4968c0d4fb9`, working tree clean.
- UI-P4 masih VERIFICATION sampai current-main Full System Simulation yang sesuai commit productization/fix tersedia; tidak ditutup secara asumsi.
- UI-P5 Employee Portal productization aktif di VERIFICATION sebagai work item terpisah.
- Scope UI-P5: reusable EmployeePortalShell + home/attendance/leave/overtime/payslips/history/profile.
- Backend/schema tidak diubah; auth refresh, employee self-scope, attendance GPS/selfie/geofence, leave/overtime approval, dan payslip access tetap authoritative.
- Human Stage-20 UAT tetap PENDING/fail-closed.

## UI-P5 verification note
- Focused UI-P5 static regression: **5/5 PASS**.
- Changed TS/TSX transpile: **4/4 PASS**.
- Existing browser-uat tests were not claimed locally because the user-provided subset snapshot does not contain `scripts/browser-uat.mjs` / workflow files that those tests read.
- GitHub Full System Simulation remains authoritative for authenticated Employee Portal browser/runtime.

## UI-P6 server-driven Admin UI
Current batch: VERIFICATION. Baseline `e37f7feee08f44544c38fa508e69af6e6cb8468f`. UI-P4 dan UI-P5 ditutup berdasarkan full-system PASS pada baseline tersebut. UI-P6 memperluas runtime resolver ke nested domain views tanpa mengubah backend authority. Human UAT tetap PENDING/fail-closed.

## UI-P7 current batch
UI-P6 telah CLOSED berdasarkan full-system green commit `4cac591f0ba27f571e987e07b7343d85dba40241`.

UI-P7 sekarang VERIFICATION:
- cross-app skip links dan focus targets;
- focus-visible/reduced-motion/touch target hardening;
- semantic active navigation/status;
- browser literals tidak diubah;
- Human Stage-20 UAT tetap PENDING/fail-closed.

## F2 Master Product — category hierarchy batch — 2026-09-23
- F2 remains IN_PROGRESS; browser/human UAT intentionally deferred until implementation phase completion.
- Added category/subcategory hierarchy fields (`parentId`, `sortOrder`, `isActive`) with SQLite/PostgreSQL parity and tenant-scoped slug uniqueness.
- Master-data service validates tenant parent ownership, rejects self/cyclic hierarchy, prevents sibling duplicate names, and blocks deactivation while active children/products depend on the category.
- Admin Master Data now supports real category create/edit/parent/order/activate/deactivate flow.
- Static gates: workflow/repo validation PASS; dependency-free regression 724/724 PASS.
- Next F2 gap: first-class product variants and variant-aware barcode/pricing before completing Multi-UOM integration.

## F2 Master Product — product variant batch — 2026-09-23
- F2 remains IN_PROGRESS; runtime/browser/human UAT remains deferred until F2 implementation is complete.
- Added first-class ProductVariant with product-owned code/name/optional SKU/attributes/cost-price/sale-price/default/active lifecycle.
- ProductBarcode and ProductPrice can now bind to a variant while NULL variantId remains backward-compatible product-level behavior.
- Primary barcode uniqueness is enforced per base product vs per variant by service transaction; variant barcode cannot overwrite Product.barcode.
- Pricing resolver can prefer variant-specific rows and fall back to product-level rows/base sale price.
- Admin Master Data exposes variant create/edit/activate/deactivate and variant selectors on barcode and pricing forms.
- Expand-only SQLite/PostgreSQL migration included but intentionally not auto-applied.
- Static gates: workflow/repo validation PASS; targeted Multi-UOM + legacy unit conversion 11/11 PASS; dependency-free regression 737/737 PASS.
- Next F2 gap after static gates: finish Multi-UOM first-class semantics and then F11 transaction integration later per locked roadmap.


## F2 Master Product — Multi-UOM batch — 2026-09-23
- F2 remains IN_PROGRESS; runtime/browser/human UAT remains deferred until F2 implementation completion.
- Added first-class ProductUnit for alternative sale/purchase units per base product or variant, with integer base-unit factor and default sale/purchase flags.
- Barcode and ProductPrice can bind ProductUnit; unit/factor snapshots remain for backward compatibility and later F11 transaction integration.
- Base inventory unit remains Product.unit; alternative UOM cannot redefine the base unit.
- Expand-only SQLite/PostgreSQL migration included but intentionally not auto-applied.

## F2 source implementation closure + F3 warehouse lifecycle start — 2026-09-23
- F2 Master Product + Multi-UOM source implementation is COMPLETE for the locked F2 acceptance surface: category hierarchy, product CRUD/lifecycle, product variants, first-class ProductUnit, variant/UOM-aware barcode, branch/segment/min-qty pricing, product tax profile, and tracking configuration.
- Runtime/browser/human UAT remains intentionally deferred by operator instruction and is not claimed as complete.
- F3 is now IN_PROGRESS.
- INV-05B dynamic warehouse lifecycle UI added: operator can create, edit, set default, activate, and deactivate warehouses through the existing tenant-scoped master-data API.
- No new warehouse backend or duplicate domain was created; existing UpdateWarehouseDto/service/controller remain authoritative.
- Static gates: workflow validation PASS, repository validation PASS, dependency-free regression 739/739 PASS.

## F3 Inventory condition ledger — 2026-09-23
- F3 remains IN_PROGRESS; runtime/browser/human UAT remains deferred by operator instruction.
- Added first-class `InventoryConditionBalance` and append-only `InventoryConditionMovement` with AVAILABLE/DAMAGED/QUARANTINE/LOST buckets.
- Condition classification is integrated into canonical location stock deposit/consume/reservation fulfillment/adjustment/relocation paths instead of being a reporting-only side table.
- Moving stock out of AVAILABLE reduces sellable warehouse/location `available` without changing physical `quantity`; moving it back restores sellable availability. Reserved stock is fail-closed and cannot be reclassified out of AVAILABLE.
- Existing location stock lazily materializes into AVAILABLE on first condition-aware access; subsequent condition/location drift is fail-closed.
- Admin Operations exposes balance view and audited condition movement flow. Expand-only SQLite/PostgreSQL migration is included and intentionally not auto-applied.
- Static gates for F3 condition ledger: targeted 4/4 PASS, workflow validation PASS, repository validation PASS (177 Prisma models), full dependency-free regression 743/743 PASS.


## F3 Batch / Expiry hardening — 2026-09-23
- F3 remains IN_PROGRESS; runtime/browser/human UAT remains deferred by operator instruction.
- Existing InventoryBatch remains authoritative; no duplicate batch domain was created.
- Added first-class Product.trackExpiry, constrained so expiry tracking requires batch tracking.
- Goods receipt now fails closed for missing batch/expiry on tracked products, rejects already-expired inbound stock, and rejects conflicting expiry dates for the same warehouse/product/batch.
- Order fulfillment consumes non-expired dated batches FEFO first, then undated batches, and never consumes expired batches.
- Batch pre-registration requires future expiry when product.trackExpiry is enabled; Admin exposes expiry configuration and expired batch status.
- Expand-only SQLite/PostgreSQL migration included and intentionally not auto-applied.
- Static gates: targeted 5/5 PASS, workflow validation PASS, repository validation PASS (177 Prisma models), full dependency-free regression 748/748 PASS.

## F3 Serial receipt integrity — 2026-09-23
- F3 remains IN_PROGRESS; runtime/browser/human UAT remains deferred by operator instruction.
- Serial-tracked inbound stock is now fail-closed at canonical Goods Receipt: accepted serial count must exactly match accepted quantity, duplicates are rejected, and non-serial products cannot carry serial manifests.
- GoodsReceiptItem persists a nullable serial manifest for draft/inspection continuity; confirmation creates InventorySerial rows atomically with stock posting and links each serial to the GoodsReceiptItem source.
- Admin receiving now exposes batch/expiry/serial traceability inputs from product tracking configuration instead of requiring post-hoc manual serial registration.
- Expand-only SQLite/PostgreSQL migration included and intentionally not auto-applied.
- Static gates: targeted 4/4 PASS, workflow validation PASS, repository validation PASS (177 Prisma models), full dependency-free regression 752/752 PASS.


## F3 source implementation closure — 2026-09-23
- F3 Inventory/batch/expiry/condition source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Warehouse lifecycle, location balance/relocation, persisted condition ledger, batch/expiry FEFO, atomic receipt serials, transfer batch/serial traceability, derived IN_TRANSIT visibility, batch-aware whole-warehouse stock opname, and minimum/reorder visibility are implemented.
- IN_TRANSIT is derived from open StockTransfer shipped-minus-received quantity rather than duplicated into warehouse condition balances.
- Static gates: F3 focused 20/20 PASS, workflow validation PASS, repository validation PASS, full dependency-free regression 757/757 PASS.
- Next locked phase for source implementation: F4 Accounting enterprise.


## F4 Accounting enterprise source closure — 2026-09-23
- F4 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Added branch-scoped Chart of Accounts operator lifecycle with history-safe type changes and active-rule deactivation guard.
- Posting rule/account mapping is now operator-managed, versioned, effective-dated, overlap-guarded, and immutable after activation/use.
- Added tenant-scoped accounting event drill-down from source/event through rule version to journal/account lines.
- Preserved canonical audit action compatibility while recording version operation in audit payload.
- Static gates: targeted accounting 11/11 PASS, workflow validation PASS, repository validation PASS, full dependency-free regression 762/762 PASS.
- Next locked phase for source implementation: F5 Tax workspace dinamis.

## F5 Dynamic Tax source closure — 2026-09-23
- F5 source implementation is COMPLETE; runtime/browser/human UAT remains intentionally deferred.
- TaxCode is versioned/effective-dated and historical versions cannot be overwritten after activation or TaxTransaction usage.
- Tax mappings validate against active branch COA, and ACTIVE versions for the same code cannot overlap effective periods.
- Tax transaction ledger, tax documents and branch-scoped reconciliation are available through accounting-core and Admin Tax workspace.
- Expand-only SQLite/PostgreSQL migration is included but not auto-applied.
- Static gates: workflow validation PASS, repository validation PASS, dependency-free regression 771/771 PASS.
- Next locked phase: F6 Reporting / drill-down.


## F6 Financial Reporting source closure — 2026-09-23
- F6 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Added journal-backed cash flow, operational margin, previous-period comparison, role-scoped branch comparison, accounting-event cost-center comparison, and account→journal→event→source drill-down.
- Finance Reports operator workspace now exposes dynamic period filters, core statements, inventory valuation, margin, tax summary, dimension comparison, drill-down, and async exports.
- ReportJob filters are server validated; async worker supports INVENTORY_VALUATION, BRANCH_COMPARISON, COST_CENTER, PERIOD_COMPARISON in CSV/XLSX/PDF.
- Next locked phase: F7 AR/AP/Cash/Bank/Reconciliation.

## F7 AR/AP/Cash/Bank/Reconciliation source closure — 2026-09-23
- F7 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Added tenant-scoped AR/AP aging, AP due-date calculation from supplier payment terms, journal-backed cash/bank position, latest statement delta, and settlement trace from source document through finance transaction/accounting event/journal.
- Existing canonical settlement, overpayment guards, statement import, auto/manual reconciliation, fiscal-period control, Accounting Core posting, audit and idempotency remain authoritative; no duplicate AR/AP ledger was introduced.
- Static gates: focused F7 29/29 PASS, workflow validation PASS, repository validation PASS, dependency-free regression 781/781 PASS.
- Next locked phase: F8 Automation + scheduled reports.
## F8 Automation + Scheduled Reports source closure — 2026-09-23
- F8 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Existing BusinessRule/AutomationJob remain canonical; added validated rule edit/lifecycle plus tenant-scoped job history/detail/cancel/replay operator controls.
- Added first-class ReportSchedule with company-timezone DAILY/WEEKLY/MONTHLY recurrence; worker atomically materializes due schedules into canonical ReportJob using unique scheduleId+scheduledFor traceability.
- Rule action `report.enqueue` can enqueue the canonical asynchronous report worker without creating a second reporting engine.
- Expand-only SQLite/PostgreSQL migration is included but intentionally not auto-applied.
- Static gates: focused F8 21/21 PASS, workflow validation PASS, repository validation PASS (178 Prisma models), dependency-free regression 791/791 PASS.
- Next locked phase: F9 WhatsApp/Telegram notification center.



## F9 WhatsApp / Telegram Notification Center source closure — 2026-09-23
- F9 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Existing IntegrationConnection/NotificationTemplate/Notification remain canonical; no duplicate provider or delivery ledger was introduced.
- Worker resolves tenant/channel NOTIFICATION connections first, uses encrypted secrets, records provider health, and retains env credentials only as compatibility fallback.
- Admin Notification Center exposes provider health/lifecycle, template management, delivery history, queue cancel, and failed/cancelled replay.
- Tenant regression now validates company + stored branch-envelope behavior structurally rather than relying on brittle source-line formatting.
- Static gates: focused F9/tenant notification 18/18 PASS, workflow validation PASS, repository validation PASS (178 Prisma models), dependency-free regression 796/796 PASS.
- Next locked phase: F10 AI/forecasting/operator assistant.


## F10 AI / Forecasting / Operator Assistant source closure — 2026-09-23
- F10 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Existing ForecastRun/ReorderSuggestion remain canonical; recommendation reason now carries formula, exact inputs, confidence, and source references.
- Added first-class OperatorInsight and AssistantInteraction with tenant/branch scope, permission-scoped source access, acknowledgement/dismissal audit, and read-only assistant behavior.
- Assistant never executes purchase/accounting/inventory mutations; recommendations require human confirmation and expose required permission/deep-link.
- Expand-only SQLite/PostgreSQL migration is included but intentionally not auto-applied.
- Static gates: focused F10 + tenant scope 20/20 PASS, workflow validation PASS, repository validation PASS (180 Prisma models), dependency-free regression 805/805 PASS.
- Next locked phase: F11 Purchase/Sales/POS UOM integration.

## F11 Purchase / Sales / POS UOM integration source closure — 2026-09-23
- F11 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- ProductUnit is now the transaction authority for direct Purchase and POS/Sales UOM selection; barcode remains only a shortcut to the same unit snapshot.
- PurchaseOrderItem and GoodsReceiptItem preserve selected UOM/variant/factor/cost snapshots while ordered/received inventory quantities remain canonical integer base units.
- SaleItem preserves variant/ProductUnit identity in addition to unit/factor/barcode snapshots; pricing remains server-authoritative and variant/UOM aware.
- Admin procurement exposes purchase UOM selection and receiving in PO UOM; POS exposes direct active ProductUnit actions and keeps non-base UOM online-only.
- Expand-only SQLite/PostgreSQL migration is included but intentionally not auto-applied.
- Static gates: focused F11 + legacy unit/procurement regression 30/30 PASS, workflow validation PASS, repository validation PASS (180 Prisma models), dependency-free regression 809/809 PASS.
- Next locked phase: F12 Final UI/UX polish.

## F12 Final UI/UX polish source closure — 2026-09-23
- F12 source implementation is COMPLETE; runtime/browser/human UAT remains deferred by operator instruction.
- Final presentation-only pass aligns Admin, POS, Storefront, and Employee Portal density, forms, tables, responsive behavior, feedback states, and touch ergonomics without changing F2–F11 business authority.
- Existing UI-P1–UI-P7 accessibility/server-driven navigation contracts remain authoritative; no second UI business workflow was introduced.
- Static gates: focused F12/UI regression 40/40 PASS, workflow validation PASS, repository validation PASS (180 Prisma models), dependency-free regression 814/814 PASS.
- Next gate after F12 source closure: apply pending expand migrations in controlled TEST/STAGING, then run full runtime/browser/human UAT and release evidence chain.

## Local pre-GitHub candidate gate — 2026-09-23
- F2-F12 source implementation and expand-migration hardening are complete at source level.
- Added `npm run uat:pre-github:local` / `RUN-LOCAL-CANDIDATE-GATE.cmd` to run, in order: SQLite migration rehearsal, `quality:full` (lint/regression/local DB smoke/six-app build), and critical UAT automated coverage mapping.
- The gate is source-fingerprint-bound, refuses production/live and PostgreSQL local targets, and writes `handoff/quality/local-candidate-gate-latest.json`.
- After PASS, the next authoritative gate is GitHub Full System Simulation. Human Stage-20 UAT remains PENDING/fail-closed.

## Local candidate TypeScript closure — 2026-09-23
- Local candidate gate correctly failed during workspace TypeScript lint after migration rehearsal PASS.
- Root compile issues were fixed in Admin tax workspace, current-schema seed selectors, Accounting Core null narrowing, aggregate audit typing, AP aging typing, Purchase UOM prepared-item typing, and Sales variant/ProductUnit snapshot typing.
- Added `tests/local-candidate-typescript-regressions.test.mjs`; source gates now PASS with 829/829 dependency-free tests.
- Next gate remains `npm run uat:pre-github:local` on the dependency-complete local repo. Do not push to GitHub heavy simulation until that local gate is fully PASS.

### 2026-09-23 — GitHub migration rehearsal blocker fixed
- GitHub Full System Simulation reached PostgreSQL expand migration rehearsal.
- All 11 F2-F11 PostgreSQL expand migrations applied successfully.
- Failure occurred only during current-schema verification because `@prisma/client` had not been initialized in that workflow ordering.
- Root fix: rehearsal generates an isolated scratch Prisma Client from the current provider schema, verifies the migrated scratch DB, then deletes the scratch directory. It does not regenerate/mutate the exact build artifact client.
- Validation after fix: targeted GitHub/migration guards 15/15 PASS; workflow validate PASS; repo validate PASS; dependency-free regression 829/829 PASS.
- Next: apply patch, rerun local static gate, commit/push, rerun GitHub Full System Simulation. Human Stage-20 remains PENDING.

### GitHub UAT bootstrap/config root fix — 2026-09-23
- Previous migration rehearsal blocker is resolved; latest GitHub run passed expand migration rehearsal.
- First real blocker was manual UAT seed using `Admin123!`, rejected by bootstrap seed policy (min 14 chars, no demo/default password).
- Root fixed in workflow and `prepare-github-uat-env.mjs`; restore identity now derives from active PostgreSQL URL.
- Targeted 15/15 PASS; dependency-free regression 831/831 PASS. Human Stage-20 remains PENDING.

## 2026-09-23 — GitHub UAT seed identity/profile root fix
- Fixed GitHub UAT bootstrap fixture IDs to standards-valid deterministic UUIDs accepted by hardened seed validation.
- Isolated build-gate SQLite compatibility preparation with `SEED_MODE=demo` so PostgreSQL bootstrap identity does not leak into SQLite DB preparation.
- Kept PostgreSQL seed hardening, DB smoke, exact-artifact, browser UAT, and Stage-18/19/20 gates fail-closed.

- GitHub build-gate root fix: SQLite compatibility DB prepare now forces `NODE_ENV=test` together with `DATABASE_PROFILE=sqlite` and `SEED_MODE=demo`, preventing staging seed policy from misclassifying the isolated SQLite rehearsal while preserving production semantics for the final six-app build.

## F12R Operational UI correction — 2026-09-23
- Human visual acceptance reopened F12: the prior polish still forced horizontal table/navigation scrolling, inherited oversized checkbox sizing, stacked redundant Admin navigation, and left excessive operator whitespace.
- Corrected presentation only across Admin/POS/Storefront/Employee Portal; F2-F12 business authority and API contracts remain unchanged.
- Admin workspace rail was removed from rendering; domain navigation wraps, checkboxes are compact, desktop tables fit the viewport, and narrow screens stack labeled cells instead of horizontal panning.
- POS uses denser high-mobility product/cart layout and non-scrolling 2-column mobile workspace navigation. Employee Portal tables/nav and Storefront catalog are likewise viewport-bound.
- Regression contract was strengthened: UI-P1 now rejects rendering the redundant workspace rail instead of requiring it.
- Validation: focused 7/7 PASS; workflow validation PASS; repository validation PASS (180 Prisma models); dependency-free regression 841/841 PASS. Frontend lint/build not run in sandbox because `next` dependency is absent; run local `npm run uat:pre-github:local` after applying.
- Human Stage-20 remains blocked until visual acceptance of this F12R candidate.

## 2026-09-23 F12R2 visual reopening
- Human visual acceptance rejected the previous F12/F12R result as cluttered and visually dated.
- F12R2 removes decorative gradients, standardizes Lucide icons, and keeps one-accent flat operator surfaces.
- Functional/business contracts remain unchanged; rerun local candidate gate and GitHub full-system simulation before Human Stage-20 resumes.

## 2026-09-23 F12R3 full UI + GitHub UAT reopening
- Active work item: `T360-20260923-221011-full-ui-tailwind-and-github-uat-expansion` (HIGH risk, VERIFICATION).
- Full audit baseline: seluruh repository snapshot dibaca/inventaris; current source audit menemukan 401 Nest HTTP handlers dan 278+ operator interactive controls.
- Empat operator surfaces sedang dipindahkan ke Tailwind CSS v4; legacy layered CSS override tidak lagi canonical.
- Admin information architecture memisahkan Tenant/User/System, Telegram/WhatsApp/provider/owner reporting, dan AI/Forecast agar operator tidak perlu mencari fitur di panel campur-aduk.
- GitHub UAT diperluas dengan full repository audit, UI control audit, all-OpenAPI runtime sweep, browser all-navigation + 3-viewport geometry sweep + screenshots, Telegram/WhatsApp/owner-digest E2E provider simulator, serta optional protected live Telegram smoke.
- Business/domain authority tidak dipindahkan atau dilemahkan. Human Stage-20 tetap BLOCKED sampai source baru lulus local/full GitHub gates dan visual acceptance.
- Tailwind dependency lock/build belum dinyatakan PASS sampai dependency install dan production build benar-benar berhasil.

## F12R4 full UI architecture rebuild — 2026-09-24
- Operator rejected the prior F12/F12R layered presentation; visual acceptance is FAIL and Human Stage-20/release remain BLOCKED.
- Admin is being rebuilt to one primary sidebar + one contextual secondary navigation + one content surface. Explicit top-level operator homes now include AI & Automation, Integrations & Notifications, Tenant & Organization, and Settings & Access.
- All four presentation foundations are canonical Tailwind CSS v4 stylesheets rather than appended legacy overrides; primary horizontal scrolling and decorative gradients are forbidden.
- UI source audit now locks 14 Admin top-level workspaces, critical Telegram/WhatsApp/AI/settings destinations, and rejects inert controls or reintroduced legacy navigation layers.
- F12R3 deep GitHub UAT work remains authoritative and must not be weakened: repository/UI audit, PostgreSQL migration/runtime, exact build, all-navigation browser geometry/screenshots, API sweep, provider simulation, worker/report, Stage-18/19/20, staging/load/index/DR.
- Verification still required before push: workflow/repo/full-repo/UI audit, focused F12R4 regression, full dependency-free regression, then local candidate TypeScript/DB/build on the operator repo.
