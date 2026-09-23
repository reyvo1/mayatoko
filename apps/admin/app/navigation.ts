import type { ComponentType } from 'react';
import {
  BookOpen,
  Boxes,
  CircleGauge,
  Container,
  Crown,
  Gem,
  LayoutDashboard,
  Package,
  Repeat2,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';

export type AdminIdentity = {
  roles: string[];
  permissions: string[];
};

export type RuntimeModule = {
  code: string;
  name: string;
  category: string;
  featureKey?: string | null;
  isCore: boolean;
};

export type RuntimeUiSchema = {
  code: string;
  surface: string;
  version: number;
  schema: unknown;
};

export type AdminRuntimeManifest = {
  version?: string;
  company?: { id: string; name: string };
  branch?: { id: string; code?: string; name: string };
  features: Record<string, { enabled: boolean; config?: unknown }>;
  modules: RuntimeModule[];
  navigation?: unknown[];
  uiSchemas?: RuntimeUiSchema[];
};

type NavIcon = ComponentType<{ size?: number | string }>;

export type AdminWorkspace = {
  key: string;
  route: string;
  label: string;
  group: 'Overview' | 'Operasional' | 'Keuangan & SDM' | 'Platform';
  Icon: NavIcon;
  eyebrow: string;
  title: string;
  description: string;
  moduleCodes: string[];
  permissionPrefixes?: string[];
  roles?: string[];
};

export const ADMIN_WORKSPACES: AdminWorkspace[] = [
  {
    key: 'dashboard', route: '/dashboard', label: 'Dashboard', group: 'Overview', Icon: LayoutDashboard,
    eyebrow: 'OVERVIEW', title: 'Ringkasan operasional hari ini',
    description: 'Pantau transaksi, persediaan, pesanan, dan tren utama dari sumber data server.',
    moduleCodes: ['catalog', 'orders', 'inventory'],
  },
  {
    key: 'owner', route: '/owner', label: 'Owner Suite', group: 'Overview', Icon: Crown,
    eyebrow: 'OWNER', title: 'Ringkasan pemilik',
    description: 'Lihat laba-rugi, posisi keuangan, dan integritas accounting dari jurnal yang sudah diposting.',
    moduleCodes: ['accounting', 'accounting-core', 'finance-operations'],
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN'],
  },
  {
    key: 'master-data', route: '/master-data', label: 'Master Data', group: 'Operasional', Icon: Boxes,
    eyebrow: 'FOUNDATION', title: 'Master data operasional',
    description: 'Kelola katalog, customer, produk, multi-UOM/kemasan, barcode, pricing retail-grosir, cabang, gudang, dan reference master.',
    moduleCodes: ['catalog', 'suppliers', 'inventory'],
  },
  {
    key: 'procurement', route: '/procurement', label: 'Pembelian & Stok', group: 'Operasional', Icon: Package,
    eyebrow: 'PROCUREMENT', title: 'Pembelian dan persediaan',
    description: 'Kelola supplier, purchase request, purchase order, penerimaan barang, dan saldo stok gudang.',
    moduleCodes: ['suppliers', 'goods-receipts', 'inventory', 'reorder'],
    permissionPrefixes: ['purchase', 'goods_receipt', 'inventory', 'supplier'],
  },
  {
    key: 'commerce', route: '/commerce', label: 'Storefront & Fulfillment', group: 'Operasional', Icon: ShoppingCart,
    eyebrow: 'COMMERCE', title: 'Storefront dan fulfillment',
    description: 'Kelola order website, pembayaran, packing, shipment, dan delivery berdasarkan lifecycle server.',
    moduleCodes: ['storefront', 'orders', 'shipping', 'marketplace'],
    permissionPrefixes: ['order', 'sale', 'shipment', 'payment'],
  },
  {
    key: 'inventory-control', route: '/inventory-control', label: 'Retur & Transfer', group: 'Operasional', Icon: Repeat2,
    eyebrow: 'INVENTORY CONTROL', title: 'Retur dan transfer stok',
    description: 'Pantau retur penjualan/pembelian, perpindahan antar-gudang, batch/serial, dan stock opname.',
    moduleCodes: ['stock-transfer', 'stock-opname', 'batch-expiry', 'serial-number', 'sales-return', 'purchase-return'],
    permissionPrefixes: ['inventory', 'return', 'stock'],
  },
  {
    key: 'operations-control', route: '/operations-control', label: 'Kontrol Operasional', group: 'Operasional', Icon: ShieldCheck,
    eyebrow: 'OPERATIONS CONTROL', title: 'Inspeksi dan gate control',
    description: 'Kelola evidence, barcode, inspeksi, approval operasional, gate pass, dan delivery lifecycle.',
    moduleCodes: ['quality-inspection', 'gate-pass', 'fleet', 'shipping'],
    permissionPrefixes: ['operations', 'inspection', 'gate', 'fleet', 'shipment'],
  },
  {
    key: 'finance', route: '/finance', label: 'Akuntansi & Kas', group: 'Keuangan & SDM', Icon: BookOpen,
    eyebrow: 'FINANCE', title: 'Akuntansi, kas, dan settlement',
    description: 'Kelola chart of accounts, jurnal, pajak, periode fiskal, AP/AR, kas-bank, rekonsiliasi, serta laporan keuangan dan export.',
    moduleCodes: ['accounting', 'accounting-core', 'finance-operations', 'bank-reconciliation', 'system-tax'],
    permissionPrefixes: ['finance', 'accounting', 'tax'],
  },
  {
    key: 'people', route: '/people', label: 'HRIS & Payroll', group: 'Keuangan & SDM', Icon: Users,
    eyebrow: 'PEOPLE', title: 'HRIS dan payroll',
    description: 'Kelola karyawan, absensi, payroll, pembayaran gaji, kewajiban, dan riwayat run.',
    moduleCodes: ['hris', 'attendance', 'payroll', 'tax-payroll'],
    permissionPrefixes: ['hr', 'employee', 'attendance', 'payroll'],
  },
  {
    key: 'assets-fleet', route: '/assets-fleet', label: 'Aset & Fleet', group: 'Keuangan & SDM', Icon: Container,
    eyebrow: 'ASSET & FLEET', title: 'Aset dan armada',
    description: 'Pantau nilai aset, maintenance, kendaraan, trip, BBM, dan biaya operasional.',
    moduleCodes: ['fixed-assets', 'fleet'],
    permissionPrefixes: ['asset', 'fleet'],
  },
  {
    key: 'extensions', route: '/extensions', label: 'Loyalty & Devices', group: 'Platform', Icon: Gem,
    eyebrow: 'EXTENSIONS', title: 'Loyalty, devices, dan notifikasi',
    description: 'Pantau program loyalitas, perangkat, sinkronisasi, integrasi, dan antrean notifikasi.',
    moduleCodes: ['loyalty', 'notifications', 'offline-pos', 'biometric-attendance', 'integrations'],
    permissionPrefixes: ['loyalty', 'device', 'notification', 'integration'],
  },
  {
    key: 'platform', route: '/platform', label: 'Sistem & Akses', group: 'Platform', Icon: Settings,
    eyebrow: 'PLATFORM', title: 'Sistem dan akses pengguna',
    description: 'Kelola feature runtime, pengguna, keamanan, API key, dan konfigurasi platform.',
    moduleCodes: ['approval', 'integrations', 'operations-automation'],
    roles: ['SUPER_ADMIN', 'OWNER', 'ADMIN'],
    permissionPrefixes: ['user', 'role', 'api_key', 'platform', 'integration'],
  },
];

const GROUP_ORDER: AdminWorkspace['group'][] = ['Overview', 'Operasional', 'Keuangan & SDM', 'Platform'];

export type ResolvedAdminNavigation = Array<{ group: AdminWorkspace['group']; items: AdminWorkspace[] }>;

type NavigationOverride = { route?: unknown; label?: unknown; hidden?: unknown; order?: unknown };

function enabledModuleCodes(manifest: AdminRuntimeManifest | null): Set<string> | null {
  if (!manifest?.modules?.length) return null;
  return new Set(manifest.modules.filter((module) => {
    if (module.isCore || !module.featureKey) return true;
    return manifest.features?.[module.featureKey]?.enabled === true;
  }).map((module) => module.code));
}

function hasPermission(identity: AdminIdentity | null, workspace: AdminWorkspace): boolean {
  if (!identity) return true;
  if (workspace.roles?.some((role) => identity.roles.includes(role))) return true;
  if (!workspace.permissionPrefixes?.length) return true;
  if (!identity.permissions.length) return false;
  return identity.permissions.some((permission) => workspace.permissionPrefixes!.some((prefix) => permission === prefix || permission.startsWith(`${prefix}.`) || permission.startsWith(`${prefix}_`)));
}

function readOverrides(manifest: AdminRuntimeManifest | null): Map<string, NavigationOverride> {
  const result = new Map<string, NavigationOverride>();
  const candidates = (manifest?.uiSchemas ?? [])
    .filter((item) => item.surface.toLowerCase() === 'admin')
    .sort((a, b) => b.version - a.version);
  for (const candidate of candidates) {
    if (!candidate.schema || typeof candidate.schema !== 'object' || Array.isArray(candidate.schema)) continue;
    const navigation = (candidate.schema as Record<string, unknown>).navigation;
    if (!Array.isArray(navigation)) continue;
    for (const raw of navigation) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const override = raw as NavigationOverride;
      if (typeof override.route !== 'string' || !override.route.startsWith('/')) continue;
      if (!result.has(override.route)) result.set(override.route, override);
    }
  }
  return result;
}

