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
      const tmpl = JSON.parse(raw)

      await db
        .insert(templates)
        .values({
          id: createId(),
          name: tmpl.name,
          layout: tmpl.layout,
          modules: tmpl.modules,
          builtIn: true,
          createdBy: null,
        })
        .onConflictDoNothing()

      count++
    }
  }

  console.log(`Seeded ${count} templates.`)
}

async function seedThemes() {
  const defaultTheme = {
    id: 'cuny-ai-lab-default',
    name: 'CUNY AI Lab',
    css: `
:root {
  --slide-bg: #ffffff;
  --slide-text: #333333;
  --slide-heading-color: #1D3A83;
  --slide-accent: #3B73E6;
  --slide-accent-secondary: #2FB8D6;
  --slide-font-heading: 'Outfit', system-ui, sans-serif;
  --slide-font-body: 'Inter', system-ui, sans-serif;
}
    `,
    fonts: { heading: 'Outfit', body: 'Inter' },
    colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#2FB8D6', bg: '#ffffff' },
    builtIn: true,
    createdBy: null,
  }

  await db.insert(themes).values(defaultTheme).onConflictDoNothing()
  console.log('Seeded default theme: CUNY AI Lab')
}

async function seedArtifacts() {
  // Clear existing built-in artifacts before re-seeding
  await db.delete(artifacts).where(eq(artifacts.builtIn, true))

  const barChartSource = [
    '<!DOCTYPE html><html><head><style>',
    'body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;display:flex;align-items:flex-end;justify-content:center;height:100vh;padding:20px 40px 40px}',
    '.chart{display:flex;align-items:flex-end;gap:12px;height:80%;width:100%}',
    '.bar-group{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}',
    '.bar{width:100%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#3b82f6,#1e3a5f);transition:all 0.3s;cursor:pointer;min-height:4px;position:relative}',
    '.bar:hover{background:linear-gradient(180deg,#60a5fa,#3b82f6);transform:scaleX(1.05)}',
    '.bar:hover .tooltip{opacity:1}',
    '.tooltip{position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#1e293b;padding:2px 8px;border-radius:4px;font-size:12px;white-space:nowrap;opacity:0;transition:opacity 0.2s}',
    '.label{margin-top:8px;font-size:12px;color:#94a3b8;text-align:center}',
    '</style></head><body>',
    '<div class="chart" id="chart"></div>',
    '<script>',
    'const data=[{label:"Mon",value:42},{label:"Tue",value:78},{label:"Wed",value:55},{label:"Thu",value:91},{label:"Fri",value:63},{label:"Sat",value:35},{label:"Sun",value:48}];',
    'const max=Math.max(...data.map(d=>d.value));',
    'const chart=document.getElementById("chart");',
    'data.forEach(d=>{const g=document.createElement("div");g.className="bar-group";',
    'const b=document.createElement("div");b.className="bar";b.style.height=(d.value/max*100)+"%";',
    'const t=document.createElement("span");t.className="tooltip";t.textContent=d.value;',
    'b.appendChild(t);g.appendChild(b);',
    'const l=document.createElement("div");l.className="label";l.textContent=d.label;',
    'g.appendChild(l);chart.appendChild(g)});',
    '<\/script></body></html>',
  ].join('\n')

  const flowDiagramSource = [
    '<!DOCTYPE html><html><head><style>',
    'body{margin:0;font-family:Inter,sans-serif;background:#0d1117;display:flex;align-items:center;justify-content:center;height:100vh}',
    'svg text{fill:#e2e8f0;font-size:13px;text-anchor:middle;dominant-baseline:central;font-family:Inter,sans-serif}',
    '.node rect{fill:#1e293b;stroke:#3b82f6;stroke-width:2;rx:10;ry:10;transition:all 0.3s}',
    '.node:hover rect{fill:#1e3a5f;stroke:#60a5fa;filter:drop-shadow(0 0 8px rgba(59,130,246,0.4))}',
    '.arrow{stroke:#475569;stroke-width:2;marker-end:url(#arrowhead)}',
    '@keyframes dash{to{stroke-dashoffset:-20}}',
    '.arrow{stroke-dasharray:8 4;animation:dash 1s linear infinite}',
    '</style></head><body>',
    '<svg viewBox="0 0 700 160" width="700" height="160">',
    '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#475569"/></marker></defs>',
    '<g class="node" transform="translate(10,50)"><rect width="120" height="60"/><text x="60" y="30">Input</text></g>',
    '<line class="arrow" x1="130" y1="80" x2="180" y2="80"/>',
    '<g class="node" transform="translate(180,50)"><rect width="120" height="60"/><text x="60" y="30">Process</text></g>',
    '<line class="arrow" x1="300" y1="80" x2="350" y2="80"/>',
    '<g class="node" transform="translate(350,50)"><rect width="120" height="60"/><text x="60" y="30">Validate</text></g>',
    '<line class="arrow" x1="470" y1="80" x2="520" y2="80"/>',
    '<g class="node" transform="translate(520,50)"><rect width="120" height="60"/><text x="60" y="30">Output</text></g>',
    '</svg></body></html>',
  ].join('\n')

  const dataTableSource = [
    '<!DOCTYPE html><html><head><style>',
    'body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;padding:16px}',
    'table{width:100%;border-collapse:collapse;font-size:13px}',
    'th{background:#1e293b;padding:10px 14px;text-align:left;cursor:pointer;user-select:none;border-bottom:2px solid #334155;font-weight:600;transition:background 0.2s}',
    'th:hover{background:#334155}',
    'td{padding:8px 14px;border-bottom:1px solid #1e293b}',
    'tr:nth-child(even){background:rgba(255,255,255,0.02)}',
    'tr:hover{background:rgba(59,130,246,0.08)}',
    '</style></head><body>',
    '<table><thead><tr><th>Name</th><th>Category</th><th>Score</th><th>Status</th></tr></thead>',
    '<tbody>',
    '<tr><td>GPT-4o</td><td>Language</td><td>94</td><td>Active</td></tr>',
    '<tr><td>Claude 3.5</td><td>Language</td><td>96</td><td>Active</td></tr>',
    '<tr><td>Gemini Pro</td><td>Multimodal</td><td>89</td><td>Active</td></tr>',
    '<tr><td>Llama 3</td><td>Open Source</td><td>85</td><td>Active</td></tr>',
    '<tr><td>Mistral Large</td><td>Language</td><td>88</td><td>Active</td></tr>',
    '</tbody></table>',
    '</body></html>',
  ].join('\n')

  const starterArtifacts = [
    {
      id: 'artifact-bar-chart',
      name: 'Interactive Bar Chart',
      description: 'A responsive bar chart with hover tooltips. Edit the data array to customize values and labels.',
      type: 'chart' as const,
      source: barChartSource,
      config: {},
      builtIn: true,
      createdBy: null,
    },
    {
      id: 'artifact-flow-diagram',
      name: 'Process Flow Diagram',
      description: 'An animated SVG flow diagram showing a multi-step process. Nodes pulse on hover.',
      type: 'diagram' as const,
      source: flowDiagramSource,
      config: {},
      builtIn: true,
      createdBy: null,
    },
    {
      id: 'artifact-data-table',
      name: 'Data Table',
      description: 'A sortable HTML table with alternating row colors.',
      type: 'widget' as const,
      source: dataTableSource,
      config: {},
      builtIn: true,
      createdBy: null,
    },
  ]

  for (const artifact of starterArtifacts) {
    await db.insert(artifacts).values(artifact).onConflictDoNothing()
  }

  console.log(`Seeded ${starterArtifacts.length} starter artifacts.`)
}

async function seedAdminUsers() {
  const admins = [
    { email: 'smorello@gc.cuny.edu', password: 'Gremlins2025!', name: 'Stefano Morello' },
    { email: 'zmuhlbauer@gc.cuny.edu', password: 'Gremlins2025!', name: 'Zach Muhlbauer' },
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
  console.log(`Password: ${password}`)
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
