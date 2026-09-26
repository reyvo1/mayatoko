# TOKO360 Post-Completion Hybrid Multi-Branch Edge Workflow

Status: **PLANNED / NOT STARTED**

Execution boundary: begin only after current P0-P7 product-completion workflow is closed, Human Stage-20 is accepted, release source is clean, and `PRODUCT_READY = true`. This roadmap must not interrupt P4-P7.

## 1. Target topology

TOKO360 will support a central-host + branch-edge topology:

- Central hosting: consolidation, owner/management access, cross-branch reporting, sync coordination, backup/DR metadata, release/control-plane responsibilities.
- Main store: one local TOKO360 server on LAN, plus POS/Admin/warehouse/mobile/kiosk clients.
- Every branch: its own local TOKO360 server on LAN with the same branch-edge profile.
- Branch operation remains local-first for declared critical capabilities when WAN/internet is unavailable.
- Reconnection synchronizes approved data/events with central hosting and other required peers through controlled server-side sync.

The central host and local nodes must not become competing business authorities. Domain ownership defined by the canonical TOKO360 services remains authoritative.

## 2. Synchronization contract

Synchronization must be implemented as a durable business-event/transaction protocol, not raw database replication by copy/overwrite. Minimum contract:

- globally stable event/operation identity;
- branch/node/source identity;
- tenant and branch scope on every synchronized operation;
- idempotent replay;
- durable outbox/inbox or equivalent delivery state;
- retry with bounded backoff;
- ordering/version rules where required;
- deterministic conflict policy per aggregate;
- dead-letter/reconciliation workflow;
- sync cursor/checkpoint and observable lag;
- audit trail from originating operator/device through applied canonical mutation;
- fail-closed handling for unknown schema/version or unauthorized peer;
- no direct cross-node table overwrite.

Inventory and accounting require especially strict ordering/reconciliation because duplicate replay must never double stock movement or journal posting.

## 3. Data ownership classes

Before implementation, every synchronized model must be classified into one of these ownership classes:

1. **Central-authoritative master:** centrally managed, branch-cached/read locally unless explicit delegated editing is allowed.
2. **Branch-origin transaction:** created at branch, immutable/append-oriented after canonical posting, synchronized centrally.
3. **Bi-directional controlled master:** allowed from more than one node only with explicit version/conflict rules.
4. **Derived/materialized:** regenerated from canonical data; never treated as mutation authority.
5. **Device/local operational state:** remains node/device local unless evidence/audit requires central reporting.

The final mapping must cover at minimum products, prices/promotions, customers, suppliers, sales/orders, payments, inventory movements, returns/refunds, purchase/receiving, journals, payroll-sensitive data, assets, transfers, notifications, user/device identity, and sync metadata.

## 4. POST-1A — Edge topology and sync foundation

Deliver as one large atomic wave.

Required work:

- local node identity, central peer identity, registration/revocation;
- peer authentication and transport security;
- durable event queue/outbox/inbox;
- idempotency and duplicate suppression;
- schema/protocol version negotiation;
- conflict/reconciliation primitives;
- observability: last sync, lag, pending, failed, retrying, dead-letter, peer health;
- safe bootstrap of a new branch from central authoritative state;
- recovery/bootstrap after local server replacement.

Evidence:

- central + two branch nodes;
- normal synchronization;
- WAN partition;
- independent branch transactions during partition;
- reconnect/retry/replay;
- exact convergence and no duplicate business postings.

## 5. POST-1B — Local-first branch continuity

Deliver as one large atomic wave after POST-1A.

Required work:

- supported local-server deployment profile for main store and branches;
- LAN discovery/configuration contract for approved clients;
- POS and inventory flows declared offline-capable continue against local server;
- local price/promotion reads continue from last authoritative synchronized state;
- controlled inter-branch transfer lifecycle when one branch is offline;
- central consolidated dashboard and reconciliation status;
- local backup, central backup metadata, restore/rejoin procedure;
- operator-visible degraded/offline/synchronizing states.