export function resolveAdminNavigation(manifest: AdminRuntimeManifest | null, identity: AdminIdentity | null): ResolvedAdminNavigation {
  const activeModules = enabledModuleCodes(manifest);
  const overrides = readOverrides(manifest);
  const visible = ADMIN_WORKSPACES
    .filter((workspace) => {
      const override = overrides.get(workspace.route);
      if (override?.hidden === true) return false;
      if (!hasPermission(identity, workspace)) return false;
      if (!activeModules || workspace.key === 'dashboard' || workspace.key === 'platform') return true;
      return workspace.moduleCodes.some((code) => activeModules.has(code));
    })
    .map((workspace) => {
      const override = overrides.get(workspace.route);
      return typeof override?.label === 'string' && override.label.trim()
        ? { ...workspace, label: override.label.trim() }
        : workspace;
    });

  return GROUP_ORDER.map((group) => ({
    group,
    items: visible.filter((item) => item.group === group).sort((left, right) => {
      const leftOrder = overrides.get(left.route)?.order;
      const rightOrder = overrides.get(right.route)?.order;
      const a = typeof leftOrder === 'number' ? leftOrder : ADMIN_WORKSPACES.findIndex((workspace) => workspace.route === left.route);
      const b = typeof rightOrder === 'number' ? rightOrder : ADMIN_WORKSPACES.findIndex((workspace) => workspace.route === right.route);
      return a - b;
    }),
  })).filter((group) => group.items.length > 0);
}

export function workspaceFromPath(pathname: string): AdminWorkspace {
  const normalized = pathname === '/' ? '/dashboard' : `/${pathname.split('/').filter(Boolean)[0] ?? 'dashboard'}`;
  return ADMIN_WORKSPACES.find((workspace) => workspace.route === normalized) ?? ADMIN_WORKSPACES[0];
}

export function workspaceByLabel(label: string): AdminWorkspace {
  return ADMIN_WORKSPACES.find((workspace) => workspace.label === label) ?? ADMIN_WORKSPACES[0];
}

export function identityFromAccessToken(token: string | null | undefined): AdminIdentity | null {
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
    const payload = JSON.parse(window.atob(normalized)) as Record<string, unknown>;
    return {
      roles: Array.isArray(payload.roles) ? payload.roles.filter((value): value is string => typeof value === 'string') : [],
      permissions: Array.isArray(payload.permissions) ? payload.permissions.filter((value): value is string => typeof value === 'string') : [],
    };
  } catch {
    return null;
  }
}
