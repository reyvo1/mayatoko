# Toko360 — Status Proyek (2026-08-29)

> **Current continuation update — 2026-09-12:** source-functional closure remains preserved. Release evidence chain is hardened and full dependency-free regression is **565/565 PASS**. Current runtime gates remain fail-closed because this container cannot resolve `registry.npmjs.org`; therefore this tree is **not yet a UAT candidate and not production-ready**. The authoritative status is `handoff/CURRENT-WORK.md`.

> Working hardening update — 2026-09-11: source baseline aktif sudah melewati **Runtime / Staging Certification Hardening**, **UI/UX Final Cleanup**, dan **Protected Runtime/Certification Tooling Hardening**. Full static regression terbaru **342/342 PASS**; mock load runner 300/300 dan mock staging certification 6/6 PASS. Full Next.js/NestJS + PostgreSQL runtime dan visual browser certification tetap wajib dibuktikan di TEST/STAGING setelah dependency tersedia. Lihat `handoff/CURRENT-WORK.md` untuk status terbaru.

## AUTOMATION BACKLOG: 18/18 WORK ITEM SELESAI ✅

> Catatan penting: 18/18 di sini hanya berarti backlog automation/work-item yang terdaftar telah ditutup. Ini **bukan** pernyataan bahwa seluruh fungsi Development Kit sudah lengkap. Functional completeness dilacak terpisah di `docs/FUNCTIONAL-COMPLETENESS-W0-W2.md` dan handoff aktif.
- 18 work item RELEASED + CLOSED (termasuk value pack 2 T360-20260829)
- 1 work item RELEASE_READY: production readiness — DITUNDA, menunggu keputusan deploy Rey

## Value pack 2 (T360-20260829) — selesai
- Laporan peak-hours, dead-stock, customer-rfm
- Export CSV asinkron (worker + download)
- Fondasi promo (PromoRule + preview read-only), riwayat harga produk
- Struk digital: tombol WhatsApp + print CSS
- Endpoint ops-health (outbox/webhook/job)

## Integrasi vendor: DITUNDA (butuh credential)
- Payment gateway (QRIS), ekspedisi, WhatsApp BSP, marketplace sync, e-faktur

## Keamanan batch W0 (semua RELEASED + teruji UAT nyata)
- Tenant isolation, permission guard (86 endpoint ber-metadata)
- Atomic document numbering, idempotency receipts
- Serializable stock transaction + guarded decrement (zero oversell terbukti)
- Fiscal period close enforcement

## Aplikasi LIVE (dev lokal)
| App | Port |
|---|---|
| Admin (dark enterprise) | 3001 |
| POS Kasir | 3002 |
| Portal Karyawan | 3003 |
| Toko Online | 3010 |
| API | 4000 |

## Login seed lokal (development/test saja)
- Akun seed development tersedia melalui canonical seed. UI production-facing tidak lagi mem-prefill credential demo.
- Jangan gunakan credential seed/default pada production.

## Tooling penting
- Gate: `bash scripts/quality-full-safe.sh` (fix EPERM prisma lock Windows)
- Backup drill SQLite compatibility: `node apps/api/scripts/backup-drill.mjs` (delegates to canonical hardened backup/verify/restore tooling; no raw-copy fallback)
- Retention: `node apps/api/scripts/retention-cleanup.mjs`

## Menunggu keputusan Rey
1. Production deployment (VPS/credential)
2. Adapter vendor: payment gateway, ekspedisi, WhatsApp BSP
3. Revisi UI kalau ada yang kurang pas

Repo: github.com/reyvo1/tokojo (branch security/t360-*), semua push tanpa force.


## Runtime finalization checkpoint — 2026-09-11

Source-level runtime bootstrap diperkeras: npm installer lockfile/fail-fast, PostgreSQL production-safe bootstrap seed, canonical promotion permissions, seed-aware DB smoke, dan CI PostgreSQL bootstrap. Full workspace build tetap menunggu registry/dependency tersedia di TEST/STAGING.


## Protected runtime / certification tooling checkpoint — 2026-09-11

Staging sekarang fail-closed untuk JWT/CORS/master encryption key seperti production; webhook protected-environment tidak dikirim tanpa signing secret yang layak; load-test menolak threshold numerik invalid sebelum mengirim traffic. Dependency install nyata tetap tertahan `EAI_AGAIN registry.npmjs.org`, tanpa partial install.


## Recovery tooling compatibility hardening — 2026-09-11

- Legacy `apps/api/scripts/backup-drill.mjs` now resolves repository paths from its own file location and delegates to canonical `scripts/backup-database.mjs`, `verify-backup.mjs`, and `restore-backup.mjs`.
- The legacy raw SQLite copy fallback was removed; active WAL/journal now fails closed through the canonical guard.
- SQLite restore rehearsal requires a fresh target with no existing main/WAL/SHM/journal files.
- PostgreSQL restore isolation normalizes obvious loopback aliases (`localhost`, `127.0.0.1`, IPv6 loopback, trailing-dot localhost) before comparing the active target.
- Retention cleanup resolves repository configuration from the script location and rejects retention windows outside integer 1-3650 days (0/absent remains disabled).
- Dependency-free regression: **342/342 PASS**.
