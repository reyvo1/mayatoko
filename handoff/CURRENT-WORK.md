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
