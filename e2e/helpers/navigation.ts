import { Page, expect } from '@playwright/test';

/**
 * Navigate to Settings and select a specific tab.
 */
export async function goToSettings(page: Page, tab?: 'providers' | 'models' | 'knowledge' | 'agents' | 'tools') {
  // Click the settings gear icon in the header (navigates to /settings)
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  if (tab) {
    // Click the matching sidebar list item
    const tabLabels: Record<string, string> = {
      providers: 'Model Providers',
      models: 'Models',
      knowledge: 'Knowledge Stores',
      agents: 'Agents',
      tools: 'Tools',
    };
    const label = tabLabels[tab];
    await page.locator('.settings-nav .v-list-item').filter({ hasText: label }).click();
    await page.waitForTimeout(500);
  }
}

/**
 * Navigate to the Chat view.
 */
export async function goToChat(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for a Vuetify dialog to appear and be fully open.
 */
export async function waitForDialog(page: Page) {
  await page.locator('.v-dialog .v-card').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(400); // wait for Vuetify transition
}

/**
 * Click "Save" or "Create" inside the currently open dialog.
 */
export async function clickDialogAction(page: Page, label: string = 'Save') {
  await page.locator('.v-dialog .v-card-actions .v-btn').filter({ hasText: label }).click();
  await page.waitForTimeout(500);
}

/**
 * Wait for API to finish (network idle).
 */
export async function waitForApi(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Type into a Vuetify text field found by its label.
 */
export async function fillVuetifyField(page: Page, label: string, value: string, container?: string) {
  const scope = container ? page.locator(container) : page;
  // Vuetify outlined text-fields render the label inside the field
  const field = scope.locator('.v-text-field, .v-textarea').filter({ hasText: label });
  const input = field.locator('input, textarea').first();
  await input.click();
  await input.fill(value);
}

/**
 * Select from a Vuetify v-select by label and option text.
 */
export async function selectVuetifyOption(page: Page, label: string, optionText: string, container?: string) {
  const scope = container ? page.locator(container) : page;
  const select = scope.locator('.v-select, .v-combobox').filter({ hasText: label });
  await select.locator('.v-field').first().click();
  await page.waitForTimeout(300);
  // Vuetify renders the option list in the overlay
  await page.locator('.v-overlay .v-list-item').filter({ hasText: optionText }).first().click();
  await page.waitForTimeout(300);
}
