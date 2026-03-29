export const FRAMEWORK_CSS = `
/* ── Reset & Base ────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; width: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: #0f0f0f; color: #f0f0f0; }

/* ── Custom Properties ───────────────────────────────────────────── */
:root {
  --accent-cyan: #79c0ff;
  --accent-blue: #2A6FB8;
  --accent-navy: #1D3A83;
  --accent-red: #ff6b6b;
  --accent-amber: #ffd93d;
  --accent-green: #6bcf7f;
  --bg-light: #f8fafc;
  --stroke: rgba(255,255,255,0.13);
}

/* ── Accessibility ───────────────────────────────────────────────── */
.skip-link {
  position: absolute; top: -100%; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; background: var(--accent-blue); color: #fff;
  border-radius: 4px; text-decoration: none; z-index: 1000; font-size: 14px;
}
.skip-link:focus { top: 8px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
*:focus-visible { outline: 2px solid var(--accent-cyan); outline-offset: 2px; }

/* ── Typography ──────────────────────────────────────────────────── */
h1, h2, h3, h4 { font-family: 'Outfit', sans-serif; line-height: 1.2; margin-bottom: 0.4em; }
h1 { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; }
h2 { font-size: clamp(1.6rem, 3vw, 2.5rem); font-weight: 600; }
h3 { font-size: clamp(1.2rem, 2.2vw, 1.8rem); font-weight: 600; }
h4 { font-size: clamp(1rem, 1.6vw, 1.3rem); font-weight: 600; }
.text-body { font-size: clamp(0.95rem, 1.4vw, 1.25rem); line-height: 1.65; }
code, pre { font-family: 'JetBrains Mono', monospace; }
pre { background: #1e1e2e; border-radius: 8px; padding: 20px 24px; overflow-x: auto; font-size: 0.9rem; line-height: 1.5; }

/* ── Slide Base ──────────────────────────────────────────────────── */
.slide {
  display: none; position: absolute; top: 0; left: 0; width: 100vw; height: 100vh;
  padding: 60px 80px; overflow: auto; flex-direction: column; justify-content: center;
}
.slide.active { display: flex; }

/* ── Layout: Title ───────────────────────────────────────────────── */
.title-slide {
  background: linear-gradient(135deg, var(--accent-navy) 0%, var(--accent-blue) 100%);
  text-align: center; align-items: center;
}

/* ── Layout: Split ───────────────────────────────────────────────── */
.layout-split { flex-direction: row; gap: 40px; align-items: stretch; }
.layout-split > .content { flex: 0.45; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
.layout-split > .stage { flex: 0.55; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 16px; }

/* ── Layout: Content ─────────────────────────────────────────────── */
.layout-content { align-items: center; gap: 24px; }
.layout-content > .content { max-width: 900px; width: 100%; }

/* ── Layout: Grid ────────────────────────────────────────────────── */
.layout-grid { align-items: center; gap: 24px; }

/* ── Layout: Full Dark ───────────────────────────────────────────── */
.layout-full-dark { background: #0a0a0a; align-items: center; justify-content: center; gap: 24px; }

/* ── Layout: Divider ─────────────────────────────────────────────── */
.layout-divider {
  background: linear-gradient(135deg, var(--accent-navy) 0%, #0f0f0f 100%);
  align-items: center; justify-content: center; text-align: center; gap: 16px;
}

/* ── Layout: Closing ─────────────────────────────────────────────── */
.closing-slide {
  background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-navy) 100%);
  align-items: center; justify-content: center; text-align: center; gap: 16px;
}

/* ── Module: Card ────────────────────────────────────────────────── */
.card {
  background: rgba(255,255,255,0.05); border: 1px solid var(--stroke);
  border-radius: 12px; padding: 24px;
}
.card-cyan { border-left: 4px solid var(--accent-cyan); }
.card-navy { border-left: 4px solid var(--accent-navy); }
.card h3 { font-size: 1.1rem; margin-bottom: 8px; }
.card p { font-size: 0.95rem; opacity: 0.85; line-height: 1.5; }

/* ── Module: Label ───────────────────────────────────────────────── */
.label {
  display: inline-block; padding: 4px 12px; border-radius: 999px;
  font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
}
.label-cyan { background: rgba(121,192,255,0.15); color: var(--accent-cyan); }
.label-blue { background: rgba(42,111,184,0.2); color: var(--accent-blue); }
.label-navy { background: rgba(29,58,131,0.25); color: #7b9fd4; }
.label-red { background: rgba(255,107,107,0.15); color: var(--accent-red); }
.label-amber { background: rgba(255,217,61,0.15); color: var(--accent-amber); }
.label-green { background: rgba(107,207,127,0.15); color: var(--accent-green); }

/* ── Module: Tip Box ─────────────────────────────────────────────── */
.tip-box {
  background: rgba(121,192,255,0.08); border: 1px solid rgba(121,192,255,0.25);
  border-radius: 10px; padding: 20px 24px; font-size: 0.95rem; line-height: 1.6;
}
.tip-box strong { display: block; margin-bottom: 6px; color: var(--accent-cyan); }

/* ── Module: Prompt Block ────────────────────────────────────────── */
.prompt-block {
  border-radius: 10px; padding: 20px 24px; font-size: 0.9rem;
  border: 1px solid var(--stroke);
}
.prompt-block pre { background: transparent; padding: 0; margin: 0; white-space: pre-wrap; }
.prompt-good { border-color: var(--accent-green); background: rgba(107,207,127,0.06); }
.prompt-mid { border-color: var(--accent-amber); background: rgba(255,217,61,0.06); }
.prompt-bad { border-color: var(--accent-red); background: rgba(255,107,107,0.06); }

/* ── Module: Carousel ────────────────────────────────────────────── */
.carousel { position: relative; width: 100%; overflow: hidden; border-radius: 10px; }
.carousel-track { display: flex; transition: transform 0.4s ease; }
.carousel-item { min-width: 100%; }
.carousel-item img { width: 100%; display: block; border-radius: 10px; }
.carousel-dots { display: flex; justify-content: center; gap: 8px; padding: 10px 0; }
.carousel-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.3); border: none; cursor: pointer; }
.carousel-dot.active { background: var(--accent-cyan); }
.carousel-prev, .carousel-next {
  position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.5);
  border: none; color: #fff; font-size: 1.2rem; padding: 8px 12px; cursor: pointer;
  border-radius: 6px; z-index: 2;
}
.carousel-prev { left: 8px; }
.carousel-next { right: 8px; }

/* ── Module: Comparison ──────────────────────────────────────────── */
.comparison { display: flex; gap: 20px; width: 100%; }
.comparison-panel {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid var(--stroke);
  border-radius: 12px; padding: 24px;
}

/* ── Module: Card Grid ───────────────────────────────────────────── */
.card-grid { display: grid; gap: 20px; width: 100%; }

/* ── Module: Flow ────────────────────────────────────────────────── */
.flow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
.flow-node {
  background: rgba(255,255,255,0.06); border: 1px solid var(--stroke);
  border-radius: 10px; padding: 14px 22px; font-size: 0.95rem; text-align: center;
}
.flow-arrow { font-size: 1.4rem; opacity: 0.5; }

/* ── Module: Stream List ─────────────────────────────────────────── */
.stream-list { list-style: none; padding: 0; }
.stream-list li {
  padding: 12px 16px; border-left: 3px solid var(--accent-cyan);
  margin-bottom: 8px; background: rgba(255,255,255,0.03); border-radius: 0 8px 8px 0;
}

/* ── Module: Image ───────────────────────────────────────────────── */
figure { text-align: center; margin: 0; }
figure img { max-width: 100%; max-height: 60vh; border-radius: 8px; object-fit: contain; }
figcaption { margin-top: 8px; font-size: 0.85rem; opacity: 0.6; }

/* ── Blockquote ──────────────────────────────────────────────────── */
blockquote {
  border-left: 4px solid var(--accent-cyan); padding: 16px 24px;
  font-style: italic; font-size: 1.2rem; background: rgba(121,192,255,0.06);
  border-radius: 0 8px 8px 0;
}
blockquote cite { display: block; margin-top: 8px; font-size: 0.85rem; opacity: 0.7; font-style: normal; }

/* ── Step Reveal ─────────────────────────────────────────────────── */
.step-hidden { opacity: 0; transform: translateY(5px); }
.step-visible { opacity: 1; transform: translateY(0); transition: opacity 0.35s ease, transform 0.35s ease; }

/* ── Nav Bar ─────────────────────────────────────────────────────── */
#nav-bar {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  background: rgba(0,0,0,0.75); backdrop-filter: blur(10px);
  padding: 8px 20px; border-radius: 999px; z-index: 100;
  font-size: 14px; user-select: none;
}
#nav-bar button {
  background: none; border: none; color: #f0f0f0; font-size: 18px;
  cursor: pointer; padding: 4px 8px; border-radius: 4px;
}
#nav-bar button:hover { background: rgba(255,255,255,0.12); }
#scrubber { width: 120px; accent-color: var(--accent-cyan); }
#slide-counter { font-variant-numeric: tabular-nums; min-width: 60px; text-align: center; }

/* ── Overview Mode ───────────────────────────────────────────────── */
.overview-mode { overflow: auto; }
.overview-mode #deck {
  display: flex; flex-wrap: wrap; gap: 20px; padding: 40px;
  position: relative; height: auto;
}
.overview-mode .slide {
  display: flex !important; position: relative; width: 280px; height: 180px;
  padding: 16px; border-radius: 8px; border: 2px solid var(--stroke);
  cursor: pointer; font-size: 0.4rem; overflow: hidden;
}
.overview-mode .slide:hover { border-color: var(--accent-cyan); }
.overview-mode #nav-bar { display: none; }

/* ── Print ───────────────────────────────────────────────────────── */
@media print {
  .slide { display: flex !important; position: relative !important; page-break-after: always; height: auto; min-height: 100vh; }
  #nav-bar, .skip-link { display: none !important; }
  body { overflow: visible; background: #fff; color: #111; }
}
`
