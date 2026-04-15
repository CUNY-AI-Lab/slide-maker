import { test, expect } from './fixtures'

const MODULE_FIXTURES: Array<{
  type: string
  zone: string
  data: Record<string, unknown>
  selector: string
  content?: string
}> = [
  {
    type: 'heading',
    zone: 'main',
    data: { text: 'E2E Heading Test', level: 1 },
    selector: 'h1',
    content: 'E2E Heading Test',
  },
  {
    type: 'text',
    zone: 'main',
    data: { markdown: 'E2E paragraph with **bold** text' },
    selector: '.text-block',
    content: 'E2E paragraph',
  },
  {
    type: 'card',
    zone: 'main',
    data: { content: '<p>Card body content</p>', variant: 'cyan' },
    selector: '.card',
    content: 'Card body content',
  },
  {
    type: 'label',
    zone: 'main',
    data: { text: 'LABEL TEXT', color: 'cyan' },
    selector: '.label',
    content: 'LABEL TEXT',
  },
  {
    type: 'tip-box',
    zone: 'main',
    data: { content: 'Tip content here', title: 'Pro Tip' },
    selector: '.tip-box',
    content: 'Tip content',
  },
  {
    type: 'prompt-block',
    zone: 'main',
    data: { content: 'const x = 42;', quality: 'good', language: 'javascript' },
    selector: '.prompt-block',
    content: 'const x = 42',
  },
  {
    type: 'comparison',
    zone: 'main',
    data: { panels: [{ title: 'Before', content: 'Old way' }, { title: 'After', content: 'New way' }] },
    selector: '.comparison',
    content: 'Before',
  },
  {
    type: 'card-grid',
    zone: 'main',
    data: { cards: [{ title: 'Card A', content: 'Content A' }, { title: 'Card B', content: 'Content B' }], columns: 2 },
    selector: '.card-grid',
    content: 'Card A',
  },
  {
    type: 'flow',
    zone: 'main',
    data: { nodes: [{ label: 'Step 1' }, { label: 'Step 2' }, { label: 'Step 3' }] },
    selector: '.flow',
    content: 'Step 1',
  },
  {
    type: 'stream-list',
    zone: 'main',
    data: { items: ['Item one', 'Item two', 'Item three'] },
    selector: '.stream-list',
    content: 'Item one',
  },
  {
    type: 'image',
    zone: 'main',
    data: { src: 'https://via.placeholder.com/200x100', alt: 'Test image', caption: 'Test caption' },
    selector: '.image-block',
  },
  {
    type: 'carousel',
    zone: 'main',
    data: { items: [{ src: 'https://via.placeholder.com/200x100', caption: 'Slide 1' }] },
    selector: '.carousel',
  },
]

for (const mod of MODULE_FIXTURES) {
  test(`${mod.type} module renders in edit and view mode`, async ({
    authedPage: page,
    createDeck,
    addSlide,
    addBlock,
  }) => {
    // Create deck with a content slide + module
    const deck = await createDeck(`Test ${mod.type}`)
    const slide = await addSlide(deck.id, 'layout-content')
    await addBlock(deck.id, slide.id, { type: mod.type, zone: mod.zone, data: mod.data })

    // Navigate to deck
    await page.goto(`/deck/${deck.id}`)
    await page.waitForSelector('.slide-canvas')

    const slideFrame = page.locator('.slide-frame')
    await expect(slideFrame).toBeVisible()

    // Switch to view mode via toolbar button (Escape navigates to gallery)
    await page.locator('.mode-btn', { hasText: 'View' }).click()
    await page.waitForTimeout(300)

    // Verify module renders in view mode
    const viewModule = slideFrame.locator(mod.selector).first()
    await expect(viewModule).toBeVisible({ timeout: 5000 })

    if (mod.content) {
      await expect(viewModule).toContainText(mod.content)
    }

    // Verify NO iframe in view mode (only artifact modules should have iframes)
    const iframes = await slideFrame.locator('iframe').count()
    expect(iframes).toBe(0)

    // Switch to edit mode and verify slide frame still renders
    await page.locator('.mode-btn', { hasText: 'Edit' }).click()
    await page.waitForTimeout(300)

    await expect(slideFrame).toBeVisible()
  })
}

test('artifact module renders with iframe in both modes', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('Test artifact')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'artifact',
    zone: 'main',
    data: {
      rawSource: '<!DOCTYPE html><html><body><canvas id="c"></canvas><script>document.getElementById("c").getContext("2d").fillRect(0,0,50,50)</script></body></html>',
      alt: 'Test artifact',
      width: '100%',
      height: '200px',
    },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.slide-frame')

  // Artifact should have an iframe
  const iframe = page.locator('.artifact-iframe')
  await expect(iframe).toBeVisible({ timeout: 5000 })

  // Verify sandbox attributes
  const sandbox = await iframe.getAttribute('sandbox')
  expect(sandbox).toContain('allow-scripts')

  // Switch to view mode via toolbar button (Escape navigates to gallery)
  await page.locator('.mode-btn', { hasText: 'View' }).click()
  await page.waitForTimeout(300)

  // Iframe should still be present in view mode (artifacts keep iframes)
  await expect(iframe).toBeVisible()
})
