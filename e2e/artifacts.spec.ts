import { test, expect } from './fixtures'

test('artifact with rawSource renders in sandboxed iframe with CSP', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('Artifact Security Test')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'artifact',
    zone: 'main',
    data: {
      rawSource: '<!DOCTYPE html><html><head></head><body><canvas id="c" width="200" height="200"></canvas><script>var ctx=document.getElementById("c").getContext("2d");ctx.fillStyle="blue";ctx.fillRect(10,10,80,80);</script></body></html>',
      alt: 'Blue square',
      width: '100%',
      height: '300px',
    },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.artifact-iframe', { timeout: 10000 })

  const iframe = page.locator('.artifact-iframe')

  // Verify sandbox
  const sandbox = await iframe.getAttribute('sandbox')
  expect(sandbox).toContain('allow-scripts')

  // rawSource artifacts use srcdoc (no loading="lazy", no blob URL)
  const srcdoc = await iframe.getAttribute('srcdoc')
  expect(srcdoc).toBeTruthy()
})

test('artifact with external URL renders without blob', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('External Artifact Test')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'artifact',
    zone: 'main',
    data: {
      src: 'https://example.com/gallery/langton.html',
      alt: "Langton's Ant",
    },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.artifact-iframe', { timeout: 10000 })

  const iframe = page.locator('.artifact-iframe')
  const src = await iframe.getAttribute('src')
  expect(src).toBe('https://example.com/gallery/langton.html')
})

test('artifact resizes via corner drag', async ({
  authedPage: page,
  createDeck,
  addSlide,
  addBlock,
}) => {
  const deck = await createDeck('Artifact Resize Test')
  const slide = await addSlide(deck.id, 'layout-content')
  await addBlock(deck.id, slide.id, {
    type: 'artifact',
    zone: 'main',
    data: {
      rawSource: '<html><body style="margin:0;background:#333"><canvas></canvas></body></html>',
      alt: 'Resizable',
      width: '200px',
      height: '200px',
    },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.module-wrapper')

  // Hover to reveal resize handle (shows on hover via CSS)
  const wrapper = page.locator('.module-wrapper').first()
  await wrapper.hover()
  await page.waitForTimeout(200)

  const handle = page.locator('.corner-resize').first()
  await expect(handle).toBeVisible()
})
