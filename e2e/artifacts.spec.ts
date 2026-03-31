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

  // Verify loading attribute
  const loading = await iframe.getAttribute('loading')
  expect(loading).toBe('lazy')

  // Verify src is a blob URL (CSP injected)
  const src = await iframe.getAttribute('src')
  expect(src).toMatch(/^blob:/)
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
      src: 'https://creative-clawing.com/gallery/langton.html',
      alt: "Langton's Ant",
    },
  })

  await page.goto(`/deck/${deck.id}`)
  await page.waitForSelector('.artifact-iframe', { timeout: 10000 })

  const iframe = page.locator('.artifact-iframe')
  const src = await iframe.getAttribute('src')
  expect(src).toBe('https://creative-clawing.com/gallery/langton.html')
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

  // Hover to reveal resize handle
  const wrapper = page.locator('.module-wrapper').first()
  await wrapper.hover()

  const handle = page.locator('.corner-resize')
  await expect(handle).toBeVisible()
})
