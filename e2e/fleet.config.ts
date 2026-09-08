import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'fleet-browser.scenario.ts', timeout: 60000, retries: 0,
  use: { baseURL: 'http://127.0.0.1:5279', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { cwd: resolve(__dirname, '..'), command: 'bun x tsx e2e/fleet-server.mts', url: 'http://127.0.0.1:5279/health', reuseExistingServer: false, timeout: 60000 },
})
