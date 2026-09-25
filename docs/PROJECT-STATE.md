> **Canonical product status:** `config/product-completeness.json` is the only machine-readable completion authority. Historical recovery/F1/F12 status below is evidence/context, not proof of product completeness.

# Toko360 Project State

## Official checkpoint

```text
RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF
```

## Baseline

- Version: 0.5.3
- Development profile: SQLite, tanpa Docker
- Production profile: PostgreSQL
- GitHub PostgreSQL validation: tersedia
- Development workflow: aktif
- One-click work automation: aktif
- Embedded system instructions: aktif, maksimal 8.000 karakter
- Dynamic first-chat/session handoff: aktif
- Active work items: lihat `work-items/active/`
- Completed work items: lihat `work-items/completed/`

## Source of truth

1. `instructions/SYSTEM-INSTRUCTIONS.md`
2. `docs/DEVELOPMENT-KIT.md`
3. `docs/DEVELOPMENT-WORKFLOW.md`
4. `config/module-delivery-map.json`
5. `config/workflow-policy.json`
6. Work item aktif
7. Commit/tag checkpoint resmi

## Aturan melanjutkan

- Jangan memakai ZIP/checkpoint yang lebih lama sebagai baseline.
- Jalankan `npm run workflow:validate` dan `npm run validate:repo` sebelum perubahan.
- Gunakan `pindah-akun-atau-chat.cmd` sebelum berpindah akun/chat.
- Jangan mengubah database production dengan `db push`, reset, atau seed demo.
- Perbarui file ini hanya ketika checkpoint resmi baru diterbitkan.

## Active reopening — 2026-09-24 F12R4

Human visual acceptance kembali menolak presentasi F12R3 karena information architecture masih bertumpuk, beberapa capability sulit ditemukan, dan usability operator belum layak. Work item aktif `T360-20260923-221011` kini melakukan full UI architecture rebuild: satu Admin primary sidebar + satu contextual subnav, explicit Tenant/Organization, Settings/Access, Integrations/Notifications (Telegram/WhatsApp), AI/Automation, dan canonical Tailwind CSS v4 pada empat frontend. Deep GitHub Full UAT dari F12R3 tetap dipertahankan dan tidak boleh dilemahkan. Semua automated green evidence sebelum source rebuild ini adalah historical evidence dan tidak boleh dipakai untuk menyatakan source baru release-ready; Human Stage-20 tetap BLOCKED sampai visual acceptance baru lulus.

## Recovery R0 — 2026-09-24

Deep functional/UI/workflow audit reopened product completeness after human inspection and source reconciliation found 48 explicit gaps across truth/governance, tenant/access, HR/payroll, reporting/integrations, core hidden flows, assets/fleet, scale/AI, UI information architecture, and runtime UAT depth. The authoritative recovery work item is `T360-20260924-020700`. `config/recovery-finding-matrix.json` maps **48/48 findings, 0 unmapped** to R0–R8.

Current source baseline is HEAD `c391fc9fd8c42cb6352317853718cba1415a9603` plus the preserved uncommitted F12R4 working-tree changes. F12R4 work item `T360-20260923-221011` is now **BLOCKED**, not rejected or reverted: its presentation changes remain available, but final UI verification cannot resume until R1–R6 functional/operator-flow prerequisites stabilize.

Current generated counts: 180 Prisma models, 405 API handlers, 295 UI interactive elements; `audit:recovery` fails closed when these source-shape counts change without regenerating the R0 recovery matrix. Human Stage-20 remains BLOCKED/PENDING and no historical green run may be used as release evidence for recovered source.

## Recovery R1 — 2026-09-24

