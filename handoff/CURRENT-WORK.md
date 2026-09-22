# Toko360 — Current Work

Updated: 2026-09-22 Asia/Makassar

## Last closed work item
UI-P2 Admin Domain Workspaces is CLOSED from the user-confirmed green GitHub baseline:

`b1c561d97813f5e0916d194e0146cbec147a741e`

## Active work item
`T360-20260922-152500` — UI-P3 POS modernization dan operator workspaces.

Phase: VERIFICATION.

Implemented scope:
- reusable `PosShell`;
- workspace Penjualan;
- workspace Shift & Kas;
- workspace Retur;
- workspace Sinkronisasi;
- desktop sticky cart dan responsive mobile workspace;
- existing quote/payment/stock/shift/return/offline replay/idempotency/auth/tenant contracts tetap authoritative.

No database/schema/backend-business-logic change.

## UAT invariant
Human Stage-20 UAT tetap PENDING 12/12 sampai ada human evidence yang sah. Automated simulation tidak boleh mengubah status itu dan `uat:candidate:verify` tetap fail-closed.

## Next gate
Push UI-P3 dari baseline source nyata `b1c561d97813f5e0916d194e0146cbec147a741e`, lalu gunakan GitHub Full System Simulation sebagai heavy validator. UI-P3 tetap VERIFICATION sampai run tersebut hijau.


## UI-P4 current work — 2026-09-22

- Baseline source: `be8007ba2f7ba7f8d98a09a3acb6a2c783599988` (UI-P3 browser fix green).
- UI-P3 CLOSED berdasarkan GitHub Full System Simulation PASS; Human Stage-20 UAT tetap PENDING 12/12.
- UI-P4 Storefront productization aktif di phase VERIFICATION.
- Scope: reusable storefront shell, deep-link home/catalog/product/cart/account, catalog sort/search, detail product, checkout/account separation.
- Backend/schema/business rules tidak diubah. GitHub menjadi validator heavy build/browser/runtime/exact-artifact.

## UI-P5 current work — 2026-09-22
- Baseline source lokal exact: `4c336296fde105b425f94cdf4a5ab4968c0d4fb9`, working tree clean.
- UI-P4 masih VERIFICATION sampai current-main Full System Simulation yang sesuai commit productization/fix tersedia; tidak ditutup secara asumsi.
- UI-P5 Employee Portal productization aktif di VERIFICATION sebagai work item terpisah.
- Scope UI-P5: reusable EmployeePortalShell + home/attendance/leave/overtime/payslips/history/profile.
- Backend/schema tidak diubah; auth refresh, employee self-scope, attendance GPS/selfie/geofence, leave/overtime approval, dan payslip access tetap authoritative.
- Human Stage-20 UAT tetap PENDING/fail-closed.

## UI-P5 verification note
- Focused UI-P5 static regression: **5/5 PASS**.
- Changed TS/TSX transpile: **4/4 PASS**.
- Existing browser-uat tests were not claimed locally because the user-provided subset snapshot does not contain `scripts/browser-uat.mjs` / workflow files that those tests read.
- GitHub Full System Simulation remains authoritative for authenticated Employee Portal browser/runtime.