No flow may silently pretend it is globally current when a branch is disconnected.

## 6. POST-1C — Mobile/PWA stock operations and Telegram

Deliver as one large atomic wave after branch continuity is proven.

### Mobile/PWA primary stock-opname surface

- mobile-friendly barcode scanning;
- warehouse/rack/session selection;
- product, unit, system quantity and count context;
- offline/local draft storage;
- repeated scan/count workflow optimized for hundreds/thousands of SKUs;
- resume/reopen count session;
- discrepancy review;
- supervisor approval where policy requires;
- canonical inventory adjustment posting with full audit;
- local LAN operation when WAN is unavailable.

### Telegram quick operational surface

Telegram is complementary, not the only stock-opname client.

Planned commands/workflows may include:

- stock lookup by barcode/SKU/name;
- price lookup;
- stock-opname draft/count capture;
- damaged/lost item report;
- low-stock or discrepancy alert;
- approval/status notification;
- branch/warehouse-aware quick queries.

Security invariants:

- Telegram identity must map to an active authorized employee binding;
- tenant/branch/warehouse and permission must be resolved server-side;
- destructive/financial mutations require existing TOKO360 authorization and confirmation rules;
- no direct database writes from bot handlers;
- every bot action is auditable;
- if Telegram/internet is unavailable, local PWA remains the branch stock-opname fallback.

## 7. POST-1D — LAN barcode price checker

Deliver as one large atomic wave after canonical branch pricing reads are stable.

Target:

- multiple kiosk stations per branch LAN;
- branch-local server is the normal API target;
- each kiosk device may use USB/HID barcode scanner input;
- scan immediately resolves product and active branch price/promotion/unit/location information;
- customer-facing full-screen display auto-resets after timeout;
- no Admin/POS mutation capabilities;
- device-scoped read-only access;
- clear offline/degraded indicator if branch-local data itself is unavailable;
- configuration supports kiosk naming/location and device revocation.

Suggested display contract:

- product name;
- barcode/SKU;
- active selling unit;
- current price;
- active promotion when applicable;
- optional rack/location;
- optional availability message only if product policy allows customer-facing stock visibility.

## 8. Multi-branch acceptance matrix

Final POST-1 acceptance must exercise at least:

1. Central + main store + one additional branch online.
2. Main store WAN disconnected while LAN POS/PWA/kiosk continue.
3. Branch creates sales/inventory changes while central is unreachable.
4. Another branch continues independently.
5. Reconnect causes idempotent convergence.
6. Retry the same sync payload and prove no duplicate stock/payment/journal effect.
7. Conflicting permitted master edits follow the documented deterministic conflict rule.
8. Inter-branch transfer cannot double-count stock when one peer is delayed/offline.
9. Mobile stock-opname draft survives WAN loss and posts once through canonical inventory after approval.
10. Telegram request is correctly employee/tenant/branch scoped and audited.
11. Two or more LAN price kiosks resolve the same authoritative branch price.
12. Local server restore/rejoin does not create a second logical branch/node or replay duplicates.
13. Central consolidated reporting reconciles exactly to branch canonical transaction evidence.
14. Human operator validates normal, degraded, reconnecting, conflict, and recovery states.

## 9. Definition of done

POST-1 is complete only when:

- central + multi-branch runtime evidence is exact-source and repeatable;
- declared local-first workflows survive WAN partition;
- all synchronized mutations use canonical domain owners;
- no duplicate mutation occurs under retry/replay;
- conflict and reconciliation are operator-visible and deterministic;
- Telegram and mobile operations preserve employee/tenant/branch authority;
- price kiosks are read-only and work through local branch authority;
- backup/restore/rejoin is proven;
- documentation and deployment runbooks match the implemented topology;
- human acceptance passes at the main store and at least one branch.
