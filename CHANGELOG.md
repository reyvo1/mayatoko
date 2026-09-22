
## 2026-09-22 — UI-P1 Admin Application Shell

- Added canonical Admin workspace routes and route-aware navigation.
- Admin navigation now consumes runtime module catalog, feature flags, JWT role/permission visibility, and Admin UiSchemaDefinition overrides.
- Added collapsible/searchable sidebar, breadcrumbs, company/branch context, and related-workspace rail.
- No database or business-logic changes.
# Changelog

## 2026-09-11 — Local API compile recovery

- fixed seven evidence-backed Nest/Prisma/strict-TypeScript compile failures found during real Windows startup;
- aligned `PayrollPayment` settlement fields across canonical, SQLite, and PostgreSQL schemas;
- added compile-regression guards for Prisma JSON contexts, Nest 429/body parser typing, order account maps, payroll schema parity, and offline replay JSON;
- no destructive migration or database reset is required; local Prisma Client regeneration + `db push` is sufficient.

## 2026-09-11 — Local demo seed UUID runtime fix

- fixed the deterministic demo company UUID so it satisfies the seed's own UUID version/variant validator;
- added regression coverage for the hard-coded demo seed UUID;
- real Windows evidence now proves registry access, deterministic `npm ci`, Prisma SQLite generation, and SQLite schema push;
- no schema or migration change.

## 2026-09-11 — Protected runtime + certification tooling hardening

- load-test numeric arguments now fail closed before traffic for NaN/non-finite/out-of-range values;
- staging now shares protected JWT, CORS, and secret-master-key requirements with production;
- protected-environment webhook delivery requires a non-placeholder signing secret before network send;
- PostgreSQL env example leaves runtime secrets/CORS blank instead of shipping passable placeholders;
- stage20 isolated staging runner now injects an ephemeral secret-master key and explicit CORS origin;
- regression expanded to 333/333 PASS; mock runtime proved load runner and six-step staging certification flow.

## 2026-09-11 — Runtime finalization: deterministic install & production-safe seed

- dependency installer fail-fast pada DNS/registry dan memakai `npm ci` dari lockfile;
- PostgreSQL/staging/production seed default ke bootstrap fail-closed tanpa fixture demo;
- password seed tidak dicetak ke log dan admin bootstrap wajib explicit/strong;
- `promotion.view/manage` ditambahkan ke canonical permission seed;
- PostgreSQL CI/release-candidate memakai bootstrap explicit dan smoke test menjadi seed-mode-aware;
- regression guard baru untuk keputusan di atas.


## 0.5.3 — UI/UX Final Cleanup & Runtime Truthfulness (2026-09-11)

- Membersihkan navigasi Admin sehingga hanya work area dengan view nyata yang tampil, termasuk mobile navigation dan penghapusan menu/health control dekoratif.
- Menghapus prompt browser native, credential demo prefill, angka Employee hard-coded, promo/rating storefront palsu, serta customer-facing MOCK_QRIS.
- Memisahkan loading/error/empty state pada modul operator dan mengubah Owner Suite ke local business date + jurnal POSTED language.
- Mengunci quantity Storefront ke stok, server-session revocation saat logout, dan warning degradasi customer directory POS.
- Menambahkan guard UI anti-regression dan dokumentasi `docs/UI-UX-FINAL-CLEANUP.md`.

## 0.5.3 — Runtime / Staging Certification Hardening (2026-09-11)

- Menambahkan server-side JWT session registry (`sid`) dengan logout current/all dan revocation real-time.
- Mengganti login throttle process-local menjadi database-backed rate limit lintas instance.
- Mengenkripsi secret settings, integration secrets, dan webhook headers at-rest dengan AES-256-GCM + master key server.
- Menambahkan migrator legacy plaintext secret, multi-worker outbox/webhook lease recovery, dan stable webhook `Idempotency-Key`.
- Menambahkan fail-closed restore rehearsal untuk TEST/STAGING, staging certification runner, load-test threshold evidence, dan PostgreSQL index profiler evidence-only.

## 0.5.3 — Asset & Fleet Accounting Reconciliation (2026-09-11)

