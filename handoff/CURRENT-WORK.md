# CURRENT WORK — TOKO360

Updated: 2026-09-21 (Asia/Makassar)
Checkpoint type: **GITHUB RUN #2 PATCH — COMPILE CONTRACT FIXES + ACTIONABLE DEPENDENCY AUDIT**
Version remains: `0.5.3`.
Planned macro-checkpoint output: `toko360-github-full-system-test-farm-checkpoint-20260916.zip`.
UI cosmetics remain deferred; functional correctness and runtime proof remain the priority.

## Continuity

This tree continues directly from:
`toko360-build-artifact-integrity-checkpoint-20260912.zip`
SHA-256: `342089900c42337b440706b9f49a81946935eba9ca35314258f54b4fad48c9ac`.

Do **not** restart W0-W7, inventory, Storefront, Delivery, reporting, payroll-adjustment, or prior release-gate work without concrete runtime regression evidence.

## Verified local state on this source tree

- GitHub run `96403546724` analyzed from uploaded Actions logs.
- Run #1 Prisma generation-order fix is confirmed effective: PostgreSQL Prisma Client generated before lint.
- Six remaining TypeScript/schema-contract failures fixed across Advanced Inventory, Payroll, Returns and Worker.
- Production dependency audit still reports 12 high/critical findings, but audit evidence now records exact packages/advisories/fix availability for the next run.
- Focused run #2 regression: **8/8 PASS**.
- Full dependency-free suite was attempted; local environment terminated after test 643 with all executed tests PASS. No full-suite completion is claimed for this patch.
- Workflow validator: **PASS — 21 work items / 8 delivery waves**.
- Repository validator before final handoff regeneration: **PASS — 773 files / 173 Prisma models**.
- Executable source fingerprint before handoff regeneration: `274e26323d4d1a135b8a26c2044e4c9a4020bbc5b1b8aa21990987c9c27dbcb6` across **501** executable/config/test files.

Quality record: `handoff/quality/github-run2-compile-audit-fix-20260921.md`.

## GitHub run #1 patch completed

- `scripts/run-build-gate.mjs` now generates the PostgreSQL Prisma Client before TypeScript lint/test.
- SQLite compatibility rehearsal remains before final artifact creation, followed by final PostgreSQL Prisma regeneration.
- PR CI now generates the correct Prisma Client before repository tests and restores PostgreSQL generation before production build after SQLite integration.
- Payroll liability rows use an explicit tuple type and no longer leak `LiabilityBucket` into ReactNode cell inference.
- Regression contracts prevent recurrence of both failures.


## GitHub run #2 patch completed

- `Product.baseUnit` query corrected to current `Product.unit` schema field.
- Payroll regular posting now omits optional `payrollReceivable` instead of passing `undefined` into a `Record<string,string>`.
- Order-return stock movement uses valid `SALE_RETURN` enum.
- Worker loyalty expiry no longer requests nonexistent `LoyaltyAccount.program`.
- Worker return reports scope through explicit branch warehouse IDs because `SaleReturn`/`PurchaseReturn` expose `warehouseId`, not a `warehouse` relation.
- Dependency audit evidence/logs now emit exact blocking package/advisory/range/directness/fix details via `AUDIT_BLOCKER` lines.
- Regression contracts were added for all six compile failures and actionable audit evidence.

## Completed in this macro-checkpoint

### GitHub full-system simulation is now the primary heavy test farm

`.github/workflows/full-system-simulation.yml` now runs one non-production chain on GitHub using PostgreSQL 16 and the exact six-app build artifact:

1. deterministic `npm ci` through the canonical build gate;
2. root/workspace regression, lint, SQLite smoke, Prisma SQLite/PostgreSQL validation/generation and six-app production build;
3. exact source fingerprint + exact build-artifact identity;
4. production dependency audit that blocks high/critical vulnerabilities;
5. 12/12 critical automated UAT coverage verification;
6. PostgreSQL bootstrap schema/seed;
7. Stage-18 ownership migration + backup/restore rehearsal;
8. payroll-adjustment PostgreSQL migration rehearsal;
9. Stage-19 HTTP/DB tenant integration without rebuilding the artifact;
10. built six-process browser UAT;
11. live worker report-job probe: queue -> worker `DONE` -> API CSV download;
12. staging certification, identity-locked load smoke and index profile;
13. PostgreSQL DR rehearsal to an isolated scratch DB;
14. Stage-20 automated checks while exactly 12 human UAT scenarios remain explicitly `PENDING`;
15. negative assertion that GitHub automation cannot self-approve UAT candidate;
16. exact-artifact mutation verification;
17. immutable GitHub runtime artifact upload, SHA-256 transport identity, logs/evidence upload and aggregate fail-closed summary.

