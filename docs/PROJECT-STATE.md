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
