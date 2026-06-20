import { defineConfig, devices } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const CUSTOMER_BASE = process.env.CUSTOMER_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: CUSTOMER_BASE,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  expect: {
    timeout: 10_000,
  },
  timeout: 60_000,
});

export { API_BASE, CUSTOMER_BASE };
