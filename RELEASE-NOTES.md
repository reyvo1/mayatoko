
## Working UI productization update — UI-P1 Admin Application Shell (2026-09-22)

Admin now has a canonical workspace information architecture instead of a hard-coded single-page menu shell. Runtime navigation is module/feature/permission/UI-schema aware while API authorization remains authoritative. This batch is UI-only and does not change business transaction semantics or database schema.
## Working hardening update — UAT evidence chain integrity (2026-09-12)

- UAT candidate verification now requires deterministic Build PASS, built six-process browser wrapper PASS, inner browser PASS, and exact 12-scenario Stage-20 PASS on one source fingerprint.
- Built-browser and Stage-20 must reference the same hashed PostgreSQL target and evidence order is Build -> Built Browser -> Stage-20.
- Runtime-gate CI no longer names its artifact `release-candidate`; candidate status remains reserved for the final verifier after human UAT.
- Full dependency-free regression: **565/565 PASS**. Real runtime build remains blocked in this container by npm registry DNS `EAI_AGAIN`.

# Toko360 v0.5.3 — Embedded Instructions & Dynamic Chat Handoff

## Working hardening update — Local API compile recovery (2026-09-11)

- Real Windows execution reached live frontend dev servers and exposed seven API TypeScript errors.
- Fixed strict Prisma JSON typing, NestJS 429/body-parser typing, conditional accounting-map typing, offline receipt JSON casting, and generated Prisma schema drift for payroll settlement.
- Added `tests/api-local-compile-regression.test.mjs`; focused regression **7/7 PASS**, full dependency-free regression **350/350 PASS** before final packaging metadata.
- Existing Windows checkout should keep its installed dependencies and run Prisma generate + `db push` before rebuilding the API.

## Working hardening update — UI/UX Final Cleanup (2026-09-11)

- Admin, POS, Storefront, dan Employee Portal dibersihkan agar tidak menampilkan menu, status, promo, credential, atau metrik yang tidak mempunyai sumber runtime nyata.
- Loading/error/empty state dipisahkan; logout frontend merevoke server session; mobile navigation Admin dan stock-safe cart Storefront diperkuat.
- UI cleanup guard **10/10 PASS** dan full repository regression **321/321 PASS**.

## Working hardening update — Runtime / Staging Certification (2026-09-11)

- JWT session revocation + database-backed login throttling.
- Secret-at-rest encryption bootstrap for settings/integrations/webhooks.
- Multi-worker outbox/webhook lease recovery + stable delivery idempotency key.
- Non-production restore rehearsal, staging certification runner, load thresholds, and PostgreSQL index profiler.
- Existing pre-session JWTs require re-login after migration by design.


## Working hardening update — Protected runtime & certification tooling (2026-09-11)

- Staging and production now fail closed on weak/placeholder JWT secret, missing/wildcard CORS, and missing 32-byte encryption key.
- Webhook delivery in staging/production refuses to send unsigned or with a known placeholder/short signing secret.
- Load-test numeric arguments are range-checked before any request, closing a false-PASS path for `NaN` thresholds.
- Static regression is **333/333 PASS**; local mock load test completed **300/300** requests with 0 errors and staging certification passed all **6/6** checks.
- Real dependency install/build remains blocked only by npm registry DNS in the current environment; no runtime build PASS is claimed.

## Working hardening update — DR / Webhook Integrity (2026-09-11)

- Restore rehearsal now rejects semantically equivalent active SQLite/PostgreSQL targets before mutation.
- SQLite backup fails closed on active WAL/rollback journal and source mutation during copy, closing a proven stale-backup path.
- Webhook custom headers can no longer override/merge with Toko360 idempotency, delivery, event, signature, content-type, or user-agent headers.
- Focused regression **20/20 PASS**; full dependency-free regression **337/337 PASS**.
- Real npm build/PostgreSQL/multi-instance/receiver/DR gates remain pending because the current environment cannot resolve the npm registry.

## Working hardening update — Recovery Tooling Compatibility (2026-09-11)

- Legacy API backup drill is now a compatibility wrapper around the canonical hardened backup/verify/restore scripts and is safe to invoke from repository root.
- Removed the legacy raw-copy fallback that could bypass WAL safety and false-report a drill.
- SQLite restore requires a fresh scratch target and rejects pre-existing main/WAL/SHM/journal state before mutation.
- PostgreSQL restore treats common loopback host aliases as the same active database for isolation checks.
- Retention cleanup resolves config from script location and rejects unsafe retention-day values.
- Focused DR regression **11/11 PASS**; full dependency-free regression **342/342 PASS**.

## Official checkpoint

```text
RC0.5.3.1_EMBEDDED_INSTRUCTIONS_DYNAMIC_CHAT_HANDOFF
```

## Perubahan

- Instruksi sistem canonical tertanam dan divalidasi agar tidak melebihi 8.000 karakter.
- Adapter otomatis tersedia untuk `AGENTS.md`, GitHub Copilot, ChatGPT, dan clipboard.
- `pindah-akun-atau-chat.cmd` membuat konteks aktual dan menyiapkan dua tahap paste.
- `pindah-chat-saja.cmd` membuat chat pertama terbaru tanpa mengulang pemasangan instruksi sistem.
- Chat pertama membaca checkpoint, version, fingerprint, Git, database profile tersensor, work item, backlog, dan quality gate.
- Quality launcher menyimpan status terakhir untuk handoff.
- Tidak ada perubahan schema atau data bisnis.

## Catatan keamanan

Generator tidak menyalin nilai `.env`, credential, token, password, secret, database URL, biometric mentah, atau data pribadi.


## Runtime finalization addendum — 2026-09-11

Installer dependency sekarang deterministic (`npm ci`) dan fail-fast sebelum install bila npm registry/DNS tidak tersedia. PostgreSQL seed memakai bootstrap aman secara default dan tidak lagi membawa fixture/password demo ke staging/production. Lihat `docs/RUNTIME-FINALIZATION.md`.

## Local runtime seed correction — 2026-09-11

A real Windows setup completed `npm ci`, Prisma SQLite generation, and schema push, then exposed an internal demo-seed UUID mismatch. The deterministic demo company ID is now standards-valid and covered by regression. Existing local checkouts with dependencies already installed can resume from `npm run db:local:seed` without reinstalling packages.

## Working productization update — UI-P2 Admin Domain Workspaces (2026-09-22)
- Admin now supports deep-linkable nested operator workspaces instead of a single flat domain surface.
- Domain tabs and overview decks expose the existing backend foundation through clearer operator information architecture without duplicating business logic.
- UI-P1 was closed only after the GitHub full-system run passed; UI-P2 remains in VERIFICATION until its own GitHub simulation passes.

## UI-P3 POS modernization candidate
POS sekarang mempunyai operator workspace terpisah untuk penjualan, shift/kas, retur, dan sinkronisasi. Perubahan ini presentation-only; transaksi tetap memakai guard server-authoritative dan fail-closed behavior yang sama. Human UAT tidak diubah.

## UI-P4 candidate
Storefront kini mempunyai customer journey terpisah untuk discovery, product detail, checkout, dan account/order tracking. Pricing, stock reservation, fulfillment, payment, return, dan loyalty tetap authoritative di backend.

## UI-P5 candidate
Employee Portal sekarang mempunyai self-service workspace terpisah untuk dashboard, presensi, cuti, lembur, slip gaji, riwayat, dan profil. Perubahan bersifat presentation/information-architecture; employee scope, attendance evidence, approval, payslip access, dan Human UAT tetap authoritative/fail-closed.
