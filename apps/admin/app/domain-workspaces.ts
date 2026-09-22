import type { ComponentType } from 'react';
import {
  Activity, BadgeDollarSign, Banknote, Boxes, Building2, ClipboardCheck, ClipboardList,
  CreditCard, FileBarChart, FileCheck2, Gauge, KeyRound, Landmark, PackageCheck, PackageSearch,
  ReceiptText, RefreshCcw, Route, ScanLine, Settings2, ShieldCheck, ShoppingBag, Truck, UserCog,
  Users, Warehouse, Wrench,
} from 'lucide-react';
import type { AdminWorkspace } from './navigation';

type DomainIcon = ComponentType<{ size?: number | string }>;

export type AdminDomainView = {
  key: string;
  label: string;
  title: string;
  description: string;
  Icon: DomainIcon;
};

export type AdminDomainWorkspace = {
  workspaceKey: string;
  views: AdminDomainView[];
};

export const ADMIN_DOMAIN_WORKSPACES: AdminDomainWorkspace[] = [
  { workspaceKey: 'master-data', views: [
    { key: 'catalog', label: 'Catalog', title: 'Catalog & customer master', description: 'Product category, customer, barcode, unit conversion, dan pricing.', Icon: ShoppingBag },
    { key: 'organization', label: 'Organisasi', title: 'Cabang & gudang', description: 'Branch, warehouse, dan konteks organisasi operasional.', Icon: Building2 },
    { key: 'locations', label: 'Lokasi gudang', title: 'Zone / rack / bin', description: 'Struktur lokasi gudang dan barcode location.', Icon: Warehouse },
    { key: 'references', label: 'Reference', title: 'Reference master', description: 'Brand, unit, bank, courier, dan payment method.', Icon: Settings2 },
  ]},
  { workspaceKey: 'procurement', views: [
    { key: 'requests', label: 'Requests', title: 'Purchase requests', description: 'Ajukan kebutuhan, separation of duties, dan approval sebelum PO.', Icon: ClipboardList },
    { key: 'orders', label: 'Purchase orders', title: 'Purchase orders', description: 'Supplier, warehouse, product, quantity, dan authoritative unit cost.', Icon: PackageSearch },
    { key: 'receipts', label: 'Goods receipt', title: 'Goods receipt', description: 'Inbound receiving, inspection, confirmation, stok, dan journal posting.', Icon: PackageCheck },
    { key: 'inventory', label: 'Stock view', title: 'Procurement inventory view', description: 'Saldo gudang dan penerimaan terakhir untuk keputusan pembelian.', Icon: Boxes },
  ]},
  { workspaceKey: 'commerce', views: [
    { key: 'orders', label: 'Orders', title: 'Commerce orders', description: 'Order website, status fulfillment, dan pembayaran.', Icon: ShoppingBag },
    { key: 'fulfillment', label: 'Fulfillment', title: 'Packing & fulfillment', description: 'Packing, shipment, delivery, dan lifecycle fulfillment.', Icon: Truck },
    { key: 'returns', label: 'Returns', title: 'Customer returns', description: 'Return request, inspection, refund, dan inventory reversal.', Icon: RefreshCcw },
    { key: 'channels', label: 'Channels', title: 'Commerce channels', description: 'Storefront, marketplace, integration mapping, dan notification.', Icon: Activity },
  ]},
  { workspaceKey: 'inventory-control', views: [
    { key: 'traceability', label: 'Traceability', title: 'Batch & serial traceability', description: 'Batch/expiry dan serial number dengan jejak pergerakan.', Icon: ScanLine },
    { key: 'returns', label: 'Returns', title: 'Sales & purchase returns', description: 'Retur penjualan, storefront, dan supplier dengan inspection.', Icon: RefreshCcw },
    { key: 'transfers', label: 'Transfers', title: 'Stock transfers', description: 'Perpindahan antar gudang dan relokasi di dalam gudang.', Icon: Route },
    { key: 'stocktake', label: 'Stock opname', title: 'Physical inventory', description: 'Sesi penghitungan fisik, variance, approval, dan posting.', Icon: ClipboardCheck },
  ]},
  { workspaceKey: 'operations-control', views: [
    { key: 'inspections', label: 'Inspections', title: 'Quality inspections', description: 'Inbound/outbound inspection dan structured result.', Icon: ClipboardCheck },
    { key: 'evidence', label: 'Evidence', title: 'Operational evidence', description: 'Foto, barcode, confirmation, dan audit evidence.', Icon: FileCheck2 },
    { key: 'gate-pass', label: 'Gate pass', title: 'Gate control', description: 'Gate pass masuk/keluar dan validation lifecycle.', Icon: ShieldCheck },
    { key: 'delivery', label: 'Delivery', title: 'Delivery lifecycle', description: 'Trip, manifest, loading, dispatch, POD/COD, return, dan close trip.', Icon: Truck },
  ]},
  { workspaceKey: 'finance', views: [
    { key: 'ledger', label: 'Ledger', title: 'Accounting ledger', description: 'Accounting events, journals, fiscal period, dan tax code.', Icon: Landmark },
    { key: 'payables', label: 'Payables', title: 'Supplier payables', description: 'Outstanding supplier document dan settlement lifecycle.', Icon: ReceiptText },
    { key: 'receivables', label: 'Receivables', title: 'Customer receivables', description: 'COD/invoice receivable dan supplier refund balance.', Icon: BadgeDollarSign },
    { key: 'banking', label: 'Banking', title: 'Cash & bank reconciliation', description: 'Finance operations, statement import, dan reconciliation.', Icon: Banknote },
    { key: 'reports', label: 'Reports', title: 'Finance reports', description: 'Report worker dan export evidence dari authoritative ledger.', Icon: FileBarChart },
  ]},
  { workspaceKey: 'people', views: [
    { key: 'employees', label: 'Employees', title: 'Employee master', description: 'Employee identity, organization, status, dan self-service linkage.', Icon: Users },
    { key: 'attendance', label: 'Attendance', title: 'Attendance operations', description: 'Attendance evidence, approval, location policy, dan history.', Icon: ClipboardCheck },
    { key: 'payroll', label: 'Payroll', title: 'Payroll runs', description: 'Payroll preparation, approval, posting, settlement, dan payslip.', Icon: CreditCard },
    { key: 'compliance', label: 'Compliance', title: 'Payroll compliance', description: 'Tax profile, BPJS, adjustment/recovery, dan audit lineage.', Icon: ShieldCheck },
  ]},
  { workspaceKey: 'assets-fleet', views: [
    { key: 'assets', label: 'Assets', title: 'Fixed assets', description: 'Asset category, acquisition, book value, depreciation, dan disposal.', Icon: Building2 },
    { key: 'maintenance', label: 'Maintenance', title: 'Maintenance operations', description: 'Work order, schedule, parts, cost, dan completion.', Icon: Wrench },
    { key: 'vehicles', label: 'Vehicles', title: 'Fleet vehicles', description: 'Vehicle master, availability, maintenance state, dan assignment.', Icon: Truck },
    { key: 'trips', label: 'Trips', title: 'Fleet trips', description: 'Driver, trip, fuel, odometer, cost, dan delivery linkage.', Icon: Route },
  ]},
  { workspaceKey: 'extensions', views: [
    { key: 'loyalty', label: 'Loyalty', title: 'Customer loyalty', description: 'Program loyalty dan customer engagement foundation.', Icon: BadgeDollarSign },
    { key: 'devices', label: 'Devices', title: 'Devices & offline nodes', description: 'Device registration, health, sync, dan offline operation.', Icon: Gauge },
    { key: 'notifications', label: 'Notifications', title: 'Notification operations', description: 'Notification queue, delivery, retry, dan channel adapter.', Icon: Activity },
    { key: 'integrations', label: 'Integrations', title: 'Integration connections', description: 'Provider connection, external mapping, dan adapter status.', Icon: RefreshCcw },
  ]},
  { workspaceKey: 'platform', views: [
    { key: 'features', label: 'Features', title: 'Runtime features', description: 'Module catalog dan feature flags untuk company aktif.', Icon: Settings2 },
    { key: 'users', label: 'Users', title: 'Users & roles', description: 'User lifecycle, role assignment, dan branch access.', Icon: UserCog },
    { key: 'security', label: 'Security', title: 'Account security', description: '2FA, recovery, session security, dan protected account controls.', Icon: ShieldCheck },
    { key: 'api-keys', label: 'API keys', title: 'Integration API keys', description: 'Scoped API keys, one-time secret display, dan revoke.', Icon: KeyRound },
  ]},
];

export function domainViewsForWorkspace(workspace: AdminWorkspace): AdminDomainView[] {
  return ADMIN_DOMAIN_WORKSPACES.find((entry) => entry.workspaceKey === workspace.key)?.views ?? [];
}

export function domainViewFromPath(pathname: string, workspace: AdminWorkspace): AdminDomainView | null {
  const key = pathname.split('/').filter(Boolean)[1];
  if (!key) return null;
  return domainViewsForWorkspace(workspace).find((view) => view.key === key) ?? null;
}

export function domainRoute(workspace: AdminWorkspace, view: AdminDomainView): string {
  return `${workspace.route}/${view.key}`;
}

export function isValidAdminPath(pathname: string, workspace: AdminWorkspace): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return pathname === '/';
  if (`/${parts[0]}` !== workspace.route) return false;
  if (parts.length === 1) return true;
  if (parts.length !== 2) return false;
  return domainViewsForWorkspace(workspace).some((view) => view.key === parts[1]);
}
