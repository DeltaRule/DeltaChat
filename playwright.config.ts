import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // run tests sequentially — they depend on each other
  retries: 0,
  timeout: 120_000,               // 2 min per test (AI responses can be slow)
  expect: { timeout: 30_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e/report' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,              // visible browser so you can watch
    viewport: { width: 1440, height: 900 },
    screenshot: 'on',             // Playwright auto-screenshots on failure
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
