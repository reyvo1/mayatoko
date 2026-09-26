import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');
const visualMap = JSON.parse(read('config/p5-visual-surface-map.json'));
const artDirection = JSON.parse(read('config/p5-v2-art-direction.json'));
const packageJson = JSON.parse(read('package.json'));
const adminShell = read('apps/admin/app/app-shell.tsx');
const accountingWorkspace = read('apps/admin/app/modules/accounting.tsx');
const adminCss = read('apps/admin/app/globals.css');
const posShell = read('apps/pos/app/pos-shell.tsx');
const storefrontShell = read('apps/storefront/app/storefront-shell.tsx');
const employeeShell = read('apps/employee-portal/app/employee-portal-shell.tsx');
const cssBundle = [
  read('apps/admin/app/globals.css'),
  read('apps/pos/app/globals.css'),
  read('apps/storefront/app/globals.css'),
  read('apps/employee-portal/app/globals.css'),
].join('\n');
const browserUat = read('scripts/browser-uat.mjs');
const p5Audit = read('scripts/audit-p5-visual-rebuild.mjs');
const p5V2Audit = read('scripts/audit-p5-v2-art-direction.mjs');
const p5Probe = read('scripts/ci-p5-visual-probe.mjs');
const fullSystem = read('.github/workflows/full-system-simulation.yml');
const fullUat = read('.github/workflows/toko360-full-uat.yml');
const summary = read('scripts/ci-write-full-system-summary.mjs');
const uatReport = read('scripts/github-uat-report.mjs');

const expectedBaseline = {
  commit: 'd305ade2050765de86c7f5ef1c54eb7426c5e25b',
  sourceFingerprint: 'cf6165fcc74e94abb3866230aa1764cee9487d4de6b630377465d20bda7d9246',
};

test('P5 visual map covers all four products and representative page-level surfaces', () => {
  assert.equal(visualMap.phase, 'P5');
  assert.equal(visualMap.baseline.commit, expectedBaseline.commit);
  assert.equal(visualMap.baseline.sourceFingerprint, expectedBaseline.sourceFingerprint);
  assert.equal(visualMap.admin.primaryWorkspaces.length, 14);
  assert.equal(visualMap.admin.representativeContextualRoutes.length, 13);
  assert.equal(visualMap.pos.views.length, 4);
  assert.equal(visualMap.storefront.views.length, 5);
  assert.equal(visualMap.employeePortal.views.length, 7);
  assert.equal(visualMap.requirements.humanAcceptanceRequired, true);
  assert.deepEqual(
    [visualMap.requirements.desktopWidth, visualMap.requirements.tabletWidth, visualMap.requirements.mobileWidth],
    [1440, 1024, 390],
  );
});

test('P5 rebuild gives Admin POS Storefront and Employee Portal product-specific visual composition', () => {
  assert.match(adminShell, /data-visual-product="admin"/);
  assert.match(adminShell, /data-visual-version="p5-v2"/);
  assert.match(adminShell, /pageTitleRow/);
  assert.match(adminShell, /pageContextStrip/);

  assert.match(posShell, /data-visual-product="pos"/);
  assert.match(posShell, /data-visual-version="p5-v2"/);
  assert.match(posShell, /posWorkspaceHeader/);
  assert.match(posShell, /posWorkspaceStatus/);

  assert.match(storefrontShell, /data-visual-product="storefront"/);
  assert.match(storefrontShell, /data-visual-version="p5-v2"/);
  assert.match(storefrontShell, /storefrontViewHeader/);
  assert.match(storefrontShell, /storefrontBranchContext/);

  assert.match(employeeShell, /data-visual-product="employee-portal"/);
  assert.match(employeeShell, /data-visual-version="p5-v2"/);
  assert.match(employeeShell, /employeeContextPill/);
  assert.match(employeeShell, /employeeViewBody/);
});

test('P5 canonical surfaces keep responsive/accessibility primitives and no decorative gradients', () => {
  assert.match(cssBundle, /@media/);
  assert.match(cssBundle, /prefers-reduced-motion/);
  assert.match(cssBundle, /pointer:\s*coarse/);
  assert.doesNotMatch(cssBundle, /linear-gradient|radial-gradient|conic-gradient/i);
});

test('P5 browser UAT creates exact page-level screenshot matrix and keeps human acceptance pending', () => {
  for (const marker of [
    'P5_VISUAL_SCREENSHOT_MATRIX',
    'p5-admin-primary-',
    'p5-admin-context-',
    'p5-pos-',
    'p5-storefront-',
    'p5-employee-',
  ]) assert.match(browserUat, new RegExp(marker));
  assert.match(browserUat, /humanAcceptance:\s*'PENDING'/);
  assert.match(browserUat, /T360_UAT_PREPARE_EMPLOYEE_SELF/);
  assert.match(browserUat, /T360_UAT_PREPARE_P5_STOREFRONT_FIXTURE/);
  assert.match(browserUat, /P5_STOREFRONT_PRODUCT_FIXTURE/);
  assert.match(browserUat, /P5 Storefront fixture menolak target non-loopback/);
  assert.match(browserUat, /P5 Storefront fixture menolak environment yang tidak eksplisit non-production/);
  assert.match(browserUat, /method:\s*'POST'[\s\S]*?\$\{apiUrl\}\/products/);
  assert.match(browserUat, /productionTouched:\s*false/);
  assert.match(p5Probe, /humanAcceptance:\s*'PENDING'/);
  assert.match(p5Probe, /github-p5-visual-rebuild-probe-latest\.json/);
  assert.match(p5Probe, /productionTouched:\s*false/);
});

