import { hash } from '@node-rs/argon2'
import { createId } from '@paralleldrive/cuid2'
import { db } from './index.js'
import { users, templates, themes, artifacts } from './schema.js'
import { eq } from 'drizzle-orm'
import fs from 'node:fs'
import path from 'node:path'

// Resolve project root (seed runs from apps/api/)
const scriptDir = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname)
const projectRoot = path.resolve(scriptDir, '..', '..', '..', '..')
const templatesDir = path.join(projectRoot, 'templates')

async function seedTemplates() {
  // Clear existing built-in templates before re-seeding
  await db.delete(templates).where(eq(templates.builtIn, true))
  console.log('Cleared existing built-in templates.')

  const subdirs = [
    'title-slide',
    'layout-split',
    'layout-content',
    'layout-grid',
    'layout-full-dark',
    'layout-divider',
    'closing-slide',
  ]
  let count = 0

  for (const subdir of subdirs) {
    const dir = path.join(templatesDir, subdir)
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const template = JSON.parse(raw)

      await db
        .insert(templates)
        .values({
          id: createId(),
          name: template.name,
          layout: template.layout,
          modules: template.modules,
          builtIn: true,
          createdBy: null,
        })
        .onConflictDoNothing()

      count++
    }
  }

  console.log(`Seeded ${count} templates.`)
}

function generateThemeCss(colors: { primary: string; secondary: string; accent: string; bg: string }, fonts: { heading: string; body: string }): string {
  return `
:root {
  --slide-bg: ${colors.bg};
  --slide-text: #333333;
  --slide-heading-color: ${colors.primary};
  --slide-accent: ${colors.secondary};
  --slide-accent-secondary: ${colors.accent};
  --slide-font-heading: '${fonts.heading}', system-ui, sans-serif;
  --slide-font-body: '${fonts.body}', system-ui, sans-serif;
}
  `
}