- Mengunci acquisition business date/capitalization dan mewajibkan supplier untuk pembelian aset kredit.
- Mencegah depreciation run overlap/double-post dan menolak metode selain straight-line sampai implementasi resmi tersedia.
- Membuat maintenance completion atomik termasuk inspeksi, odometer, konsumsi inventory/batch part, jurnal biaya vendor, dan jurnal part.
- Menambahkan transfer aset intra-branch yang inspection-gated dan retry-safe tanpa jurnal nilai.
- Menambahkan sale/disposal dengan book-value reconciliation, output tax, gain/loss, serta menolak credit sale tanpa customer AR trace.
- Menguatkan trip/COD/odometer serta fuel receipt/evidence idempotency, supplier trace, business date, dan AP untuk BBM kredit.
- Menggabungkan supplier payable dari Goods Receipt, Asset acquisition, Maintenance Work Order, dan Fuel Transaction.
- Menambahkan summary/list endpoint Asset/Fleet, admin read model nyata, expand migration fuel supplier trace, dan regression guard Asset/Fleet.

## 0.5.3 — Core POS Integrity (2026-09-11)

- Menambahkan lifecycle shift kasir API + POS (current/open/close/recap) dan mewajibkan shift aktif untuk role CASHIER.
- Mengubah total POS menjadi server-authoritative quote; menghapus pajak 11% hard-coded dari frontend.
- Menambahkan idempotency retry stabil pada pembayaran POS dan proteksi PROCESSING dengan TTL.
- Memperbaiki expected cash agar hanya menghitung pembayaran tunai dikurangi refund tunai.
- Mengunci tax-code calculation storefront, POS, dan goods receipt ke company yang terautentikasi.
- Mengunci EventOutbox/sync pull ke company dan envelope branch serta menambahkan cursor paging.
- Mencegah retur penjualan kumulatif melebihi kuantitas terjual dan memperbaiki koreksi poin untuk retur parsial.
- Menambahkan akun seed CASHIER khusus POS dan regression test core transaction.

## 0.5.3 — Value Pack 2 (T360-20260829)

- Menambahkan laporan jam ramai (peak-hours), stok menganggur (dead-stock), dan segmentasi pelanggan RFM.
- Menambahkan eksekusi export CSV asinkron: worker memproses `ReportJob` (SALES/PRODUCTS) secara atomik dan hasil dapat diunduh via `GET /reports/jobs/{id}/download`.
- Menambahkan fondasi engine promo: model `PromoRule`, CRUD `/promotions`, dan preview diskon read-only (belum mengubah transaksi penjualan/pajak).
- Menambahkan `PATCH /products/{id}` dengan pencatatan otomatis `ProductPriceHistory` serta endpoint riwayat harga.
- Menambahkan tombol bagikan WhatsApp + CSS cetak pada struk digital publik.
- Menambahkan endpoint monitoring `GET /platform/ops-health` (outbox, webhook, report job, automation job).
- Menambahkan permission `promotion.view`/`promotion.manage` pada seed.
- Menghapus artefak stage lama yang sudah CLOSED (launcher cmd tahap 10/11/14, skrip inspeksi stage17, catatan v1.2.1).

## 0.5.3 — GROWTH PACK (T360-20260825)

- Notifikasi stok menipis real-time via Telegram (dedupe harian, ambang per `minStock`).
- Struk digital via link publik `/receipts/:saleNumber`, HTML mobile-friendly tanpa data biaya.

## 0.5.3 — Embedded Instructions & Dynamic Chat Handoff

- Added canonical project system instructions with enforced 8,000-character limit.
- Added AGENTS, Copilot, and ChatGPT instruction adapters.
- Added dynamic first-chat generator, clipboard launchers, secret-safe context snapshot, and quality-gate handoff record.
- Added automatic context refresh after setup/workflow/quality launchers.
- No business schema changes.

## 0.5.2 — One-Click Work Automation

