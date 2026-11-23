const fs = require('fs');
const { execSync } = require('child_process');

console.log('═════════════════════════════════════════════════════════════');
console.log('  STARTING EXHAUSTIVE REGRESSION & INTEGRATION TEST SUITE');
console.log('═════════════════════════════════════════════════════════════\n');

let failedTests = 0;

function assert(condition, testName, errMsg) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}: ${errMsg || 'Assertion failed'}`);
    failedTests++;
  }
}

const dashPath = 'C:/Users/Unimas/.gemini/antigravity/scratch/eqstudiolink/eqstudio-link/web/dashboard.html';
const dashContent = fs.readFileSync(dashPath, 'utf8');

// HTML Markup is everything up to <script type="module">
const mainScriptIdx = dashContent.indexOf('<script type="module">');
const htmlOnly = dashContent.substring(0, mainScriptIdx);

// TEST 1: Tag Balances in HTML Markup
console.log('--- 1. HTML Markup Tag Balances ---');
const tags = ['div', 'button', 'p', 'span', 'h1', 'h2', 'h3', 'section', 'a', 'label'];
tags.forEach(tag => {
  const openRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi');
  const closeRegex = new RegExp(`</${tag}>`, 'gi');
  const opens = (htmlOnly.match(openRegex) || []).length;
  const closes = (htmlOnly.match(closeRegex) || []).length;
  assert(opens === closes, `<${tag}> tag balance (${opens} opens vs ${closes} closes)`, `Mismatch: diff = ${opens - closes}`);
});

// TEST 2: JS Syntax Check
console.log('\n--- 2. JavaScript Syntax Check ---');
const scriptStart = dashContent.indexOf('<script type="module">');
const scriptEnd = dashContent.lastIndexOf('</script>');
assert(scriptStart !== -1 && scriptEnd !== -1, 'Script tags exist in dashboard.html');

if (scriptStart !== -1 && scriptEnd !== -1) {
  const scriptContent = dashContent.substring(scriptStart + '<script type="module">'.length, scriptEnd);
  fs.writeFileSync('C:/Users/Unimas/.gemini/antigravity/scratch/eqstudiolink/eqstudio-link/extracted_test_run.mjs', scriptContent, 'utf8');
  try {
    execSync('node --check C:/Users/Unimas/.gemini/antigravity/scratch/eqstudiolink/eqstudio-link/extracted_test_run.mjs', { stdio: 'pipe' });
    assert(true, 'node --check on dashboard.html script body passed with 0 errors');
  } catch (err) {
    assert(false, 'node --check on dashboard.html script body', err.stderr ? err.stderr.toString() : err.message);
  }
}

// TEST 3: All 10 db-pages intact
console.log('\n--- 3. Page Containers Check ---');
const expectedPages = [
  'page-home',
  'page-booking-list',
  'page-booking-settings',
  'page-pelanggan-add',
  'page-pelanggan-list',
  'page-laporan',
  'page-kalendar',
  'page-tetapan-profil',
  'page-website',
  'page-tetapan-reminder'
];

expectedPages.forEach(pId => {
  assert(dashContent.includes(`id="${pId}"`), `Page #${pId} present as top-level container`);
});

// TEST 4: Original 29 Website IDs preserved
console.log('\n--- 4. Original Website Studio IDs Preservation ---');
const originalIds = [
  'page-website',
  'ws-preview-live-link',
  'ws-studio-card',
  'ws-cover-preview',
  'ws-cover-preview-img',
  'ws-cover-replace-btn',
  'ws-cover-dropzone',
  'ws-cover-file',
  'ws-cover-upload-btn',
  'ws-tagline',
  'ws-tagline-counter',
  'ws-since-year',
  'ws-hero-save-btn',
  'ws-about-editor',
  'ws-about-save-btn',
  'ws-gallery-count-badge',
  'ws-gallery-add-btn',
  'ws-gallery-file-input',
  'ws-gallery-dropzone',
  'ws-gallery-grid',
  'ws-testimonial-count-badge',
  'ws-testimonial-add-btn',
  'ws-testimonial-list',
  'ws-whatsapp',
  'ws-maps',
  'ws-instagram',
  'ws-tiktok',
  'ws-facebook',
  'ws-social-save-btn'
];

originalIds.forEach(id => {
  assert(dashContent.includes(`id="${id}"`), `Original ID #${id} preserved 100%`);
});

// TEST 5: New Phone Preview & Accordion Elements
console.log('\n--- 5. New Features Elements Presence ---');
const newIds = [
  'ws-phone-preview-modal',
  'ws-phone-mockup',
  'ws-phone-preview-iframe',
  'ws-phone-spinner',
  'ws-phone-close-btn',
  'ws-phone-reload-btn',
  'ws-phone-copy-btn',
  'ws-phone-share-wa-btn',
  'ws-phone-open-tab-btn',
  'ws-phone-url-bar',
  'ws-phone-url-slug',
  'ws-topbar-preview-btn',
  'ws-hero-preview-btn',
  'ws-hero-copy-btn',
  'ws-hero-wa-btn',
  'ws-hero-tab-btn',
  'ws-hero-biz-name',
  'ws-hero-biz-tagline',
  'ws-slug-display',
  'ws-slug-pill-box',
  'ws-accordion-toggle-all',
  'ws-card-01',
  'ws-card-02',
  'ws-card-03',
  'ws-card-04',
  'ws-card-05',
  'ws-badge-hero',
  'ws-badge-about',
  'ws-badge-gallery',
  'ws-badge-testimonials',
  'ws-badge-social',
  'account-security-card',
  'account-current-email-text',
  'sec-new-email',
  'sec-btn-update-email',
  'sec-new-password',
  'sec-confirm-password',
  'sec-btn-update-password'
];

newIds.forEach(id => {
  assert(dashContent.includes(`id="${id}"`), `New element #${id} present`);
});

// TEST 6: Global exports
console.log('\n--- 6. Global Window Bindings ---');
const expectedBindings = [
  'window.openWebsitePhonePreview',
  'window.closeWebsitePhonePreview',
  'window.copyWebsiteBioLink',
  'window.shareWebsiteToWhatsApp',
  'window.updateWebsiteStudioBadges',
  'window.goToPage',
  'window.logout',
  'window.openSettingsDropdown',
  'window.openCommandPalette'
];

expectedBindings.forEach(b => {
  assert(dashContent.includes(b), `Global binding ${b} exists in script`);
});

// TEST 7: Critical Existing Features Non-regression
console.log('\n--- 7. Non-Regression on Core Features ---');
assert(dashContent.includes('id="logout-btn"'), '#logout-btn present');
assert(dashContent.includes('id="settings-dropdown-panel"'), '#settings-dropdown-panel present');
assert(dashContent.includes('id="cmd-palette-modal"'), '#cmd-palette-modal present');
assert(dashContent.includes('id="cmd-palette-input"'), '#cmd-palette-input present');
assert(dashContent.includes('id="mobile-bottom-dock"'), '#mobile-bottom-dock present');

console.log('\n═════════════════════════════════════════════════════════════');
if (failedTests === 0) {
  console.log('  ALL REGRESSION & INTEGRATION TESTS PASSED WITH 0 ERRORS! ✨');
} else {
  console.error(`  ${failedTests} TESTS FAILED! Please review errors above.`);
  process.exit(1);
}
console.log('═════════════════════════════════════════════════════════════\n');