test('P5 storefront visual fixture is explicit in both heavy GitHub workflows and does not weaken product-detail coverage', () => {
  for (const workflow of [fullSystem, fullUat]) {
    assert.match(workflow, /T360_UAT_PREPARE_P5_STOREFRONT_FIXTURE:\s*'true'/);
    assert.match(workflow, /T360_UAT_STOREFRONT_BRANCH_CODE:\s*PUSAT/);
  }
  assert.match(browserUat, /P5 Storefront detail produk tidak dapat dibuka dari katalog runtime/);
  assert.match(browserUat, /data-visual-view'\) === 'product'/);
});

test('P5 visual audit is permanent and exact-runtime P5 probe is mandatory in both heavy workflows', () => {
  assert.equal(packageJson.scripts['audit:p5:visual'], 'node scripts/audit-p5-visual-rebuild.mjs && node scripts/audit-p5-v2-art-direction.mjs');
  assert.equal(packageJson.scripts['ci:p5:probe'], 'node scripts/ci-p5-visual-probe.mjs');
  assert.match(packageJson.scripts['audit:full:repo'], /audit:p5:visual/);
  assert.match(p5Audit, /P5 visual audit PASS/);
  assert.match(p5V2Audit, /P5 V2 art-direction audit PASS/);

  for (const workflow of [fullSystem, fullUat]) {
    assert.match(workflow, /id: p5_visual_rebuild/);
    assert.match(workflow, /npm run ci:p5:probe/);
  }
  assert.match(fullSystem, /T360_CI_STEP_P5_VISUAL: \$\{\{ steps\.p5_visual_rebuild\.outcome \}\}/);
  assert.match(fullUat, /STEP_P5_VISUAL: \$\{\{ steps\.p5_visual_rebuild\.outcome \}\}/);
  assert.match(fullUat, /T360_UAT_PREPARE_EMPLOYEE_SELF: 'true'/);
  assert.match(fullUat, /check "P5 full visual product rebuild screenshot matrix" "\$STEP_P5_VISUAL"/);
});

test('P5 exact-source evidence participates in full-system aggregate and UAT report without auto-promoting human acceptance', () => {
  assert.match(summary, /github-p5-visual-rebuild-probe-latest\.json/);
  assert.match(summary, /p5VisualRebuild/);
  assert.match(summary, /T360_CI_STEP_P5_VISUAL/);
  assert.match(summary, /humanAcceptance === 'PENDING'/);
  assert.match(summary, /'p5VisualRebuild'/);
  assert.match(uatReport, /P5 full visual product rebuild screenshot matrix/);
  assert.match(uatReport, /STEP_P5_VISUAL/);
});

test('P5 finance account creation form stays responsive inside the two-panel desktop composition', () => {
  assert.match(accountingWorkspace, /className="accountCreateGrid"/);
  assert.doesNotMatch(accountingWorkspace, /gridTemplateColumns:\s*'120px minmax\(180px, 1fr\) 150px auto'/);
  assert.match(adminCss, /\.accountCreateGrid\s*\{[^}]*grid-cols-1[^}]*md:grid-cols-2/s);
  assert.match(adminCss, /@media \(width >= 96rem\)[\s\S]*?\.accountCreateGrid\s*\{\s*grid-template-columns:\s*120px minmax\(180px,1fr\) 150px auto;/);
});

test('P5 V2 art direction answers human visual rejection with four distinct layered product identities', () => {
  assert.equal(artDirection.phase, 'P5-V2');
  assert.equal(artDirection.baseline.commit, 'af7cb87bbdc1ee898f785a072993e79877326b27');
  assert.equal(artDirection.baseline.automatedP5, 'PASS');
  assert.equal(artDirection.baseline.humanVisualAcceptance, 'REJECTED');
  assert.equal(artDirection.decision.deliveryBoundary, 'ONE_P5_FULL_V2_ATOMIC_WAVE');
  assert.equal(artDirection.decision.businessLogicChangesAllowed, false);
  assert.equal(artDirection.decision.glassLayeringRequired, true);
  assert.equal(artDirection.decision.elevationRequired, true);
  assert.equal(artDirection.decision.decorativeGradientsAllowed, false);

  const themes = Object.values(artDirection.products).map((item) => item.theme);
  assert.equal(new Set(themes).size, 4);
  assert.equal(artDirection.products.storefront.theme, 'light-premium-retail');
  assert.equal(artDirection.products.employeePortal.theme, 'light-violet-self-service');

  assert.match(adminCss, /backdrop-filter:\s*blur/);
  assert.match(adminCss, /box-shadow:/);
  assert.match(adminCss, /\.navLabel small \{ display: none; \}/);
  assert.match(cssBundle, /color-scheme:\s*light/);
  assert.doesNotMatch(cssBundle, /(?:linear|radial|conic)-gradient\s*\(/i);
});
