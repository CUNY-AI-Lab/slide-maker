import { test as setup } from '@playwright/test'

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3001'

setup('authenticate as admin', async ({ request }) => {
  const email = 'zmuhlbauer@gc.cuny.edu'
  const password = process.env.ADMIN_SEED_PASSWORD
  if (!password) throw new Error('ADMIN_SEED_PASSWORD env var required for E2E tests')

  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Login failed (${res.status()}): ${body}`)
  }

  // Save authenticated state (cookies) for other tests
  await request.storageState({ path: 'e2e/.auth/admin.json' })
})
