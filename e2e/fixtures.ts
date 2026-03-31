import { test as base, expect } from '@playwright/test'

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3001'

type Fixtures = {
  authedPage: ReturnType<typeof base['page']> extends Promise<infer P> ? P : never
  createDeck: (name?: string) => Promise<{ id: string; slug: string }>
  addSlide: (deckId: string, layout: string) => Promise<{ id: string }>
  addBlock: (deckId: string, slideId: string, block: { type: string; zone: string; data: Record<string, unknown> }) => Promise<{ id: string }>
}

export const test = base.extend<Fixtures>({
  authedPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    })
    const page = await ctx.newPage()
    await use(page)
    await ctx.close()
  },

  createDeck: async ({ authedPage }, use) => {
    await use(async (name = 'E2E Test Deck') => {
      const res = await authedPage.request.post(`${API_URL}/api/decks`, {
        data: { name },
      })
      expect(res.ok()).toBeTruthy()
      const deck = await res.json()
      return { id: deck.id, slug: deck.slug }
    })
  },

  addSlide: async ({ authedPage }, use) => {
    await use(async (deckId, layout) => {
      const res = await authedPage.request.post(`${API_URL}/api/decks/${deckId}/slides`, {
        data: { layout },
      })
      expect(res.ok()).toBeTruthy()
      const slide = await res.json()
      return { id: slide.id ?? slide.slide?.id }
    })
  },

  addBlock: async ({ authedPage }, use) => {
    await use(async (deckId, slideId, block) => {
      const res = await authedPage.request.post(
        `${API_URL}/api/decks/${deckId}/slides/${slideId}/blocks`,
        { data: block },
      )
      expect(res.ok()).toBeTruthy()
      const result = await res.json()
      return { id: result.id ?? result.block?.id }
    })
  },
})

export { expect }