R1 is **CLOSED** on exact GitHub runtime commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`. Full System Simulation, Full Automated UAT, `ci:r1:probe`, PostgreSQL migration rehearsal, exact six-app build, runtime API sweep, Built Browser UAT, Telegram/WhatsApp provider simulation, worker/report probe, Stage-18, Stage-19, automated Stage-20, and aggregate automated gates passed on current R1 source. Human Stage-20 remains a separate PENDING gate and was not replaced by automation.

F07–F10 are runtime-closed by that evidence. No UAT assertion was weakened to obtain green; the final R1 fixes corrected real mobile layout, canonical nested navigation, and runtime-origin consistency while keeping fail-closed browser/provider gates intact.

## Recovery R2 — 2026-09-24

R2 is **CLOSED** on current green GitHub runtime evidence. The exact current-source chain passed `ci:r2:probe`, PostgreSQL runtime, six-app build, Built Browser UAT, Telegram/WhatsApp provider simulation, Stage-18, Stage-19, automated Stage-20, and aggregate gates. Human Stage-20 remains separate/PENDING. F11–F21 are runtime-closed for recovery sequencing.

## Recovery R3 — 2026-09-24

R3 is **IMPLEMENTATION** under `T360-20260924-195500-recovery-r3-reporting-integrations`. Scope is F22–F25, F29, F37, F39, F42–F44. The first implementation cluster fixes owner digest at the root: operator configuration is exposed, POST config/send require `notification.manage`, disabled digest cannot be manually sent, low-stock uses each product `minStock` without the old `available <= 10` prefilter, and configured recipients are verified/non-revoked Telegram `EmployeeChannelBinding` IDs rather than raw destination strings.

The GitHub provider simulation is strengthened to create and verify an employee Telegram binding through the real Employee Self-Service API and provider simulator before configuring/sending the owner digest. R3 remains open until the remaining integration/operator findings and current-source runtime/browser/provider evidence pass.

## Recovery R4 — 2026-09-24

R4 automated runtime is **CLOSED** on exact green baseline `4963f8acdf8b5a63a8cc79caad5162dcf26c3808`. R3 remains independently OPEN. R4 uses existing domain authority rather than replacing it: InventoryMovement remains append-only ledger truth, goods-receipt rejection remains pre-posting only, General Ledger reads posted journals, and promotion checkout remains server authoritative.

The only R4 schema expansion is `Supplier.isActive Boolean @default(true)` with SQLite/PostgreSQL parity. Inactive suppliers are excluded from new procurement but historical supplier transactions remain readable. Storefront environment branch code is bootstrap fallback; runtime users may switch among active sibling branches discovered from a current valid branch anchor. Human Stage-20 remains PENDING and separate from automated closure.

## Recovery R5 — 2026-09-25

R5 is **VERIFICATION** under `T360-20260925-000500-recovery-r5-assets-fleet`. Master scope is F31 `AssetMaintenancePlan` management, F32 `VehicleDriverAssignment` lifecycle, and F33 asset assign/transfer/dispose operator flow. R5 depends only on closed R1, so open R3 findings F29/F37/F39/F42/F43 do not block this wave.

R5 reuses the existing AssetMaintenancePlan and VehicleDriverAssignment schemas with no migration. Admin now exposes maintenance-plan lifecycle, driver assignment lifecycle, asset assignment, explicit Asset handover inspection, transfer, and disposal/sale. Transfer/disposal still require a PASSED/APPROVED inspection; the UI does not auto-pass the gate. F31/F32/F33 remain OPEN_REVALIDATION_REQUIRED until the new exact-source PostgreSQL `ci:r5:probe` and aggregate GitHub gates pass. Human Stage-20 remains PENDING.

## 2026-09-25 — R5 runtime closure / R6 verification

R5 F31/F32/F33 is runtime-closed on origin/main commit `708d34cb7afd259c507844cadf065b23029797ec`. GitHub `ci:r5:probe` PASS is bound to source fingerprint `91f5b3910bed430d5a682fb53a3ce8baf050884674be56269eb39af309781655` (629 files); both full-system workflows are green and Human Stage-20 remains PENDING.

R6 is now the active recovery wave. F26-F29 are source-implemented but require exact PostgreSQL runtime evidence before closure. F30 is recognized as runtime-closed by the R4 AccountingCloseControl close/block/reopen/post probe. R3 remains open for F37/F39/F42/F43; F29 moves to R6 verification because its secondary-wave runtime contract is now implemented here.

## 2026-09-25 — R6 runtime closure / R3 residual verification

R6 F26/F27/F28/F29 is **RUNTIME CLOSED** on exact GitHub commit `bd4abf386c56bce283f10c08ff988ea109909b54`, source fingerprint `1d07234c2f58891d1cf95309c65d4465d8c1bb4cb67b77bc4e9e233ae2c274c6` (631 files). Full System Simulation, Full Automated UAT, `ci:r6:probe`, aggregate release gates, and automated Stage-20 PASS. F30 remains runtime-closed by canonical R4 AccountingCloseControl evidence. Human Stage-20 remains **PENDING 12/12** and is not replaced by automation.

R3 is now **VERIFICATION** for residual F37/F39/F42/F43. Admin Integrations exposes payment-provider diagnostics, multi-outlet and cashier-target reporting, device sync receipt/offline-transaction diagnostics with acknowledgement/requeue operations, and marketplace order list/import. The new device diagnostics read route is authenticated tenant/branch scoped. Both PostgreSQL GitHub workflows execute `ci:r3:residual-probe`; these four HIGH findings remain `SOURCE_IMPLEMENTED_RUNTIME_EVIDENCE_PENDING` until exact-source runtime evidence passes. R7 remains blocked on R3 closure.

## 2026-09-25 — R3/R4 closure and R7 verification

Exact checkpoint `abac92662cab4cc7352de4f9f9d2e2419aad9c29` / source fingerprint `5006faaa354e32cdcfd952388a8dff76c712693835178ff53ff918875bf22615` passed Full System Simulation, Full Automated UAT, R3 residual probe, R4 core-business probe, provider/runtime gates, and automated Stage-20. R3 residual F37/F39/F42/F43 and R4 F34/F35/F36/F38/F40/F41 are therefore runtime-closed for sequencing. Human Stage-20 remains PENDING and separate.

R7 is now **VERIFICATION** under `T360-20260923-221011`. Primary scope is F45 canonical chart strategy and F46 final information architecture/operator discoverability. Admin retains exactly one primary sidebar plus one contextual secondary navigation. Dashboard analytics now use reusable canonical chart primitives rather than ad-hoc SVG colors/gradient behavior. Both PostgreSQL workflows require `ci:r7:probe`, which consumes exact-source Browser UAT evidence for all 14 Admin workspaces, contextual destinations, canonical analytics, screenshot evidence, and responsive no-overflow matrices across Admin, POS, Storefront, and Employee Portal. R8 must not start until this atomic R7 wave is committed/pushed/clean and exact-source R7 Browser UAT evidence passes.

## 2026-09-25 — R8 source implementation

R8 source implementation is prepared on checkpoint `5c9558c65a95a5000482decfc0f9185de042ffe3` while R7 remains exact-source VERIFICATION. F04/F05 now have explicit source-contract versus runtime-evidence separation; F06 has mandatory two-domain safe Browser mutation evidence; F23/F24/F25/F44 have a dedicated PostgreSQL runtime probe with cleanup/restoration. Both GitHub PostgreSQL workflows are wired for R8 reporting/security and final exact-source release evidence. R8 must not be classified CLOSED until current-source R7 and R8 GitHub evidence are PASS. Human Stage-20 remains PENDING.

## 2026-09-25 — Post-audit Product Completion Workflow activated

The 957/957 full functional/UI/script audit supersedes automated-R0-R8-green as the definition of product completeness. Automated recovery evidence remains valid engineering evidence, but the product is classified **NOT FUNCTIONALLY COMPLETE / NOT HUMAN-UI ACCEPTED** until the new P0-P7 product-completion workflow closes.

Active workflow: `docs/TOKO360-MASTER-PRODUCT-COMPLETION-WORKFLOW.md`.

Immediate order: P0 truth/security/hygiene -> P1 Admin contextual workflow isolation -> P2 Multi-UOM + payroll completeness -> P3 hidden capability productization -> P4 canonical/legacy cleanup -> P5 page-level visual rebuild -> P6 Ubuntu/operator hygiene -> P7 exact-runtime + Human Stage-20 acceptance.

Historical `docs/TOKO360-MASTER-RECOVERY-WORKFLOW.md` remains preserved as recovery history and runtime evidence sequencing, but does not override the new product-completion verdict or permit source-marker/browser-no-overflow evidence to substitute for real operator/human acceptance.

## P1 Admin contextual workflow isolation — 2026-09-25
- P0 atomic source is complete; active product-completion phase moved to P1.
- 62/62 Admin contextual destinations now have explicit canonical renderer mappings in `config/admin-contextual-workflow-map.json`; Customer is split from Category/Subcategory after operator discoverability review.
- Six previously non-isolated workspaces and two partial workspaces now route active contextual destinations into dedicated component modes.
- P1 canonical navigation root and 62-route category/customer correction are runtime-verified by green exact-source Browser/R7 evidence. Human IA/Stage-20 acceptance remains a separate pending gate; user explicitly authorized continuation into Product Completion phases while preserving that human-pending truth.

## 2026-09-25 — P1 runtime verification / P2A Multi-UOM source implementation

P1 canonical Admin routing including the 62-route Master Data Category/Subcategory vs Customer split is runtime-verified on exact-source commit `abac92662cab4cc7352de4f9f9d2e2419aad9c29`: Browser UAT, Built Browser UAT, R7/R8, worker/API/runtime sweeps, Stage-18, Stage-19, automated Stage-20 and aggregate gates passed. Human IA/Stage-20 acceptance remains a separate PENDING gate and is not replaced by automation. The user explicitly instructed continuation, so current implementation work advances to P2 while preserving that human-pending truth.

P2A source implementation centralizes POS/storefront selling-UOM resolution in `apps/api/src/common/transaction-uom.ts`; expands OrderItem, OrderReturnItem, SaleReturnItem and PurchaseReturnItem with immutable UOM lineage; keeps inventory/serial/batch quantities in integer base units; carries selling-UOM snapshots into shipment/accounting traceability; and makes Storefront product/cart/return flows UOM-aware. Historical return/refund logic copies source snapshots and never reconstructs OrderReturn conversion from current ProductUnit configuration. A-03 is `IMPLEMENTED_RUNTIME_PENDING` until the required exact-source PostgreSQL mixed-UOM order -> fulfill -> ProductUnit-change -> return/refund journey passes with inventory/accounting/tax invariants.


## 2026-09-25 — P2 FULL source implementation

P2 is now executed as one atomic delivery wave rather than separate operator-facing P2A/P2B waves. Multi-UOM persistence/runtime proof and Payroll method/split-period completeness ship together. P2 source adds historical transaction-UOM authority and required mixed-UOM PostgreSQL probe; Payroll adds executable GROSS/GROSS_UP/NET, temporal amount allocation for effective-dated component/profile/rule changes, operator method selection, and an exact-source PostgreSQL probe that posts payroll, settles salary, creates a post-payment differential adjustment, creates employee-receivable recovery, and settles that recovery.

A-03 and A-04 remain `IMPLEMENTED_RUNTIME_PENDING` until both dedicated P2 runtime evidence files pass on the exact source. P3 must not start until the P2 FULL wave is committed/pushed/clean and aggregate exact-source GitHub evidence is green. Human Stage-20 remains PENDING and is not auto-promoted by P2.
