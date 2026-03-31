#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const themesPath = path.join(root, 'data', 'themes.json')
if (!fs.existsSync(themesPath)) {
  console.error('data/themes.json not found. Run db seed or ensure themes file exists.')
  process.exit(1)
}

const themes = JSON.parse(fs.readFileSync(themesPath, 'utf-8'))

// Utilities ---------------------------------------------------------
const hex = (s) => (typeof s === 'string' ? s.trim() : '')
const toRGB = (h) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h)
  if (!m) return null
  return { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 }
}
const relLum = (h) => {
  const rgb = toRGB(h)
  if (!rgb) return null
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const R = lin(rgb.r), G = lin(rgb.g), B = lin(rgb.b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
const contrast = (f, b) => {
  const L1 = relLum(f)
  const L2 = relLum(b)
  if (L1 == null || L2 == null) return null
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}
const isDark = (h) => {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h)
  if (!m) return true
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128
}

const AA = { normal: 4.5, large: 3.0 }
const AAA = { normal: 7.0, large: 4.5 }

function checkPair(name, fg, bg) {
  const ratio = contrast(fg, bg)
  const passAA = ratio >= AA.normal
  const passAALarge = ratio >= AA.large
  const passAAA = ratio >= AAA.normal
  const passAAALarge = ratio >= AAA.large
  return { name, fg, bg, ratio: Number(ratio?.toFixed(2)), passAA, passAALarge, passAAA, passAAALarge }
}

const report = []
for (const t of themes) {
  const c = t.colors || {}
  const bg = hex(c.bg || '#111827')
  const primary = hex(c.primary || '#1e3a5f')
  const accent = hex(c.accent || '#64b5f6')
  const secondary = hex(c.secondary || '#3b82f6')
  const text = isDark(bg) ? '#f0f0f0' : '#1a1a2e'
  const primaryText = isDark(primary) ? '#ffffff' : '#1a1a2e'

  const checks = [
    checkPair('Text vs BG', text, bg),
    checkPair('PrimaryText vs Primary', primaryText, primary),
    checkPair('Accent vs BG (links)', accent, bg),
    checkPair('Secondary vs BG', secondary, bg),
  ]
  const fails = checks.filter(c => !(c.passAA || c.passAALarge))
  report.push({ id: t.id, name: t.name, checks, fails })
}

const lines = []
for (const r of report) {
  lines.push(`\nTheme: ${r.name} (${r.id})`)
  for (const c of r.checks) {
    const badge = c.passAA ? 'AA✓' : c.passAALarge ? 'AA-Large✓' : 'FAIL'
    lines.push(`  - ${c.name}: ${c.ratio} (${badge})  fg ${c.fg} / bg ${c.bg}`)
  }
}

const hasFailures = report.some(r => r.fails.length > 0)
if (hasFailures) {
  lines.push('\nFailures detected:')
  for (const r of report.filter(r => r.fails.length)) {
    for (const f of r.fails) lines.push(`  - ${r.name}: ${f.name} -> ratio ${f.ratio}`)
  }
}

console.log(lines.join('\n'))
process.exit(hasFailures ? 2 : 0)

