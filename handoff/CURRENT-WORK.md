# CURRENT WORK — TOKO360

Updated: 2026-09-21 (Asia/Makassar)
Checkpoint type: **GITHUB RUN #7 PREP — FRESH SECURITY LOCK RESOLUTION**
Version remains: `0.5.3`.
UI cosmetics remain deferred; runtime proof and release safety remain the priority.

## Verified state

Latest uploaded GitHub full-system evidence proves the heavy automated stack is now healthy except for committed dependency security:

- PASS: deterministic install/build, exact artifact identity/transport, critical UAT coverage, Stage-18, payroll migration, Stage-19 **11/11**, built-browser Admin/Storefront/POS/Employee, worker runtime probe, staging certification, load smoke, index profile, PostgreSQL DR rehearsal, Stage-20 prepare and automated Stage-20.
- Built-browser now passes POS authenticated online/offline bootstrap and Employee Portal authenticated runtime.
- PostgreSQL DR now passes backup -> checksum -> isolated restore -> restored DB smoke.
- Load evidence: **600/600 successful, 0 errors, p95 30.59 ms**.
- Exact tested runtime artifact remained stable with build artifact ID `67c8003fb254230952fb8527caf5c83e446942fa878d7236c42afd542680d7b2`.
- FAIL remains only on the committed production dependency audit: **12 high/critical findings**.
- Human Stage-20 UAT is still explicitly **PENDING** and remains mandatory.
- Production was not touched.

Security proposal diagnosis:

- prior isolated candidates patched Next/Nest manifests but inherited the committed lock resolution graph;
- stale transitive resolutions (`deepmerge-ts`, `nanoid`, etc.) therefore remained despite declared overrides;
- proposal generation is now changed to create a **fresh lock from patched manifests**, with explicit verification that exact override versions actually resolve before audit;
- the checked-out package lock is never overwritten and the primary audit remains blocking.

Local validation of this patch:

- dependency-free regression **673/673 PASS**;
- focused security proposal tests **4/4 PASS**;
- workflow validator **21/21 PASS**;
- repository validator **783 files / 173 Prisma models PASS**;
- source fingerprint `cc90588955a6d1508e2fc3bc8abe65b9659560250a0d00b4075b54824fc2c17f`.

Quality record: `handoff/quality/github-run7-security-fresh-lock-prep-20260921.md`.

## ACTIVE NEXT WORK

1. Overlay/push the run #7 patch and rerun `Toko360 Full System Simulation`.
2. Inspect `handoff/quality/security-dependency-proposal/` from GitHub evidence.
3. Require a candidate with **0 high/critical** and successful exact override-resolution checks. Do not adopt a candidate merely because direct versions changed.
4. If a clean candidate exists, adopt its manifests + package-lock in a separate reviewed patch.
5. Rerun the complete heavy pipeline on the adopted lock: deterministic install, Prisma, 673+ regression, six-app build, Stage-18/19, browser, worker, staging/load/index, DR, automated Stage-20.
6. Only after committed dependency audit PASS may the automated full-system simulation become PASS.
7. Human Stage-20 UAT remains mandatory before UAT-candidate approval.

## Do not claim yet

- committed dependency audit PASS;
- full GitHub simulation PASS;
- human UAT PASS;
- UAT candidate;
- production ready.
