/**
 * Utility to list saved screenshots and their base64 file paths.
 * 
 * Usage:
 *   node e2e/view-screenshots.js           — lists all screenshots
 *   node e2e/view-screenshots.js <name>    — prints the base64 data URI of a specific screenshot
 *
 * The base64 output can be pasted into any tool that accepts data URIs,
 * or consumed by AI assistants that can read base64 images.
 */

const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

function listScreenshots() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.log('No screenshots directory found. Run tests first.');
    return;
  }

  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  
  if (files.length === 0) {
    console.log('No screenshots found. Run tests first.');
    return;
  }

  console.log(`\n📸 Found ${files.length} screenshot(s) in ${SCREENSHOT_DIR}:\n`);
  
  files.forEach((f, i) => {
    const stats = fs.statSync(path.join(SCREENSHOT_DIR, f));
    const sizeKb = (stats.size / 1024).toFixed(1);
    const base64File = f.replace('.png', '.base64.txt');
    const hasBase64 = fs.existsSync(path.join(SCREENSHOT_DIR, base64File));
    console.log(`  ${i + 1}. ${f} (${sizeKb} KB) ${hasBase64 ? '✅ base64' : ''}`);
  });

  console.log(`\nTo view a screenshot's base64:\n  node e2e/view-screenshots.js <partial-name>\n`);
}

function showScreenshot(filter) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    console.log('No screenshots found.');
    return;
  }

  const base64Files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.base64.txt'));
  const match = base64Files.find(f => f.toLowerCase().includes(filter.toLowerCase()));
  
  if (!match) {
    console.log(`No screenshot matching "${filter}" found.`);
    return;
  }

  const content = fs.readFileSync(path.join(SCREENSHOT_DIR, match), 'utf-8');
  console.log(`\n📸 ${match}:\n`);
  console.log(content);
}

// ── Main ──
const arg = process.argv[2];
if (arg) {
  showScreenshot(arg);
} else {
  listScreenshots();
}
