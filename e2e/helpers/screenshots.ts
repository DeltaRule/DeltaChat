import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

/** Ensure the screenshots directory exists */
function ensureDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

/**
 * Take a screenshot and save it as both PNG and a base64 text file
 * that can be consumed in context without external tools.
 *
 * @returns {{ pngPath: string, base64Path: string, base64: string }}
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<{ pngPath: string; base64Path: string; base64: string }> {
  ensureDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_${timestamp}`;

  const pngPath = path.join(SCREENSHOT_DIR, `${filename}.png`);
  const base64Path = path.join(SCREENSHOT_DIR, `${filename}.base64.txt`);

  const buffer = await page.screenshot({
    path: pngPath,
    fullPage: options?.fullPage ?? false,
  });

  const base64 = buffer.toString('base64');

  // Save a text file with the base64 content — prefix with data URI for easy embedding
  fs.writeFileSync(base64Path, `data:image/png;base64,${base64}`, 'utf-8');

  console.log(`📸 Screenshot saved: ${pngPath}`);
  console.log(`📋 Base64 saved:     ${base64Path} (${(base64.length / 1024).toFixed(1)} KB)`);

  return { pngPath, base64Path, base64 };
}

/**
 * Take a screenshot of a specific element
 */
export async function takeElementScreenshot(
  page: Page,
  selector: string,
  name: string
): Promise<{ pngPath: string; base64Path: string; base64: string }> {
  ensureDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_${timestamp}`;

  const pngPath = path.join(SCREENSHOT_DIR, `${filename}.png`);
  const base64Path = path.join(SCREENSHOT_DIR, `${filename}.base64.txt`);

  const element = page.locator(selector);
  const buffer = await element.screenshot({ path: pngPath });

  const base64 = buffer.toString('base64');
  fs.writeFileSync(base64Path, `data:image/png;base64,${base64}`, 'utf-8');

  console.log(`📸 Element screenshot saved: ${pngPath}`);

  return { pngPath, base64Path, base64 };
}

/**
 * List all saved screenshots with their base64 file paths (for context consumption)
 */
export function listScreenshots(): string[] {
  ensureDir();
  return fs.readdirSync(SCREENSHOT_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => path.join(SCREENSHOT_DIR, f));
}
