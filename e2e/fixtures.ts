import { test as base, expect, type Page } from '@playwright/test'

const API_URL = process.env.PUBLIC_API_URL ?? 'http://localhost:3001'

type Fixtures = {
  authedPage: Page
  createDeck: (name?: string) => Promise<{ id: string; slug: string }>
  deleteDeck: (deckId: string) => Promise<void>
  addSlide: (deckId: string, layout: string) => Promise<{ id: string }>
  addMultipleSlides: (deckId: string, layouts: string[]) => Promise<{ id: string }[]>
  addBlock: (deckId: string, slideId: string, block: { type: string; zone: string; data: Record<string, unknown> }) => Promise<{ id: string }>
  gotoEditor: (deckId: string) => Promise<void>
  switchToViewMode: () => Promise<void>
  switchToEditMode: () => Promise<void>
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

  deleteDeck: async ({ authedPage }, use) => {
    await use(async (deckId) => {
      const res = await authedPage.request.delete(`${API_URL}/api/decks/${deckId}`)
      expect(res.ok()).toBeTruthy()
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

  addMultipleSlides: async ({ authedPage }, use) => {
    await use(async (deckId, layouts) => {
      const slides: { id: string }[] = []
      for (const layout of layouts) {
        const res = await authedPage.request.post(`${API_URL}/api/decks/${deckId}/slides`, {
          data: { layout },
        })
        expect(res.ok()).toBeTruthy()
        const slide = await res.json()
        slides.push({ id: slide.id ?? slide.slide?.id })
      }
      return slides
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

  gotoEditor: async ({ authedPage }, use) => {
    await use(async (deckId) => {
      await authedPage.goto(`/deck/${deckId}`)
      // Wait for editor shell to load (slide-frame only exists if there are slides)
      await authedPage.waitForSelector('.editor-outer', { timeout: 10000 })
    })
  },

  switchToViewMode: async ({ authedPage }, use) => {
    await use(async () => {
      await authedPage.locator('.mode-btn', { hasText: 'View' }).click()
      await authedPage.waitForTimeout(300)
    })
  },

  switchToEditMode: async ({ authedPage }, use) => {
    await use(async () => {
      await authedPage.locator('.mode-btn', { hasText: 'Edit' }).click()
      await authedPage.waitForTimeout(300)
    })
  },
})

export { expect }
