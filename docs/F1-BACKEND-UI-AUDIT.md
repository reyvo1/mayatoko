# F1 — Backend Capability vs UI Exposure Audit

Generated: 2026-09-22T18:00:01.798Z

## Repository scan

- Prisma models: 173
- API controllers: 36
- API routes: 358
- UI apps: admin, pos, storefront, employee-portal

## Classification summary

- EXPOSED: 4
- PARTIAL: 6
- HIDDEN: 0
- MISSING: 0
- UNKNOWN: 0

## F2–F11 capability matrix

| Phase | Capability | Status | Backend routes | UI apps | Gap |
|---|---|---:|---:|---|---|
| F2 | Master Product + Multi-UOM | **PARTIAL** | 14 | admin, pos | Multi-UOM berbasis barcode/factor sudah ada, tetapi ProductVariant dan model konversi UOM first-class belum terlihat sebagai model dedicated. F2 harus menormalkan master produk/variant/UOM tanpa merusak POS yang sudah memakai quantityFactor. |
| F3 | Inventory / batch / expiry / condition | **EXPOSED** | 19 | admin | Batch, serial, location, transfer, opname sudah kuat. Condition bucket general seperti AVAILABLE/DAMAGED/QUARANTINE/LOST belum terlihat sebagai inventory condition ledger first-class. |
| F4 | Accounting workspace enterprise | **PARTIAL** | 8 | admin | Accounting core kuat dan UI ledger sudah ada, tetapi posting rule/account mapping/version management serta source→event→journal→line drill-down belum terbukti lengkap di operator UI. |
| F5 | Tax workspace dinamis | **EXPOSED** | 6 | admin | Tax engine/model tersedia, tetapi tax transaction/document ledger, effective-dated rule management, preview, reconciliation, dan audit trail belum seluruhnya terekspos di UI. |
| F6 | Financial reporting + drill-down | **EXPOSED** | 20 | admin | ReportJob dan katalog report tersedia. F6 harus menambah dynamic filters, period comparison, branch/cost-center dimensions, dan report→account→journal→source drill-down. |
| F7 | AR / AP / Cash / Bank / Reconciliation | **EXPOSED** | 22 | admin | Operational AP/AR dan bank reconciliation sudah ada. Aging, statement/detail navigation, settlement trace, dan reconciliation operator flow perlu diperdalam. |
| F8 | Automation + scheduled reports | **PARTIAL** | 21 | admin, pos, storefront, employee-portal | Automation worker tersedia, tetapi scheduler/report schedule first-class dan operator execution history/rule management belum lengkap. |
| F9 | WhatsApp / Telegram notification center | **PARTIAL** | 4 | admin | Template, queue, Telegram worker, WhatsApp provider adapter, dan UI queue sudah ada. Provider setup/verification, channel binding UX, scheduled report destinations, retry diagnostics, dan production readiness masih harus dituntaskan. |
| F10 | AI / forecasting / operator assistant | **PARTIAL** | 2 | admin, pos | Forecast/reorder foundation ada. Operator assistant/AI explainability, permission-scoped context, anomaly insight, dan source-linked recommendation belum menjadi capability first-class. |
| F11 | Purchase / Sales / POS integration ke UOM baru | **PARTIAL** | 38 | admin, pos | Sales/POS multi-UOM sudah jauh lebih matang. Purchase request/PO/receipt masih berbasis orderedQty/unitCost tanpa purchase UOM conversion first-class; ini blocker utama F11. |

## Controller exposure inventory

| Controller | Routes | UI exposure | Apps |
|---|---:|---|---|
| `apps/api/src/accounting-core/accounting-core.controller.ts` | 8 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/advanced-inventory/advanced-inventory.controller.ts` | 12 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/app.controller.ts` | 1 | EXPOSED_OR_PARTIAL | pos |
| `apps/api/src/assets/assets.controller.ts` | 12 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/attendance/attendance.controller.ts` | 8 | EXPOSED_OR_PARTIAL | employee-portal |
| `apps/api/src/auth/api-keys.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/auth/auth.controller.ts` | 12 | EXPOSED_OR_PARTIAL | admin, pos, employee-portal |
| `apps/api/src/employee-self-service/employee-self-service.controller.ts` | 12 | EXPOSED_OR_PARTIAL | employee-portal |
| `apps/api/src/extensions/edge-sync.controller.ts` | 3 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/extensions/extensions.controller.ts` | 47 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/finance-operations/finance-operations.controller.ts` | 9 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/fleet/fleet.controller.ts` | 11 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/goods-receipts/goods-receipts.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/hr/hr.controller.ts` | 13 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/inventory/inventory.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/master-data/master-data.controller.ts` | 24 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/operations-control/operations-control.controller.ts` | 13 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/orders/orders.controller.ts` | 11 | EXPOSED_OR_PARTIAL | admin, storefront |
| `apps/api/src/payments/payments.controller.ts` | 2 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/payroll/payroll.controller.ts` | 23 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/platform/platform.controller.ts` | 32 | EXPOSED_OR_PARTIAL | admin, pos, storefront |
| `apps/api/src/products/products.controller.ts` | 5 | EXPOSED_OR_PARTIAL | admin, pos, storefront |
| `apps/api/src/promotions/promotions.controller.ts` | 4 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/purchase-orders/purchase-orders.controller.ts` | 3 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/purchase-orders/purchase-requests.controller.ts` | 7 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/reports/daily-digest.controller.ts` | 4 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/reports/multi-outlet.controller.ts` | 1 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/reports/reports.controller.ts` | 15 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/returns/returns.controller.ts` | 10 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/returns/storefront-order-returns.controller.ts` | 2 | EXPOSED_OR_PARTIAL | storefront |
| `apps/api/src/sales/cashier-target.controller.ts` | 2 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/sales/receipt.controller.ts` | 1 | HIDDEN_OR_API_ONLY | - |
| `apps/api/src/sales/sales.controller.ts` | 11 | EXPOSED_OR_PARTIAL | admin, pos |
| `apps/api/src/storefront-customer/storefront-customer.controller.ts` | 19 | EXPOSED_OR_PARTIAL | storefront |
| `apps/api/src/suppliers/suppliers.controller.ts` | 2 | EXPOSED_OR_PARTIAL | admin |
| `apps/api/src/users/users.controller.ts` | 8 | EXPOSED_OR_PARTIAL | admin, pos |

## Locked implementation order

F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11 → F12

F1 audit tidak mengubah business logic. Output ini menjadi source backlog functional completion berikutnya.
