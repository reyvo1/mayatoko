# CURRENT WORK — TOKO360

Updated: 2026-09-21 (Asia/Makassar)
Checkpoint type: **MACRO-CHECKPOINT — GITHUB HEAVY RUN #1 BUILD/COMPILE FIX, READY FOR RERUN**
Version remains: `0.5.3`.
Planned output: `toko360-github-run1-build-fix-checkpoint-20260921.zip`.
UI cosmetics remain deferred; runtime proof and functional correctness remain priority.

## Continuity

This tree continues directly from `toko360-github-full-system-test-farm-checkpoint-20260916.zip` and from the first real GitHub heavy run at commit `b4777a1d7e36f57b9b48e3633a584ffdbd36339d`.

Do **not** restart W0-W7 or broad source audit. Fix only concrete GitHub failures until the full-system simulation is green.

## GitHub heavy run #1 — actual result

The first GitHub run proved the external test environment works far beyond the old chat-container limitation:

- PostgreSQL 16 service became healthy;
- matching PostgreSQL client tools installed;
- Chromium discovery succeeded;
- npm registry/DNS worked;
- deterministic `npm ci` installed **710 packages**;
- workflow validator passed **21 / 8 waves**;
- run then failed at TypeScript lint/build gate before artifact creation.

Primary root cause: project-specific Prisma Client was not generated before TypeScript lint. The resulting ~1,500 API TypeScript errors were largely a generated-client cascade. Three independent Admin compile errors were also exposed and fixed.

Quality evidence: `handoff/quality/github-run1-build-compile-fix-20260921.md`.

## Completed in this macro-fix

1. `build:gate` generates the PostgreSQL Prisma Client before lint/workspace tests.
2. SQLite compatibility rehearsal still occurs before artifact creation, followed by final PostgreSQL regeneration before six-app build.
3. PR CI also generates PostgreSQL Prisma Client before tests and restores PostgreSQL client after SQLite rehearsal before build.
4. Delivery lifecycle inspection fallback now has an explicit result shape including optional `templateItemId`.
5. Payroll liability rows use explicit typed tuples so `LiabilityBucket` cannot leak into React row cells.
6. Owner inventory valuation uses a type-safe object guard/helper instead of direct access through `Record<string, unknown>`.
7. Heavy workflow build failure is diagnostic-aware: dependency audit, 12-scenario coverage and Docker Compose validation still run before artifact-dependent stages are stopped.
8. Regression guards were added for the build order, PR-CI order, Admin compile fixes and diagnostic barrier.

## Local validation on the fixed source

- Dependency-free regression: **653/653 PASS** (chunked execution).
- Focused first-run/build/workflow suite: **44/44 PASS**.
- Workflow validator: **21/21 PASS**.
- Repository validator: **773 files / 173 Prisma models PASS** before final handoff regeneration.
- GitHub workflow YAML parse: **5/5 PASS**.
- Changed Admin TSX syntax transpile: **3/3 PASS**.
- Source fingerprint: `b594587e89e3f952280e37ebe31f24266aee021d6aa465f83bebd299194f5c6c` across **500** executable/config/test files.
- package-lock SHA-256: `f08fd71c1a85921cd3953c735dfc748cec9f0405e4104de7a90b5f64edd76e73`.

## ACTIVE NEXT WORK

1. Replace/update the local Git checkout with this fixed checkpoint source.
2. Run `npm run ci:preflight:local` if dependencies are available; otherwise the already completed dependency-free gate above is the local baseline.
3. Commit and push to GitHub `main`.
4. Let `Toko360 Full System Simulation` finish. Do not stop at the first diagnostic warning.
5. Download/share the new Actions logs + `toko360-full-system-evidence-<sha>`.
6. If build succeeds, preserve `toko360-tested-runtime-<sha>`; from that point fix the next concrete runtime/DB/browser/Stage failures only.
7. Repeat until automated full-system simulation PASS, then human Stage-20 UAT on the same source/artifact/DB.

## Claims still forbidden

- GitHub six-app build PASS after this fix;
- exact artifact PASS;
- browser/runtime PASS;
- Stage-18/19/20 PASS;
- UAT candidate;
- promotion/production ready.

The next meaningful truth comes from the GitHub rerun on fingerprint `b594587e89e3f952280e37ebe31f24266aee021d6aa465f83bebd299194f5c6c`.
