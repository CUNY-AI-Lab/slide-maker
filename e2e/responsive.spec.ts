import { test, expect } from './fixtures'

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'narrow', width: 860, height: 600 },
]

for (const vp of VIEWPORTS) {
  test(`modules render at ${vp.name} viewport (${vp.width}x${vp.height})`, async ({
    authedPage: page,
    createDeck,
    addSlide,
    addBlock,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    const deck = await createDeck(`Responsive ${vp.name}`)
    const slide = await addSlide(deck.id, 'layout-content')
    await addBlock(deck.id, slide.id, {
      type: 'heading',
      zone: 'main',
      data: { text: 'Responsive Heading', level: 1 },
    })
    await addBlock(deck.id, slide.id, {
      type: 'card-grid',
      zone: 'main',
      data: {
        cards: [
          { title: 'A', content: 'Card A' },
          { title: 'B', content: 'Card B' },
          { title: 'C', content: 'Card C' },
        ],
        columns: 3,
      },
    })

    await page.goto(`/deck/${deck.id}`)
    await page.waitForSelector('.slide-frame')

    // Heading should be visible
    await expect(page.locator('h1')).toContainText('Responsive Heading')

    // Card grid should be visible
    const grid = page.locator('.card-grid')
    await expect(grid).toBeVisible()

    // Slide frame should maintain aspect ratio
    const frame = page.locator('.slide-frame')
    const box = await frame.boundingBox()
    expect(box).toBeTruthy()
    if (box) {
      const ratio = box.width / box.height
      // Should be roughly 16:9 (1.77) — allow some tolerance
      expect(ratio).toBeGreaterThan(1.3)
      expect(ratio).toBeLessThan(2.2)
    }
  })
}
