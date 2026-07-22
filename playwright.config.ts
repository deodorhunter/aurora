import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: [
    'packages/*/acceptance/tests/**/*.{spec,test}.{ts,tsx}',
    'apps/*/acceptance/tests/**/*.{spec,test}.{ts,tsx}',
  ],
  outputDir: 'playwright/results',
  // Disable parallel tests to avoid conflicts creating/deleting content
  workers: 1,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  // Retry on CI only.
  retries: process.env.CI ? 3 : 0,
  timeout: 10_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    // Env override so an acceptance frontend can run on a free port instead of
    // fighting a dev server for :3000. Defaults to the previous hardcoded value,
    // so nothing changes unless PLAYWRIGHT_BASE_URL is set.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    // Use video only while debugging CI
    // video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{ext}',
});
