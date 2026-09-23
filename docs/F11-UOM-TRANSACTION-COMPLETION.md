# F11 — Purchase / Sales / POS UOM Integration

Status: **SOURCE IMPLEMENTATION COMPLETE — UAT DEFERRED**

## Authority
- `Product.unit` remains the integer base inventory unit.
- `ProductUnit` is authoritative for alternative transaction UOM and `quantityFactor`.
- Barcode is a shortcut to a ProductUnit or a backward-compatible unit snapshot; it is not the unit master.

## Purchase
- PO input quantity is expressed in the selected purchase UOM when `productUnitId` is supplied.
- PO stores selected `variantId`, `productUnitId`, `unitCode`, `unitQuantity`, `quantityFactor`, and `purchaseUnitCost`.
- `orderedQty` remains canonical base-unit quantity.
- Base unit cost is derived with Decimal arithmetic; subtotal remains selected-unit quantity × selected-unit cost.

## Goods receipt
- Operator enters received/damaged quantity in the PO UOM.
- Server converts both to integer base quantity before over-receipt checks, stock movement, batch, serial, inventory and accounting posting.
- Receipt keeps the UOM snapshot for traceability.

## Sales / POS
- Sale DTO supports direct `productUnitId` and `variantId`.
- Server resolves active ProductUnit/variant, price and integer base quantity authoritatively.
- Barcode resolution converges on ProductUnit when linked.
- POS can select active UOM directly; non-base UOM remains online-only so offline pricing/conversion cannot drift.

## Database
Expand-only migration: `database/migrations/T360-20260923-f11-transaction-uom/`. Existing rows keep `quantityFactor=1`, preserving base-unit semantics.

## Verification
- Focused F11 + legacy unit/procurement regression: 30/30 PASS.
- `npm run workflow:validate`: PASS.
- `npm run validate:repo`: PASS.
- `npm run test:dependency-free`: 809/809 PASS.
- Runtime/browser/human UAT intentionally deferred.
