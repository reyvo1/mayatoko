# TOKO360 Product Completeness Status

`config/product-completeness.json` is the canonical machine-readable source of truth for product completion after the 957-file full audit.

Rules:
- Source markers, routes, buttons, models, or green source-contract tests cannot close a capability.
- `RUNTIME_VERIFIED` requires explicit exact-source runtime evidence.
- UI/product completion requires `HUMAN_ACCEPTED` evidence.
- Historical F1-F12 and R0-R8 files remain evidence/history only.
- `PRODUCT_READY` remains false until P7 and Human Stage-20 pass.

Current phase: **P0 — Truth Reset, Governance, Security Hygiene**.
