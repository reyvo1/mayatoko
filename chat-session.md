# TOKO360 Chat Session

Updated: 2026-09-16 Asia/Makassar

## Progress completed

- Switched this project session to macro-checkpoints: large source batches locally, heavy runtime/container testing on GitHub Actions.
- Built the reusable `Toko360 Full System Simulation` as the primary heavy test farm.
- Preserved one exact six-app build artifact through PostgreSQL migrations, Stage-19/20, browser/runtime, staging/load/index/DR and GitHub artifact transport checks.
- Added production dependency audit, 12/12 critical automated UAT coverage mapping, stale-evidence invalidation and aggregate fail-closed reporting.
- Expanded Chromium runtime coverage across Admin, Storefront, authenticated POS and authenticated Employee Portal; uncaught JS errors now fail the gate and failure screenshot evidence is captured when possible.
- Proved the DB-polling worker with a real report job and fixed shared API/worker `REPORT_EXPORT_DIR` resolution.
- Consolidated tag/manual release testing onto the same reusable full-system workflow.

## Local test result

- Dependency-free regression: **647/647 PASS**.
- Focused GitHub/runtime/release suite: **89/89 PASS**.
- `ci:preflight:local`: **PASS**.
- Workflow validator: **21 work items / 8 waves PASS**.
- Repository validator: **769 files / 173 Prisma models PASS** before final handoff regeneration.
- Workflow YAML parse: **5/5 PASS**.
- Script syntax: **48/48 `scripts/*.mjs` PASS**.
- Critical UAT coverage map: **12/12 mapped**.
- Source fingerprint: `ce586efd67227ff72bdb14978136eefa8a8036d679ccfb12f3ac19c0035ebc84` / 497 files.
- package-lock SHA-256: `f08fd71c1a85921cd3953c735dfc748cec9f0405e4104de7a90b5f64edd76e73`.

## Ready state

The source is ready for a **GitHub heavy simulation push**. This is not a UAT-candidate or production declaration. The local summary intentionally reports stale/not-run runtime evidence until GitHub executes this exact source.

## Next steps

1. Push/upload this exact macro-checkpoint to GitHub.
2. Run/let `Toko360 Full System Simulation` finish.
3. Download/share `toko360-full-system-evidence-<sha>` and failing Actions logs. Preserve `toko360-tested-runtime-<sha>` if produced.
4. Fix only concrete GitHub failures in the next large batch; do not restart broad source audit.
5. Once automated simulation is PASS, perform human Stage-20 UAT on the same source/artifact/DB before UAT-candidate verification.
