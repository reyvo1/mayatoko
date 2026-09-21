# CURRENT WORK — TOKO360

Updated: 2026-09-21 (Asia/Makassar)
Checkpoint type: **GITHUB RUN #6 PATCH — POS ORIGIN/CORS + DR SCRATCH + SECURITY CANDIDATE FIXES**
Version remains: `0.5.3`.
UI cosmetics remain deferred; functional correctness and runtime proof remain the priority.

## Verified state

- GitHub full-system log `logs_96435823574.zip` advanced substantially: exact build artifact remained valid and most runtime/staging gates passed.
- GitHub gate outcomes from that run:
  - PASS: build/artifact identity, critical UAT coverage, restore DB creation, Stage-18, payroll migration, Stage-19 (**11/11**), persistent runtime start, worker runtime probe, staging certification, load smoke, index profile, Stage-20 prepare, Stage-20 automated, UAT-candidate fail-closed proof, exact-artifact preservation/transport.
  - FAIL: production dependency audit (**12 high/critical**), built-browser POS online bootstrap, PostgreSQL DR rehearsal.
- POS root cause patched at CI contract level: browser surfaces and API now use one `localhost` host family matching `CORS_ORIGINS`; CI preflight rejects future browser-origin/CORS mismatch. Browser UAT also records POS body/origin/in-page health diagnostics if bootstrap still fails.
- DR root cause patched without weakening production safety: source DB still requires TEST/STAGING marker; isolated restore target may use explicit `restore`/`dr`/`scratch` marker and still must differ from source and reject prod/live.
- Security proposal remains isolated and authoritative audit remains blocking. Candidate plan now patches production Nest runtime peers while deliberately keeping Nest CLI/schematics on the committed v11 toolchain so the proposal is not blocked merely by Nest 12 schematics requiring TypeScript 6. A second candidate still tests the audit-suggested Prisma 6.12 pair only as a diagnostic.
- Full dependency-free regression **673/673 PASS** using four deterministic chunks.
- Focused changed-path tests **18/18 PASS** before full suite; new run-6 contract tests included in the 673 total.
- Workflow validator **21/21 PASS**.
- Repository validator **782 files / 173 Prisma models PASS**.
- GitHub YAML parse **5/5 PASS**.
- Source fingerprint before final context regeneration: `d7686ad5a72ec2cfc680c591ca839c8cc68142fe529ceecea0f6a84286c6ba6c`.

Quality record: `handoff/quality/github-run6-pos-dr-security-fixes-20260921.md`.

## ACTIVE NEXT WORK

1. Overlay/push this patch and rerun `Toko360 Full System Simulation`.
2. Confirm built-browser passes POS authenticated online/offline-config bootstrap with aligned localhost/CORS origins. If not, use `posDiagnostic` evidence (browser origin, body text, in-page health fetch) rather than guessing.
3. Confirm PostgreSQL DR rehearsal accepts isolated `toko360_dr_restore` and proceeds through backup/checksum/restore/smoke.
4. Inspect isolated security proposal output. The committed production dependency audit must remain red until a reviewed package manifest/lock is actually adopted and survives deterministic install, Prisma, regression, six-app build, PostgreSQL integration, browser UAT, and the rest of this pipeline.
5. Do not rebuild the exact tested artifact between build and runtime gates.
6. Human Stage-20 UAT remains mandatory even if automated Stage-20 is green.

## Do not claim yet

- dependency audit PASS on committed source;
- full GitHub simulation PASS;
- UAT candidate;
- production ready.

Production is not touched by this workflow.
