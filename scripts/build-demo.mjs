#!/usr/bin/env node
// Generates docs/demo.html — standalone JS Primitives sandbox
// Usage: node scripts/build-demo.mjs

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const templateDir = join(root, 'templates', 'artifacts');

const files = readdirSync(templateDir).filter(f => f.endsWith('.json')).sort();
const artifacts = files.map((f, i) => {
  const data = JSON.parse(readFileSync(join(templateDir, f), 'utf-8'));
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    source: data.source,
  };
});

const COLORS = [
  '#e05545','#3ba8d8','#d4a053','#2fb8a0','#6c78e0','#c75dbd',
  '#e88a3a','#5eaf5e','#d4606a','#8a8ae0','#38b89e','#e0a03c',
];

const withColors = artifacts.map((a, i) => ({
  ...a,
  color: COLORS[i % COLORS.length],
}));

// Escape </ so embedded HTML doesn't break the outer script tag
const dataJSON = JSON.stringify(withColors).replace(/<\//g, '<\\/');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>JS Primitives</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,monospace}
body{
  background:
    radial-gradient(circle,rgba(34,38,56,0.45) 1px,transparent 1px),
    linear-gradient(180deg,#090b12 0%,#0d0f18 100%);
  background-size:20px 20px,100% 100%;
  color:#c8cde0;
  display:flex;
  flex-direction:column;
}

/* ---- Top bar ---- */
#topbar{
  height:46px;flex-shrink:0;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 20px;
  background:rgba(13,15,24,0.92);
  border-bottom:1px solid #1e2136;
  backdrop-filter:blur(12px);
  z-index:1000;
  user-select:none;
}
#topbar .brand{display:flex;align-items:baseline;gap:10px}
#topbar .brand h1{font-size:14px;font-weight:600;letter-spacing:0.03em;color:#e0e4f0}
#topbar .brand .tag{font-size:11px;font-weight:400;color:#5a6080;letter-spacing:0.06em;text-transform:uppercase}
#topbar .actions{display:flex;gap:6px}
.top-btn{
  background:rgba(255,255,255,0.04);
  border:1px solid #252840;
  color:#8890b0;
  font:12px/1 'IBM Plex Mono',monospace;
  padding:7px 14px;
  border-radius:6px;
  cursor:pointer;
  transition:all 0.15s;
}
.top-btn:hover{background:rgba(255,255,255,0.08);color:#c0c8e0;border-color:#3a3f5a}

/* ---- Workspace ---- */
#workspace{flex:1;position:relative;overflow:hidden}

/* ---- Floating window ---- */
.win{
  position:absolute;
  display:flex;flex-direction:column;
  background:#13151f;
  border:1px solid #222640;
  border-radius:10px;
  overflow:hidden;
  box-shadow:0 6px 32px rgba(0,0,0,0.35);
  transition:box-shadow 0.2s,border-color 0.2s;
  min-width:180px;min-height:120px;
}
.win.focused{
  box-shadow:0 8px 48px rgba(0,0,0,0.5),0 0 0 1px var(--accent);
  border-color:color-mix(in srgb,var(--accent) 40%,#222640);
}
.win.minimized .win-body{display:none}
.win.minimized{min-height:auto;height:auto!important;border-radius:8px}
.win.dragging,.win.resizing{transition:none}
.win.dragging iframe,.win.resizing iframe{pointer-events:none}

.win-bar{
  height:34px;flex-shrink:0;
  display:flex;align-items:center;gap:8px;
  padding:0 10px;
  background:rgba(20,22,34,0.95);
  border-bottom:1px solid #1c1f32;
  cursor:grab;
  user-select:none;
}
.win-bar:active{cursor:grabbing}
.win-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--accent)}
.win-title{font-size:12px;font-weight:500;color:#c8cde0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.win-desc{font-size:10px;color:#4a5070;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.win-btns{display:flex;gap:2px;flex-shrink:0;margin-left:auto}
.win-btn{
  width:22px;height:22px;
  display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;border-radius:4px;
  color:#555a78;font-size:12px;cursor:pointer;
  transition:all 0.12s;
}
.win-btn:hover{background:rgba(255,255,255,0.08);color:#a0a8c8}
.win-btn.btn-close:hover{background:rgba(220,50,50,0.2);color:#f06060}

.win-body{flex:1;position:relative;overflow:hidden;background:#000}
.win-body iframe{width:100%;height:100%;border:none;display:block;background:#000}

.resize-handle{
  position:absolute;bottom:0;right:0;
  width:18px;height:18px;
  cursor:nwse-resize;z-index:5;
  opacity:0;transition:opacity 0.15s;
}
.win:hover .resize-handle,.win.focused .resize-handle{opacity:1}
.resize-handle::after{
  content:'';position:absolute;bottom:3px;right:3px;
  width:8px;height:8px;
  border-right:2px solid var(--accent);
  border-bottom:2px solid var(--accent);
  opacity:0.5;
}
.resize-handle:hover::after{opacity:0.9}

.size-tooltip{
  position:absolute;bottom:-24px;right:0;
  background:rgba(0,0,0,0.8);color:#ccc;
  font:10px/1 'IBM Plex Mono',monospace;
  padding:3px 7px;border-radius:4px;
  white-space:nowrap;pointer-events:none;
  z-index:10;display:none;
}

/* ---- Dock ---- */
#dock{
  height:50px;flex-shrink:0;
  display:flex;align-items:center;gap:6px;
  padding:0 16px;
  background:rgba(11,13,20,0.94);
  border-top:1px solid #1a1d30;
  backdrop-filter:blur(12px);
  overflow-x:auto;
  z-index:1000;
  user-select:none;
}
#dock::-webkit-scrollbar{height:4px}
#dock::-webkit-scrollbar-thumb{background:#252840;border-radius:2px}
.dock-btn{
  display:flex;align-items:center;gap:6px;
  background:rgba(255,255,255,0.03);
  border:1px solid #1e2136;
  color:#7880a0;
  font:11px/1 'IBM Plex Mono',monospace;
  padding:6px 12px;
  border-radius:20px;
  cursor:pointer;
  white-space:nowrap;
  transition:all 0.15s;
  flex-shrink:0;
}
.dock-btn:hover{background:rgba(255,255,255,0.07);color:#b0b8d0;border-color:#2a2f4a}
.dock-btn.active{
  background:color-mix(in srgb,var(--accent) 12%,transparent);
  border-color:color-mix(in srgb,var(--accent) 30%,#1e2136);
  color:#d0d4e8;
}
.dock-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0}
.dock-btn.hidden-win{opacity:0.4}
.dock-btn.hidden-win:hover{opacity:0.7}

/* ---- Welcome ---- */
#welcome{
  position:absolute;inset:0;
  display:flex;align-items:center;justify-content:center;
  pointer-events:none;z-index:1;
  opacity:1;transition:opacity 0.8s 0.3s;
}
#welcome.hidden{opacity:0}
.welcome-inner{text-align:center;animation:fadeUp 0.6s ease-out}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.welcome-inner h2{font-size:22px;font-weight:600;color:#d0d4e8;margin-bottom:8px;letter-spacing:0.02em}
.welcome-inner p{font-size:12px;color:#4a5070;line-height:1.7}
</style>
</head>
<body>

<header id="topbar">
  <div class="brand">
    <h1>JS Primitives</h1>
    <span class="tag">JS Primitives</span>
  </div>
  <div class="actions" id="topActions"></div>
</header>

<main id="workspace">
  <div id="welcome">
    <div class="welcome-inner">
      <h2>Drag. Resize. Explore.</h2>
      <p>12 canvas visualizations.<br>
      Drag title bars to move \u00b7 corner handles to resize \u00b7 dock to toggle.</p>
    </div>
  </div>
</main>

<nav id="dock"></nav>

<script>
const ARTIFACTS = ${dataJSON};

const workspace = document.getElementById('workspace');
const dock = document.getElementById('dock');
const welcome = document.getElementById('welcome');
const topActions = document.getElementById('topActions');

// Build top bar buttons safely
['\\u229e Arrange', '\\u25a3 Toggle All'].forEach((label, i) => {
  const btn = document.createElement('button');
  btn.className = 'top-btn';
  btn.textContent = label;
  btn.addEventListener('click', i === 0 ? arrangeGrid : toggleAll);
  topActions.appendChild(btn);
});

let topZ = 10;
const windows = [];
let allVisible = true;

// ---- Build windows via DOM (no innerHTML) ----
ARTIFACTS.forEach((art, i) => {
  const win = document.createElement('div');
  win.className = 'win';
  win.style.setProperty('--accent', art.color);
  win.dataset.idx = i;

  // Title bar
  const bar = document.createElement('div');
  bar.className = 'win-bar';

  const dot = document.createElement('span');
  dot.className = 'win-dot';
  bar.appendChild(dot);

  const title = document.createElement('span');
  title.className = 'win-title';
  title.textContent = art.name;
  bar.appendChild(title);

  const desc = document.createElement('span');
  desc.className = 'win-desc';
  desc.textContent = art.description;
  bar.appendChild(desc);

  const btns = document.createElement('span');
  btns.className = 'win-btns';

  const btnMin = document.createElement('button');
  btnMin.className = 'win-btn btn-min';
  btnMin.title = 'Minimize';
  btnMin.textContent = '\\u2013';
  btns.appendChild(btnMin);

  const btnMax = document.createElement('button');
  btnMax.className = 'win-btn btn-max';
  btnMax.title = 'Maximize';
  btnMax.textContent = '\\u25a1';
  btns.appendChild(btnMax);

  const btnClose = document.createElement('button');
  btnClose.className = 'win-btn btn-close';
  btnClose.title = 'Hide';
  btnClose.textContent = '\\u00d7';
  btns.appendChild(btnClose);

  bar.appendChild(btns);
  win.appendChild(bar);

  // Body
  const body = document.createElement('div');
  body.className = 'win-body';
  win.appendChild(body);

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  win.appendChild(handle);

  // Tooltip (hidden by default)
  const tooltip = document.createElement('div');
  tooltip.className = 'size-tooltip';
  win.appendChild(tooltip);

  workspace.appendChild(win);

  const state = {
    el: win, art, idx: i,
    visible: true, minimized: false, maximized: false,
    iframe: null,
    x: 0, y: 0, w: 340, h: 340,
    saved: null,
    dockBtn: null,
    tooltip,
  };
  windows.push(state);

  // Focus
  win.addEventListener('mousedown', () => focusWin(state));

  // Drag
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.win-btns')) return;
    startDrag(e, state);
  });

  // Resize
  handle.addEventListener('mousedown', e => startResize(e, state));

  // Buttons
  btnMin.addEventListener('click', e => { e.stopPropagation(); toggleMin(state); });
  btnMax.addEventListener('click', e => { e.stopPropagation(); toggleMax(state); });
  btnClose.addEventListener('click', e => { e.stopPropagation(); hideWin(state); });
  bar.addEventListener('dblclick', e => {
    if (e.target.closest('.win-btns')) return;
    toggleMax(state);
  });

  // Dock button
  const dockBtn = document.createElement('button');
  dockBtn.className = 'dock-btn active';
  dockBtn.style.setProperty('--accent', art.color);

  const dockDot = document.createElement('span');
  dockDot.className = 'dock-dot';
  dockBtn.appendChild(dockDot);
  dockBtn.appendChild(document.createTextNode(art.name));

  dockBtn.addEventListener('click', () => {
    if (!state.visible) showWin(state);
    else { focusWin(state); bringIntoView(state); }
  });
  state.dockBtn = dockBtn;
  dock.appendChild(dockBtn);
});

// ---- Arrange ----
function arrangeGrid() {
  const vis = windows.filter(w => w.visible);
  if (!vis.length) return;
  const pad = 10;
  const area = workspace.getBoundingClientRect();
  const aw = area.width - pad * 2;
  const ah = area.height - pad * 2;
  const cols = Math.ceil(Math.sqrt(vis.length * (aw / ah)));
  const rows = Math.ceil(vis.length / cols);
  const cellW = Math.floor(aw / cols);
  const cellH = Math.floor(ah / rows);
  const gap = 6;
  vis.forEach((w, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    w.x = pad + col * cellW + gap / 2;
    w.y = pad + row * cellH + gap / 2;
    w.w = cellW - gap;
    w.h = cellH - gap;
    w.maximized = false;
    w.minimized = false;
    w.el.classList.remove('minimized');
    applyPos(w);
    ensureIframe(w);
  });
  welcome.classList.add('hidden');
}

function applyPos(w) {
  w.el.style.left = w.x + 'px';
  w.el.style.top = w.y + 'px';
  w.el.style.width = w.w + 'px';
  w.el.style.height = w.h + 'px';
}

function ensureIframe(w) {
  if (w.iframe) return;
  const body = w.el.querySelector('.win-body');
  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts';
  iframe.loading = 'lazy';
  const blob = new Blob([w.art.source], { type: 'text/html' });
  iframe.src = URL.createObjectURL(blob);
  body.appendChild(iframe);
  w.iframe = iframe;
}

// ---- Focus ----
function focusWin(w) {
  windows.forEach(o => o.el.classList.remove('focused'));
  w.el.classList.add('focused');
  w.el.style.zIndex = ++topZ;
}

// ---- Drag ----
function startDrag(e, w) {
  e.preventDefault();
  if (w.maximized) return;
  focusWin(w);
  w.el.classList.add('dragging');
  const startX = e.clientX - w.x;
  const startY = e.clientY - w.y;
  function onMove(ev) {
    w.x = ev.clientX - startX;
    w.y = ev.clientY - startY;
    w.el.style.left = w.x + 'px';
    w.el.style.top = w.y + 'px';
  }
  function onUp() {
    w.el.classList.remove('dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ---- Resize ----
function startResize(e, w) {
  e.preventDefault();
  e.stopPropagation();
  if (w.maximized) return;
  focusWin(w);
  w.el.classList.add('resizing');
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = w.w;
  const startH = w.h;
  function onMove(ev) {
    w.w = Math.max(180, startW + (ev.clientX - startX));
    w.h = Math.max(120, startH + (ev.clientY - startY));
    w.el.style.width = w.w + 'px';
    w.el.style.height = w.h + 'px';
    w.tooltip.textContent = Math.round(w.w) + ' \\u00d7 ' + Math.round(w.h);
    w.tooltip.style.display = 'block';
  }
  function onUp() {
    w.el.classList.remove('resizing');
    w.tooltip.style.display = 'none';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// ---- Min / Max / Hide / Show ----
function toggleMin(w) {
  w.minimized = !w.minimized;
  w.el.classList.toggle('minimized', w.minimized);
}

function toggleMax(w) {
  if (w.maximized) {
    Object.assign(w, w.saved);
    w.saved = null;
    w.maximized = false;
    applyPos(w);
  } else {
    w.saved = { x: w.x, y: w.y, w: w.w, h: w.h };
    const area = workspace.getBoundingClientRect();
    w.x = 4; w.y = 4; w.w = area.width - 8; w.h = area.height - 8;
    w.maximized = true;
    w.minimized = false;
    w.el.classList.remove('minimized');
    applyPos(w);
  }
  focusWin(w);
  ensureIframe(w);
}

function hideWin(w) {
  w.visible = false;
  w.el.style.display = 'none';
  w.dockBtn.classList.remove('active');
  w.dockBtn.classList.add('hidden-win');
}

function showWin(w) {
  w.visible = true;
  w.el.style.display = 'flex';
  w.dockBtn.classList.add('active');
  w.dockBtn.classList.remove('hidden-win');
  focusWin(w);
  ensureIframe(w);
}

function bringIntoView(w) {
  const area = workspace.getBoundingClientRect();
  if (w.x < 0) w.x = 8;
  if (w.y < 0) w.y = 8;
  if (w.x + w.w > area.width) w.x = Math.max(8, area.width - w.w - 8);
  if (w.y + w.h > area.height) w.y = Math.max(8, area.height - w.h - 8);
  applyPos(w);
}

function toggleAll() {
  allVisible = !allVisible;
  windows.forEach(w => allVisible ? showWin(w) : hideWin(w));
}

// ---- Init ----
requestAnimationFrame(() => {
  arrangeGrid();
  if (windows.length) focusWin(windows[0]);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(arrangeGrid, 200);
});
</script>
</body>
</html>`;

writeFileSync(join(root, 'docs', 'demo.html'), html);
console.log(`\u2713 Built docs/demo.html \u2014 ${artifacts.length} artifacts embedded`);
