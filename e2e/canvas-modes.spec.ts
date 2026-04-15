import { test, expect } from './fixtures'

test('edit mode shows editing controls, view mode hides them', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('Canvas Mode Test')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'heading',
    zone: 'main',
    data: { text: 'Mode Test', level: 1 },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.slide-frame')

  // Edit mode: hover over module should show drag handle
  const moduleWrapper = page.locator('.module-wrapper').first()
  await moduleWrapper.hover()
  await expect(page.locator('.canvas-drag-handle').first()).toBeVisible()

  // Switch to view mode via toolbar button (Escape navigates to gallery)
  await page.locator('.mode-btn', { hasText: 'View' }).click()
  await page.waitForTimeout(300)

  // View mode: no editing controls
  await expect(page.locator('.canvas-drag-handle')).toHaveCount(0)

  // View mode: click overlay should be present
  await expect(page.locator('.click-overlay')).toBeVisible()

  // Click to return to edit mode
  await page.locator('.click-overlay').click()
  await page.waitForTimeout(300)

  // Back in edit mode: controls available again
  const wrapper = page.locator('.module-wrapper').first()
  await wrapper.hover()
  await expect(page.locator('.canvas-drag-handle').first()).toBeVisible()
})

test('view mode uses native rendering, not iframe', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('No Iframe Test')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'text',
    zone: 'main',
    data: { markdown: 'Native rendering test' },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.slide-frame')

  // Switch to view mode via toolbar button (Escape navigates to gallery)
  await page.locator('.mode-btn', { hasText: 'View' }).click()
  await page.waitForTimeout(300)

  // Should NOT have a slide-preview-frame iframe
  const previewIframes = await page.locator('.slide-preview-frame').count()
  expect(previewIframes).toBe(0)

  // Should have view-mode class on slide-frame
  await expect(page.locator('.slide-frame.view-mode')).toBeVisible()

  // Content should be directly in the DOM, not in an iframe
  await expect(page.locator('.slide-frame .text-block')).toContainText('Native rendering test')
})

test('split layout renders both zones', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('Split Layout Test')
  const slide = await addSlide(deck.id, 'layout-split')
  await addBlock(deck.id, slide.id, {
    type: 'heading',
    zone: 'content',
    data: { text: 'Left Zone', level: 2 },
  })
  await addBlock(deck.id, slide.id, {
    type: 'heading',
    zone: 'stage',
    data: { text: 'Right Zone', level: 2 },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.slide-frame')

  // Both zones should render
  await expect(page.locator('.zone-left')).toBeVisible()
  await expect(page.locator('.zone-right')).toBeVisible()
  await expect(page.locator('.zone-left')).toContainText('Left Zone')
  await expect(page.locator('.zone-right')).toContainText('Right Zone')
})
