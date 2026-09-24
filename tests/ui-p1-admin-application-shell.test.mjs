import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page=readFileSync(new URL('../apps/admin/app/page.tsx',import.meta.url),'utf8');
const navigation=readFileSync(new URL('../apps/admin/app/navigation.ts',import.meta.url),'utf8');
const shell=readFileSync(new URL('../apps/admin/app/app-shell.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/admin/app/globals.css',import.meta.url),'utf8');
const dynamicRoute=readFileSync(new URL('../apps/admin/app/[section]/page.tsx',import.meta.url),'utf8');
const expectedRoutes=['/dashboard','/commerce','/procurement','/inventory-control','/operations-control','/master-data','/finance','/reports','/people','/assets-fleet','/intelligence','/integrations','/organization','/settings'];

test('UI-P1 gives every implemented Admin workspace a canonical route',()=>{for(const route of expectedRoutes) assert.match(navigation,new RegExp(`route: '${route.replaceAll('/','\\/')}'`));assert.match(dynamicRoute,/export \{ default \} from '\.\.\/page'/);assert.match(page,/usePathname\(\)/);assert.match(page,/router\.push\(route\)/);});
test('UI-P1 navigation is resolved from runtime modules features permissions and UiSchema',()=>{assert.match(navigation,/manifest\.modules/);assert.match(navigation,/manifest\.features\?\.\[module\.featureKey\]\?\.enabled === true/);assert.match(navigation,/identity\.permissions/);assert.match(navigation,/identity\.roles/);assert.match(navigation,/manifest\?\.uiSchemas/);assert.match(page,/resolveAdminNavigation\(manifest, identity\)/);assert.doesNotMatch(page,/const NAV:/);});
test('UI-P1 shell has one primary navigation one contextual subnav and explicit tenant context',()=>{assert.match(shell,/Cari menu, fitur, atau area kerja/);assert.match(shell,/className="domainTabs"/);assert.match(shell,/Tenant aktif/);assert.match(shell,/manifest\?\.branch\?\.name/);assert.doesNotMatch(shell,/workspaceRail|domainDeck|breadcrumbs|sidebarCollapsed/);assert.match(css,/\.sidebar/);assert.match(css,/\.domainTabs/);assert.doesNotMatch(css,/overflow-x\s*:\s*auto/);});
test('UI-P1 preserves fail-closed backend authorization while token claims only affect visibility',()=>{assert.match(navigation,/identityFromAccessToken/);assert.match(navigation,/window\.atob/);assert.doesNotMatch(navigation,/fetch\(/);assert.match(page,/authFetch/);});
test('UI-P1 follows restrained Tailwind design tokens without decorative gradients',()=>{assert.match(css,/@import "tailwindcss"/);assert.match(css,/--color-app-bg: #0b0e14/);assert.match(css,/--color-app-surface: #131722/);assert.match(css,/--color-app-accent: #3b82f6/);assert.doesNotMatch(css,/linear-gradient\(|radial-gradient\(/);assert.match(css,/max-w-\[1480px\]/);assert.match(css,/w-\[260px\]/);});