### Exact-artifact behavior strengthened

- SQLite smoke now runs **before** the final PostgreSQL Prisma generation and artifact manifest.
- Stage-19, payroll migration and Stage-20 use preserve-artifact/`--skip-generate` paths after artifact creation.
- No Prisma regeneration is allowed after the build artifact becomes PASS in the heavy workflow.
- Next.js hidden `.next` outputs are explicitly included in GitHub artifact upload while `.next/cache` is excluded.
- GitHub immutable artifact digest is recorded as transport evidence.

### Browser/runtime coverage strengthened

- Admin: authenticated shell + Delivery Lifecycle + Payroll Lifecycle.
- Storefront: real Chromium render.
- POS: authenticated cashier shell + warehouse + live offline-config bootstrap.
- Employee Portal: CI-only employee identity fixture + authenticated attendance/payslip shell.
- Browser UAT fails on uncaught JavaScript runtime exceptions and captures a screenshot on failure when possible.
- API and worker participate in the six-process runtime; worker is proven with a real report job, not only a process-alive check.
- API and worker share explicit `REPORT_EXPORT_DIR`, fixing workspace-relative export divergence.

### Evidence integrity and GitHub efficiency

- Stage-18, Stage-19, payroll migration, index profile, Stage-20 and other current-source evidence paths invalidate stale `latest` evidence at attempt start.
- Full-system summary is always written, marks stale/missing evidence explicitly, and aggregate assertion fails the job at the end while allowing diagnostic gates to continue where safe.
- Release/tag workflow reuses the same full-system workflow rather than maintaining a second heavy test definition.
- GitHub workflows use read-only repository permissions and deterministic `npm ci`/npm cache.
- Heavy workflow intentionally does **not** provision unused Redis; the current queue backend is DB polling and is exercised directly.
- `RUN-GITHUB-PREFLIGHT.cmd` / `npm run ci:preflight:local` provide the cheap local pre-push gate.

## Current runtime evidence — intentionally not claimed locally

This macro-checkpoint is **ready to push to GitHub for heavy testing**, but GitHub heavy simulation has not yet run on source fingerprint `ce586efd67227ff72bdb14978136eefa8a8036d679ccfb12f3ac19c0035ebc84`.

Local `handoff/quality/github-full-system-simulation-latest.json` is expected to be `FAIL` / `LOCAL_PRE_GITHUB_VALIDATION`: it correctly marks build/runtime evidence from older fingerprints as `STALE` or `NOT_RUN` rather than reusing it.

Do **not** claim from this chat/container:
- deterministic dependency install/build PASS;
- PASS GitHub full-system simulation;
- PASS exact GitHub runtime artifact transport;
- Stage-18/19/20 runtime PASS on this source;
- UAT candidate;
- promotion ready;
- production ready.

Production is not touched by this GitHub simulation workflow.

## ACTIVE NEXT WORK — exact continuation point

1. Overlay/push this run #2 patch to GitHub.
2. Re-run `Toko360 Full System Simulation`.
3. Confirm the six compile failures are gone.
4. If dependency audit still fails, use the new `AUDIT_BLOCKER` package/advisory lines to upgrade exact affected dependencies in one batch.
5. Share the complete Actions logs/evidence bundle and continue only from concrete GitHub failures; do not restart broad source audit.

## Continuation rule

Read this file, `handoff/quality/latest.json`, `handoff/quality/github-full-system-simulation-hardening-20260916.md`, `handoff/quality/github-full-system-simulation-latest.json`, `.github/ci/README.md`, and `.github/workflows/full-system-simulation.yml`. Verify external ZIP SHA before editing. The next meaningful test result must come from GitHub Actions on this exact source, not another broad local audit.