- Menambahkan `mulai-pekerjaan-otomatis.cmd` dan memperbarui `buat-work-item.cmd` menjadi menu otomatis.
- Menambahkan backlog machine-readable berdasarkan Development Kit dan roadmap.
- Menambahkan dependency-aware next-task selection.
- Menambahkan pembuatan work item lengkap, branch Git, TASK, checklist, AI prompt, dan session handoff.
- Menambahkan resume/status launcher dan optional external-agent hook yang nonaktif secara default.
- Menambahkan validasi backlog, dokumentasi, checkpoint, dan quality governance untuk automation.

## 0.5.1 — Development Workflow Governance

- Menambahkan workflow pengembangan resmi berbasis Development Kit.
- Menambahkan delivery waves W0–W7 dan dependency/exit criteria setiap kelompok modul.
- Menambahkan work item manifest, CLI create/validate/status/advance/complete, serta machine-enforced impact checks.
- Menambahkan quality gates fast/full/release.
- Menambahkan issue forms untuk feature, bug, migration, integration, dan release.
- Menambahkan PR policy untuk branch, Conventional Commit title, work item, rollback, dan checklist.
- Menambahkan GitHub workflow governance dan release-candidate artifact dengan checksum.
- Menambahkan ADR, roadmap implementasi, checkpoint, contributing guide, dan Definition of Done.

# Changelog

## 0.5.0 - Enterprise accounting, tax, assets, fleet, and controls

- Applied one accounting/tax event engine across sales, orders, purchasing, receipts, returns, inventory, general finance, payroll, assets, fleet, and delivery.
- Added generic operational finance transactions, dynamic tax codes, versioned posting rules, and tax ledgers.
- Added movable/immovable asset lifecycle, depreciation, maintenance, and assignments.
- Added delivery vehicle, driver, trip, manifest, loading, gate pass, fuel, odometer, proof-of-delivery, and COD foundations.
- Added inbound/outbound inspections, evidence, confirmations, operation policies, and automation jobs.
- Changed goods receipts to inspection/confirmation before atomic stock and accounting posting.
- Added sale/purchase return accounting and tax reversals.
- Added accounting for stock transfers and stock-opname adjustments.
- Added enterprise documentation and repository tests.

## 0.3.2 - Windows process launcher fix

- Memperbaiki `spawn EINVAL` pada Windows saat Node.js menjalankan `npm.cmd`.
- Semua pemanggilan npm dari script Node sekarang melalui `cmd.exe /d /s /c` pada Windows.
- Memperbaiki setup, diagnosis instalasi, dan reset database lokal.
- Menambahkan pesan error eksplisit ketika command processor Windows tidak dapat dijalankan.


## 0.3.0 — No-Docker Local Development

- SQLite menjadi profil database lokal bawaan.
- PostgreSQL tetap tersedia untuk staging, production, dan GitHub integration test.
- Menambahkan schema Prisma SQLite dan PostgreSQL yang divalidasi agar selalu selaras.
- Menghapus kebutuhan Docker dari setup lokal dan memindahkan file container ke `.github/ci`.
- Menambahkan setup satu klik Windows, reset database, profile selector, dan local smoke test.
- GitHub Actions menguji repository, SQLite tanpa Docker, dan PostgreSQL service container.
- Worker lokal memakai database polling dan tidak membutuhkan Redis.
- Menambahkan panduan local no-Docker, database profiles, dan CI testing.

## 0.2.0 — Modular Foundation

- Development Kit lengkap bagian 1–36.
- Feature flags, dynamic settings, custom fields, server-driven UI, business rules, approval, API keys, webhooks, outbox, plugin SDK.
- Transfer gudang, opname, batch, serial, retur, loyalty, fiscal period, reconciliation, offline devices, forecasting, shipping, marketplace staging, notification queue.
- Worker, contracts, config package, Flutter customer starter, dan extended admin runtime configuration.

## 0.3.2

- Improved no-Docker Windows installer reliability and diagnostics.

## 0.3.3 - 2026-07-28

### Added
- Large-scale data architecture and million-record development kit.
- Cursor pagination helpers and core list endpoint pagination.
- Transaction/ledger indexes and aggregate/report/retention models.
- Dependency-free load test and manual GitHub performance workflow.
- PostgreSQL partitioning template and performance checklist.

