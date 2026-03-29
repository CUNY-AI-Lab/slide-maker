import { Hono } from 'hono'
import { createId } from '@paralleldrive/cuid2'
import { db } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { templates, themes, artifacts } from '../db/schema.js'
import { authMiddleware } from '../middleware/auth.js'

const resourcesRouter = new Hono()

// GET /api/templates — list all templates
resourcesRouter.get('/templates', async (c) => {
  const allTemplates = await db.select().from(templates)
  return c.json({ templates: allTemplates })
})

// GET /api/themes — list all themes
resourcesRouter.get('/themes', async (c) => {
  const allThemes = await db.select().from(themes)
  return c.json({ themes: allThemes })
})

// POST /api/themes — create a new theme
resourcesRouter.post('/themes', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const body = await c.req.json()

  const { name, colors, fonts } = body
  if (!name) return c.json({ error: 'Name is required' }, 400)

  const themeColors = colors ?? { primary: '#3b82f6', secondary: '#6366f1', accent: '#2FB8D6', bg: '#ffffff' }
  const themeFonts = fonts ?? { heading: 'Outfit', body: 'Inter' }

  // Validate color values to prevent CSS injection
  const hexColorRegex = /^#[0-9a-fA-F]{3,8}$/
  const fontNameRegex = /^[a-zA-Z0-9 \-]+$/

  for (const [key, val] of Object.entries(themeColors)) {
    if (val && typeof val === 'string' && !hexColorRegex.test(val)) {
      return c.json({ error: `Invalid color value for ${key}` }, 400)
    }
  }
  for (const [key, val] of Object.entries(themeFonts)) {
    if (val && typeof val === 'string' && !fontNameRegex.test(val)) {
      return c.json({ error: `Invalid font name for ${key}` }, 400)
    }
  }

  const css = `
:root {
  --slide-bg: ${themeColors.bg || '#ffffff'};
  --slide-text: #333333;
  --slide-heading-color: ${themeColors.primary || '#3b82f6'};
  --slide-accent: ${themeColors.secondary || '#6366f1'};
  --slide-accent-secondary: ${themeColors.accent || '#2FB8D6'};
  --slide-font-heading: '${themeFonts.heading || 'Outfit'}', system-ui, sans-serif;
  --slide-font-body: '${themeFonts.body || 'Inter'}', system-ui, sans-serif;
}
  `

  const id = createId()
  await db.insert(themes).values({
    id,
    name,
    css,
    fonts: themeFonts,
    colors: themeColors,
    builtIn: false,
    createdBy: user.id,
  })

  const created = await db.select().from(themes).where(eq(themes.id, id)).get()
  return c.json({ theme: created }, 201)
})

// DELETE /api/themes/:id — delete a custom theme (owner only)
resourcesRouter.delete('/themes/:id', authMiddleware, async (c) => {
  const user = c.get('user' as never) as { id: string }
  const themeId = c.req.param('id')
  if (!themeId) return c.json({ error: 'Missing theme id' }, 400)

  const theme = await db.select().from(themes).where(eq(themes.id, themeId)).get()
  if (!theme) return c.json({ error: 'Theme not found' }, 404)
  if (theme.builtIn) return c.json({ error: 'Cannot delete built-in themes' }, 403)
  if (!theme.createdBy || theme.createdBy !== user.id) return c.json({ error: 'Not authorized' }, 403)

  await db.delete(themes).where(eq(themes.id, themeId))
  return c.json({ ok: true })
})

// GET /api/artifacts — list all artifacts
resourcesRouter.get('/artifacts', async (c) => {
  const allArtifacts = await db.select().from(artifacts)
  return c.json({ artifacts: allArtifacts })
})

export default resourcesRouter
