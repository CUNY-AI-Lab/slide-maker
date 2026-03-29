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

// GET /api/artifacts — list all artifacts
resourcesRouter.get('/artifacts', async (c) => {
  const allArtifacts = await db.select().from(artifacts)
  return c.json({ artifacts: allArtifacts })
})

export default resourcesRouter
