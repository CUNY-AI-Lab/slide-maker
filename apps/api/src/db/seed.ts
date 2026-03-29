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

  const themeList = [
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

  // ── Choropleth Map (US states) ────────────────────────────────────
  const choroplethSource = `<!DOCTYPE html><html><head><style>
body{margin:0;font-family:Inter,sans-serif;background:#0d1117;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;padding:20px}
.map-container{position:relative;width:100%;max-width:700px}
svg{width:100%;height:auto}
.state{stroke:#1e293b;stroke-width:0.5;transition:opacity 0.2s;cursor:pointer}
.state:hover{opacity:0.8;stroke:#f0f0f0;stroke-width:1.5}
.tooltip{position:absolute;background:#1e293b;padding:6px 12px;border-radius:6px;font-size:12px;pointer-events:none;opacity:0;transition:opacity 0.2s;white-space:nowrap;z-index:10}
.legend-bar{display:flex;align-items:center;gap:8px;margin-top:12px;justify-content:center}
.legend-gradient{width:200px;height:10px;border-radius:5px}
.legend-label{font-size:11px;color:#94a3b8}
</style></head><body>
<div class="map-container">
<svg id="map" viewBox="0 0 960 600"></svg>
<div id="tooltip" class="tooltip"></div>
<div class="legend-bar"><span class="legend-label">Low</span><div class="legend-gradient" style="background:linear-gradient(to right,#1e3a5f,#3b82f6,#60a5fa)"></div><span class="legend-label">High</span></div>
</div>
<script>
const el=document.currentScript?.parentElement||document.body;
const cfgStr=el.getAttribute('data-config');
let stateData={CA:85,TX:72,NY:90,FL:68,IL:55,PA:60,OH:45,GA:62,NC:58,MI:40,NJ:75,VA:65,WA:80,AZ:50,MA:88,TN:42,IN:38,MO:35,MD:70,WI:44};
try{if(cfgStr){const c=JSON.parse(cfgStr);if(c.stateData)stateData=c.stateData;}}catch(e){}
const states={CA:"M 90 340 L 70 280 L 55 210 L 80 200 L 100 250 L 130 320 L 120 380 L 90 400 Z",TX:"M 340 400 L 380 350 L 440 340 L 500 360 L 510 420 L 480 470 L 420 480 L 350 460 Z",NY:"M 780 140 L 810 120 L 840 130 L 830 170 L 800 190 L 770 180 Z",FL:"M 680 430 L 720 420 L 750 450 L 740 500 L 700 520 L 670 480 Z",IL:"M 560 220 L 580 200 L 590 250 L 580 300 L 560 290 Z",PA:"M 740 180 L 790 170 L 800 200 L 760 210 Z",OH:"M 650 200 L 680 190 L 690 230 L 660 240 Z",GA:"M 660 370 L 700 360 L 710 410 L 680 420 Z",NC:"M 700 320 L 780 300 L 790 330 L 710 340 Z",MI:"M 580 140 L 620 130 L 640 160 L 610 180 L 580 170 Z",NJ:"M 800 200 L 820 195 L 815 220 L 795 215 Z",VA:"M 700 270 L 770 250 L 780 280 L 710 300 Z",WA:"M 90 60 L 150 50 L 160 100 L 100 110 Z",AZ:"M 150 340 L 210 320 L 230 380 L 180 400 Z",MA:"M 830 140 L 860 135 L 855 155 L 825 160 Z",TN:"M 580 310 L 670 300 L 675 325 L 585 335 Z",IN:"M 590 230 L 620 220 L 625 270 L 595 280 Z",MO:"M 490 270 L 540 260 L 550 310 L 500 320 Z",MD:"M 760 240 L 800 235 L 795 255 L 755 260 Z",WI:"M 530 130 L 570 120 L 580 170 L 540 180 Z"};
const vals=Object.values(stateData);
const min=Math.min(...vals),max=Math.max(...vals);
const svg=document.getElementById("map");
const tooltip=document.getElementById("tooltip");
function getColor(v){const t=(v-min)/(max-min||1);const r=Math.round(30+t*66);const g=Math.round(58+t*107);const b=Math.round(95+t*155);return "rgb("+r+","+g+","+b+")";}
Object.entries(states).forEach(([abbr,d])=>{
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",d);path.setAttribute("class","state");
  const val=stateData[abbr];
  path.setAttribute("fill",val!=null?getColor(val):"#1e293b");
  path.addEventListener("mouseenter",(e)=>{tooltip.textContent=abbr+": "+(val!=null?val:"N/A");tooltip.style.opacity="1";});
  path.addEventListener("mousemove",(e)=>{const r=e.currentTarget.closest(".map-container").getBoundingClientRect();tooltip.style.left=(e.clientX-r.left+10)+"px";tooltip.style.top=(e.clientY-r.top-30)+"px";});
  path.addEventListener("mouseleave",()=>{tooltip.style.opacity="0";});
  svg.appendChild(path);
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
      name: 'US Choropleth Map',
      description: 'A US states map colored by value. Configure state-value pairs via config.',
      type: 'map' as const,
      source: choroplethSource,
      config: {
        stateData: {
          type: 'object',
          label: 'State Values',
          default: {
            CA: 85, TX: 72, NY: 90, FL: 68, IL: 55,
            PA: 60, OH: 45, GA: 62, NC: 58, MI: 40,
          },
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
          type: 'widget',
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
