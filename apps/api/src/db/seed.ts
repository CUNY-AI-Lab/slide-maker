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
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#2FB8D6', bg: '#ffffff' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'cuny-ai-lab-default',
      name: 'CUNY AI Lab',
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#2FB8D6', bg: '#ffffff' },
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
      colors: { primary: '#1D3A83', secondary: '#3B73E6', accent: '#2FB8D6', bg: '#ffffff' },
      fonts: { heading: 'Outfit', body: 'Inter' },
    },
    {
      id: 'warm-academic',
      name: 'Warm Academic',
      colors: { primary: '#7c3aed', secondary: '#a78bfa', accent: '#f59e0b', bg: '#faf5ef' },
      fonts: { heading: 'Georgia', body: 'Inter' },
    },
    {
      id: 'slate-minimal',
      name: 'Slate Minimal',
      colors: { primary: '#334155', secondary: '#64748b', accent: '#0ea5e9', bg: '#f8fafc' },
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
      colors: { primary: '#065f46', secondary: '#059669', accent: '#34d399', bg: '#f0fdf4' },
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

  // ── Bar Chart ─────────────────────────────────────────────────────
  const barChartSource = `<!DOCTYPE html><html><head><style>
body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;display:flex;align-items:flex-end;justify-content:center;height:100vh;padding:20px 40px 40px}
.chart{display:flex;align-items:flex-end;gap:12px;height:80%;width:100%}
.bar-group{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}
.bar{width:100%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#3b82f6,#1e3a5f);transition:all 0.3s;cursor:pointer;min-height:4px;position:relative}
.bar:hover{background:linear-gradient(180deg,#60a5fa,#3b82f6);transform:scaleX(1.05)}
.bar:hover .tooltip{opacity:1}
.tooltip{position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#1e293b;padding:2px 8px;border-radius:4px;font-size:12px;white-space:nowrap;opacity:0;transition:opacity 0.2s}
.label{margin-top:8px;font-size:12px;color:#94a3b8;text-align:center}
</style></head><body>
<div class="chart" id="chart"></div>
<script>
const el=document.currentScript?.parentElement||document.body;
const cfgStr=el.getAttribute('data-config');
let data=[{label:"Mon",value:42},{label:"Tue",value:78},{label:"Wed",value:55},{label:"Thu",value:91},{label:"Fri",value:63},{label:"Sat",value:35},{label:"Sun",value:48}];
try{if(cfgStr){const c=JSON.parse(cfgStr);if(c.data)data=c.data;}}catch(e){}
const max=Math.max(...data.map(d=>d.value));
const chart=document.getElementById("chart");
data.forEach(d=>{const g=document.createElement("div");g.className="bar-group";
const b=document.createElement("div");b.className="bar";b.style.height=(d.value/max*100)+"%";
const t=document.createElement("span");t.className="tooltip";t.textContent=d.value;
b.appendChild(t);g.appendChild(b);
const l=document.createElement("div");l.className="label";l.textContent=d.label;
g.appendChild(l);chart.appendChild(g)});
<\/script></body></html>`

  // ── Pie Chart ─────────────────────────────────────────────────────
  const pieChartSource = `<!DOCTYPE html><html><head><style>
body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;gap:40px}
svg{filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3))}
.legend{display:flex;flex-direction:column;gap:8px}
.legend-item{display:flex;align-items:center;gap:8px;font-size:13px}
.legend-dot{width:12px;height:12px;border-radius:50%}
</style></head><body>
<svg id="pie" width="220" height="220" viewBox="0 0 220 220"></svg>
<div class="legend" id="legend"></div>
<script>
const el=document.currentScript?.parentElement||document.body;
const cfgStr=el.getAttribute('data-config');
let segments=[{label:"Research",value:35,color:"#3b82f6"},{label:"Teaching",value:25,color:"#6366f1"},{label:"Admin",value:20,color:"#f59e0b"},{label:"Service",value:20,color:"#10b981"}];
try{if(cfgStr){const c=JSON.parse(cfgStr);if(c.segments)segments=c.segments;}}catch(e){}
const total=segments.reduce((s,d)=>s+d.value,0);
const svg=document.getElementById("pie");
const legend=document.getElementById("legend");
const cx=110,cy=110,r=100;
let cumAngle=-Math.PI/2;
segments.forEach(seg=>{
  const angle=(seg.value/total)*2*Math.PI;
  const x1=cx+r*Math.cos(cumAngle),y1=cy+r*Math.sin(cumAngle);
  cumAngle+=angle;
  const x2=cx+r*Math.cos(cumAngle),y2=cy+r*Math.sin(cumAngle);
  const large=angle>Math.PI?1:0;
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d","M "+cx+" "+cy+" L "+x1+" "+y1+" A "+r+" "+r+" 0 "+large+" 1 "+x2+" "+y2+" Z");
  path.setAttribute("fill",seg.color);path.setAttribute("stroke","#0d1117");path.setAttribute("stroke-width","2");
  path.style.transition="transform 0.2s";path.style.transformOrigin="center";
  path.addEventListener("mouseenter",()=>path.style.transform="scale(1.04)");
  path.addEventListener("mouseleave",()=>path.style.transform="scale(1)");
  svg.appendChild(path);
  const item=document.createElement("div");item.className="legend-item";
  item.innerHTML='<span class="legend-dot" style="background:'+seg.color+'"></span>'+seg.label+" ("+Math.round(seg.value/total*100)+"%)";
  legend.appendChild(item);
});
<\/script></body></html>`

  // ── Timeline ──────────────────────────────────────────────────────
  const timelineSource = `<!DOCTYPE html><html><head><style>
body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;padding:40px}
.timeline{position:relative;width:100%;padding:20px 0}
.timeline-line{position:absolute;top:50%;left:0;right:0;height:2px;background:#334155}
.timeline-items{display:flex;justify-content:space-between;position:relative}
.timeline-item{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;position:relative}
.timeline-dot{width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #0d1117;z-index:1;transition:transform 0.2s}
.timeline-item:hover .timeline-dot{transform:scale(1.3)}
.timeline-label{font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
.timeline-desc{font-size:12px;color:#cbd5e1;text-align:center;max-width:120px;line-height:1.4}
</style></head><body>
<div class="timeline">
<div class="timeline-line"></div>
<div class="timeline-items" id="items"></div>
</div>
<script>
const el=document.currentScript?.parentElement||document.body;
const cfgStr=el.getAttribute('data-config');
let events=[{label:"Q1 2024",desc:"Project kickoff and planning"},{label:"Q2 2024",desc:"Research and data collection"},{label:"Q3 2024",desc:"Model development"},{label:"Q4 2024",desc:"Testing and validation"},{label:"Q1 2025",desc:"Deployment and launch"}];
try{if(cfgStr){const c=JSON.parse(cfgStr);if(c.events)events=c.events;}}catch(e){}
const container=document.getElementById("items");
events.forEach((ev,i)=>{
  const item=document.createElement("div");item.className="timeline-item";
  const colors=["#3b82f6","#6366f1","#8b5cf6","#a78bfa","#c4b5fd"];
  item.innerHTML='<div class="timeline-label">'+ev.label+'</div><div class="timeline-dot" style="background:'+colors[i%colors.length]+'"></div><div class="timeline-desc">'+ev.desc+'</div>';
  container.appendChild(item);
});
<\/script></body></html>`

  // ── Leaflet Map — interactive, pannable, zoomable ────────
  const choroplethSource = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="/api/static/leaflet.css"/>
<script src="/api/static/leaflet.js"><\/script>
<style>
body{margin:0;height:100vh;overflow:hidden}
#map{width:100%;height:100%}
.info{padding:6px 10px;background:rgba(30,41,59,0.9);color:#e2e8f0;border-radius:6px;font:13px Inter,system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.info b{display:block;font-size:14px;margin-bottom:2px}
.leaflet-control-attribution{font-size:10px!important}
</style></head><body>
<div id="map"></div>
<script>
const cfg=JSON.parse(document.body.dataset.config||'{}');
const markers=cfg.markers||[
  {lat:40.7128,lng:-74.006,label:'New York',value:'Pop: 8.3M'},
  {lat:34.0522,lng:-118.2437,label:'Los Angeles',value:'Pop: 3.9M'},
  {lat:41.8781,lng:-87.6298,label:'Chicago',value:'Pop: 2.7M'},
  {lat:29.7604,lng:-95.3698,label:'Houston',value:'Pop: 2.3M'},
  {lat:33.749,lng:-84.388,label:'Atlanta',value:'Pop: 498K'}
];
const center=cfg.center||[39.8,-98.6];
const zoom=cfg.zoom||4;
const style=cfg.style||'default';
const tiles={
  default:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};
const map=L.map('map',{zoomControl:true}).setView(center,zoom);
L.tileLayer(tiles[style]||tiles.default,{
  maxZoom:18,
  attribution:'&copy; <a href="https://openstreetmap.org">OSM</a>'
}).addTo(map);
markers.forEach(m=>{
  const mk=L.circleMarker([m.lat,m.lng],{radius:8,fillColor:'#3b82f6',color:'#1e3a8a',weight:2,fillOpacity:0.85});
  mk.bindPopup('<div class="info"><b>'+m.label+'</b>'+(m.value?m.value:'')+'</div>');
  mk.addTo(map);
});
<\/script></body></html>`

  const starterArtifacts = [
    {
      id: 'artifact-bar-chart',
      name: 'Interactive Bar Chart',
      description: 'A responsive bar chart with hover tooltips. Configure labels and values via the data config.',
      type: 'chart' as const,
      source: barChartSource,
      config: {
        data: {
          type: 'array',
          label: 'Data Points',
          itemShape: { label: 'string', value: 'number' },
          default: [
            { label: 'Mon', value: 42 },
            { label: 'Tue', value: 78 },
            { label: 'Wed', value: 55 },
            { label: 'Thu', value: 91 },
            { label: 'Fri', value: 63 },
            { label: 'Sat', value: 35 },
            { label: 'Sun', value: 48 },
          ],
        },
      },
      builtIn: true,
      createdBy: null,
    },
    {
      id: 'artifact-pie-chart',
      name: 'Pie Chart',
      description: 'A colorful pie chart with hover effects and legend. Configure segments via config.',
      type: 'chart' as const,
      source: pieChartSource,
      config: {
        segments: {
          type: 'array',
          label: 'Segments',
          itemShape: { label: 'string', value: 'number', color: 'string' },
          default: [
            { label: 'Research', value: 35, color: '#3b82f6' },
            { label: 'Teaching', value: 25, color: '#6366f1' },
            { label: 'Admin', value: 20, color: '#f59e0b' },
            { label: 'Service', value: 20, color: '#10b981' },
          ],
        },
      },
      builtIn: true,
      createdBy: null,
    },
    {
      id: 'artifact-timeline',
      name: 'Timeline',
      description: 'A horizontal timeline with labeled events. Configure events via config.',
      type: 'diagram' as const,
      source: timelineSource,
      config: {
        events: {
          type: 'array',
          label: 'Events',
          itemShape: { label: 'string', desc: 'string' },
          default: [
            { label: 'Q1 2024', desc: 'Project kickoff and planning' },
            { label: 'Q2 2024', desc: 'Research and data collection' },
            { label: 'Q3 2024', desc: 'Model development' },
            { label: 'Q4 2024', desc: 'Testing and validation' },
            { label: 'Q1 2025', desc: 'Deployment and launch' },
          ],
        },
      },
      builtIn: true,
      createdBy: null,
    },
    {
      id: 'artifact-choropleth-map',
      name: 'Leaflet Map',
      description: 'An interactive Leaflet map with markers, multiple tile styles (default, dark, light, satellite), zoom and pan. Configure markers, center, zoom, and tile style.',
      type: 'map' as const,
      source: choroplethSource,
      config: {
        markers: {
          type: 'array',
          label: 'Map Markers',
          itemShape: { lat: 'number', lng: 'number', label: 'string', value: 'string' },
          default: [
            { lat: 40.7128, lng: -74.006, label: 'New York', value: 'Pop: 8.3M' },
            { lat: 34.0522, lng: -118.2437, label: 'Los Angeles', value: 'Pop: 3.9M' },
            { lat: 41.8781, lng: -87.6298, label: 'Chicago', value: 'Pop: 2.7M' },
          ],
        },
        center: {
          type: 'array',
          label: 'Map Center [lat, lng]',
          default: [39.8, -98.6],
        },
        zoom: {
          type: 'number',
          label: 'Zoom Level (1-18)',
          default: 4,
        },
        style: {
          type: 'string',
          label: 'Map Style',
          default: 'dark',
          enum: ['default', 'dark', 'light', 'satellite'],
        },
      },
      builtIn: true,
      createdBy: null,
    },
  ]

  for (const artifact of starterArtifacts) {
    await db.insert(artifacts).values(artifact).onConflictDoNothing()
  }

  // Also load artifacts from templates/artifacts/*.json
  const artifactsDir = path.join(templatesDir, 'artifacts')
  let templateCount = 0

  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const raw = fs.readFileSync(path.join(artifactsDir, file), 'utf-8')
      const tmpl = JSON.parse(raw)

      await db
        .insert(artifacts)
        .values({
          id: tmpl.id,
          name: tmpl.name,
          description: tmpl.description || '',
          type: 'visualization',
          source: tmpl.source,
          config: tmpl.config ?? {},
          builtIn: true,
          createdBy: null,
        })
        .onConflictDoNothing()

      templateCount++
    }
  }

  console.log(`Seeded ${starterArtifacts.length} inline + ${templateCount} template artifacts.`)
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