async function seedThemes() {
  // Clear existing built-in themes before re-seeding
  await db.delete(themes).where(eq(themes.builtIn, true))
  console.log('Cleared existing built-in themes.')

  // Prefer external data/themes.json if present for easier integration/testing
  let themeList: { id: string; name: string; colors: any; fonts: any }[] = []
  const themesJson = path.join(projectRoot, 'data', 'themes.json')
  if (fs.existsSync(themesJson)) {
    const raw = fs.readFileSync(themesJson, 'utf-8')
    try { themeList = JSON.parse(raw) } catch (e) { console.warn('Failed to parse data/themes.json; falling back to inline list') }
  }

  if (themeList.length === 0) themeList = [
    {
      id: 'studio-dark',
      name: 'Studio Dark',
      // High-contrast, accessible palette
      colors: { primary: '#1D3A83', secondary: '#64b5f6', accent: '#2FB8D6', bg: '#0c1220' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'studio-light',
      name: 'Studio Light',
      // Light mode with strong title background for white text
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#0C7F96', bg: '#ffffff' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'cuny-ai-lab-default',
      name: 'CUNY AI Lab',
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#0C7F96', bg: '#ffffff' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'cuny-dark',
      name: 'CUNY Dark',
      colors: { primary: '#1e3a5f', secondary: '#3b82f6', accent: '#64b5f6', bg: '#111827' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'cuny-light',
      name: 'CUNY Light',
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#0C7F96', bg: '#ffffff' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'warm-academic',
      name: 'Warm Academic',
      colors: { primary: '#7c3aed', secondary: '#6d28d9', accent: '#b45309', bg: '#faf5ef' },
      fonts: { heading: 'Georgia', body: 'Inter' },
    },
    {
      id: 'slate-minimal',
      name: 'Slate Minimal',
      colors: { primary: '#334155', secondary: '#64748b', accent: '#0369a1', bg: '#f8fafc' },
      fonts: { heading: 'Inter', body: 'Inter' },
    },
    {
      id: 'midnight',
      name: 'Midnight',
      colors: { primary: '#312e81', secondary: '#6366f1', accent: '#a78bfa', bg: '#0f0e17' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'forest',
      name: 'Forest',
      colors: { primary: '#065f46', secondary: '#059669', accent: '#047857', bg: '#f0fdf4' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
  ]

  for (const t of themeList) {
    await db.insert(themes).values({
      id: t.id,
      name: t.name,
      css: generateThemeCss(t.colors, t.fonts),
      fonts: t.fonts,
      colors: t.colors,
      builtIn: true,
      createdBy: null,
    }).onConflictDoNothing()
  }

  console.log(`Seeded ${themeList.length} themes.`)
}

async function seedArtifacts() {
  // Clear existing built-in artifacts before re-seeding
  await db.delete(artifacts).where(eq(artifacts.builtIn, true))

  // Load all artifacts from templates/artifacts/*.json
  // Inline /api/static/ script/link references so artifacts work in sandboxed iframes
  const staticDir = path.join(scriptDir, '..', '..', 'static')
  function inlineStaticRefs(source: string): string {
    if (!source) return source
    // Inline <script src="/api/static/FILE"> → <script>...contents...</script>
    source = source.replace(
      /<script\s+src=["']\/api\/static\/([^"']+)["'][^>]*><\/script>/gi,
      (_match, filename) => {
        const filePath = path.join(staticDir, filename)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          return `<script>${content}<\/script>`
        }
        return _match // leave as-is if file not found
      },
    )
    // Inline <link rel="stylesheet" href="/api/static/FILE"> → <style>...contents...</style>
    source = source.replace(
      /<link\s+rel=["']stylesheet["']\s+href=["']\/api\/static\/([^"']+)["'][^>]*\/?>/gi,
      (_match, filename) => {
        const filePath = path.join(staticDir, filename)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          return `<style>${content}</style>`
        }
        return _match
      },
    )
    return source
  }

  const artifactsDir = path.join(templatesDir, 'artifacts')
  let templateCount = 0

  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const raw = fs.readFileSync(path.join(artifactsDir, file), 'utf-8')
      const template = JSON.parse(raw)

      await db
        .insert(artifacts)
        .values({
          id: template.id,
          name: template.name,
          description: template.description || '',
          type: (template.type ?? 'visualization') as 'chart' | 'diagram' | 'map' | 'visualization',
          source: inlineStaticRefs(template.source),
          config: template.config ?? {},
          builtIn: true,
          createdBy: null,
        })
        .onConflictDoNothing()

      templateCount++
    }
  }

  console.log(`Seeded ${templateCount} template artifacts.`)
}

async function seedAdminUsers() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD
  if (!adminPassword) {
    console.log('Skipping admin seed: ADMIN_SEED_PASSWORD env var not set')
    return
  }

  const admins = [
    { email: 'smorello@gc.cuny.edu', password: adminPassword, name: 'Stefano Morello' },
    { email: 'zmuhlbauer@gc.cuny.edu', password: adminPassword, name: 'Zach Muhlbauer' },
    { email: 'szweibel@gc.cuny.edu', password: adminPassword, name: 'Stephen Zweibel' },
  ]

  for (const admin of admins) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, admin.email.toLowerCase()))
      .get()

    if (existing) {
      await db
        .update(users)
        .set({
          role: 'admin',
          status: 'approved',
          emailVerified: true,
          name: admin.name,
        })
        .where(eq(users.email, admin.email.toLowerCase()))
      console.log(`Updated ${admin.email} to admin.`)
      continue
    }

    const passwordHash = await hash(admin.password)
    const userId = createId()

    await db.insert(users).values({
      id: userId,
      email: admin.email.toLowerCase(),
      name: admin.name,
      passwordHash,
      emailVerified: true,
      status: 'approved',
      role: 'admin',
      createdAt: new Date(),
    })

    console.log(`Admin user created: ${admin.email}`)
  }
}

async function seedAdmin(args: string[]) {
  const adminIndex = args.indexOf('--admin')
  const email = args[adminIndex + 1]
  if (!email) {
    console.error('Please provide an email after --admin')
    process.exit(1)
  }

  // Parse optional --password flag
  const passwordIndex = args.indexOf('--password')
  const password =
    passwordIndex !== -1 && args[passwordIndex + 1] ? args[passwordIndex + 1] : 'changeme123'

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).get()
  if (existing) {
    console.log(`User with email ${email} already exists. Updating to admin...`)
    await db
      .update(users)
      .set({
        role: 'admin',
        status: 'approved',
        emailVerified: true,
      })
      .where(eq(users.email, email.toLowerCase()))
    console.log(`Updated ${email} to admin.`)
    return
  }

  const passwordHash = await hash(password)
  const userId = createId()

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    name: 'Admin',
    passwordHash,
    emailVerified: true,
    status: 'approved',
    role: 'admin',
    createdAt: new Date(),
  })

  console.log(`Admin user created: ${email}`)
}

async function main() {
  const args = process.argv.slice(2)
  const hasAdmin = args.includes('--admin')

  // Always seed templates, themes, artifacts, and admin users
  await seedTemplates()
  await seedThemes()
  await seedArtifacts()
  await seedAdminUsers()

  // Optionally seed additional admin user via CLI
  if (hasAdmin) {
    await seedAdmin(args)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