### Changed
- Report profit/loss now aggregates in the database.
- Inventory valuation now uses cursor pagination.
- Frontends consume paginated product, supplier, inventory, PO, and receipt responses.

## 0.4.0

- Added HRIS, attendance, geofence, fingerprint/face device foundation, photo evidence, leave/overtime, payroll, tax/social rule engine, accounting posting, payslip delivery, and employee self-service portal.
- Added Telegram worker and configurable WhatsApp provider dispatch.
- Added biometric/privacy security documentation and vendor adapter templates.

### 2026-09-11 — Operations / Approval / Automation production-readiness hardening
- Approval requests gain explicit branch scope and sequential multi-step decisions with role/permission checks, self-approval prevention, and serializable concurrency guard.
- Webhook delivery gains HTTPS/private-network SSRF protection and response header redaction.
- Secret system settings are redacted from list APIs.
- Notification worker gains an atomic scheduling lease to reduce duplicate sends across workers.
- Fixed duplicate `dateOnly` declaration in worker report parsing.

### 2026-09-11 — Runtime DR / webhook integrity hardening
- Restore rehearsal canonicalizes active SQLite and PostgreSQL identities so equivalent URL/path forms cannot bypass the isolated-target guard.
- SQLite backup fails closed on non-empty WAL/rollback journal and source mutation during copy after a proof showed committed WAL data could be omitted from a checksum-valid main-file copy.
- Webhook endpoint custom headers cannot collide case-insensitively with reserved Toko360 integrity headers.
- Dependency-free regression: 337/337 PASS.

### 2026-09-11 — Recovery tooling compatibility hardening
- Replaced the legacy API backup drill implementation with a cwd-independent wrapper over canonical hardened backup/verify/restore tooling; removed raw SQLite copy fallback.
- SQLite restore rehearsal now refuses any pre-existing main/WAL/SHM/journal target state before mutation.
- PostgreSQL restore isolation now collapses common loopback aliases and trailing-dot localhost before active-target comparison.
- Retention cleanup now resolves repository config from the script path and validates retention-day bounds before purge queries.
- Dependency-free regression: 342/342 PASS.

## 2026-09-22 — UI-P2 Admin Domain Workspaces
- Closed UI-P1 after authoritative GitHub Full System Simulation PASS on `f8f79fda8aa10f98c0df332cb56951a89a98ebf0`.
- Added stable nested Admin operator routes for procurement, finance, people, assets/fleet, platform, inventory control, operations control, commerce, extensions, and master data.
- Added sticky secondary domain navigation, overview deck, contextual sub-workspace header, and third-level breadcrumbs.
- Invalid nested routes fail-safe to their canonical domain root; backend authorization and business APIs remain unchanged.

## 2026-09-22 — UI-P3 POS modernization
- Memecah POS menjadi workspace Penjualan, Shift & Kas, Retur, dan Sinkronisasi melalui reusable `PosShell`.
- Mempertahankan quote/payment/stock/idempotency/offline replay/auth guard lama tanpa perubahan business contract.
- UI-P2 ditutup berdasarkan baseline GitHub hijau `b1c561d97813f5e0916d194e0146cbec147a741e`.
- Human Stage-20 UAT tetap PENDING 12/12 dan tidak dapat dipenuhi automated simulation.

## UI-P4 Storefront productization
- Memecah storefront single-surface menjadi reusable shell + home/catalog/product/cart/account customer journeys.
- Menambahkan deep-link storefront route, catalog sort/search, product detail, dan responsive desktop/mobile navigation tanpa mengubah commerce API.

## 2026-09-22 — UI-P5 Employee Portal productization
- Memecah Employee Portal single-surface menjadi reusable shell dan self-service workspace home, attendance, leave, overtime, payslips, history, dan profile.
- Mempertahankan kontrak browser/login existing serta seluruh backend authorization/evidence/approval behavior.
- Human Stage-20 UAT tetap manual dan tidak diubah.

## UI-P6 server-driven Admin UI
- Added runtime-resolved nested Admin domain views.
- Admin UiSchema can hide/relabel/reorder canonical nested views only.
- Module/feature and role/permission visibility remains fail-closed at UI level; backend authority unchanged.
