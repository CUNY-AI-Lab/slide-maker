/**
 * Client-side copy of the framework CSS used in exported slides.
 * Kept in sync with apps/api/src/export/framework-css.ts
 * The iframe srcdoc uses this directly so the canvas preview
 * matches the export output pixel-for-pixel.
 */
export const FRAMEWORK_CSS = `
/* ── Reset & Base ────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; width: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: #111827; color: #f0f0f0; }

/* ── Custom Properties ───────────────────────────────────────────── */
:root {
  --accent-cyan: #64b5f6;
  --accent-blue: #3b82f6;
  --accent-navy: #1e3a5f;
  --accent-red: #f87171;
  --accent-amber: #fbbf24;
  --accent-green: #6ee7b7;
  --bg-light: #fafaf9;
  --bg-surface: #f5f5f4;
  --border-subtle: rgba(255,255,255,0.06);
  --border-subtle-light: rgba(0,0,0,0.06);
  --stroke: rgba(255,255,255,0.06);
  --text-primary: #f0f0f0;
  --text-muted: rgba(240,240,240,0.65);
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
h1 { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 600; }
h2 { font-size: clamp(2rem, 3.8vw, 3.2rem); font-weight: 500; }
h3 { font-size: clamp(1.5rem, 2.8vw, 2.2rem); font-weight: 500; }
h4 { font-size: clamp(1.2rem, 2vw, 1.6rem); font-weight: 500; }
.text-body { font-size: clamp(1.1rem, 1.8vw, 1.5rem); line-height: 1.65; color: var(--text-muted); }
code, pre { font-family: 'JetBrains Mono', monospace; }
pre { background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 20px 24px; overflow-x: auto; font-size: 1.05rem; line-height: 1.5; }

/* ── Slide Base ──────────────────────────────────────────────────── */
.slide {
  display: flex; position: relative; width: 100%; height: 100vh;
  padding: 60px 80px; overflow: auto; flex-direction: column; justify-content: center;
}

/* ── Layout: Title ───────────────────────────────────────────────── */
.title-slide {
  background: var(--accent-navy);
  text-align: center; align-items: center;
}

/* ── Layout: Split ───────────────────────────────────────────────── */
.layout-split { flex-direction: row; gap: 40px; align-items: stretch; }
.layout-split > .content { flex: 0.45; display: flex; flex-direction: column; justify-content: center; gap: 16px; }
.layout-split > .stage {
  flex: 0.55; display: flex; flex-direction: column; justify-content: center;
  align-items: center; gap: 16px;
  background: rgba(255,255,255,0.02); border-left: 1px solid var(--border-subtle);
}

/* ── Layout: Content ─────────────────────────────────────────────── */
.layout-content { align-items: center; gap: 24px; }
.layout-content > .content { max-width: 900px; width: 100%; }

/* ── Layout: Grid ────────────────────────────────────────────────── */
.layout-grid { align-items: center; gap: 24px; }

/* ── Layout: Full Dark ───────────────────────────────────────────── */
.layout-full-dark { background: #0d1117; align-items: center; justify-content: center; gap: 24px; }

/* ── Layout: Divider ─────────────────────────────────────────────── */
.layout-divider {
  background: var(--accent-navy);
  align-items: center; justify-content: center; text-align: center; gap: 16px;
}

/* ── Layout: Closing ─────────────────────────────────────────────── */
.closing-slide {
  background: var(--accent-navy);
  align-items: center; justify-content: center; text-align: center; gap: 16px;
}

/* ── Module: Card ────────────────────────────────────────────────── */
.card {
  background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 24px;
}
.card-cyan { border-left: 3px solid var(--accent-cyan); }
.card-navy { border-left: 3px solid var(--accent-navy); }
.card h3 { font-size: 1.3rem; margin-bottom: 8px; }
.card p { font-size: 1.15rem; color: var(--text-muted); line-height: 1.5; }

/* ── Module: Label ───────────────────────────────────────────────── */
.label {
  display: inline-block; padding: 0; background: none; border-radius: 0;
  font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
}
.label-cyan { color: var(--accent-cyan); }
.label-blue { color: var(--accent-blue); }
.label-navy { color: #7b9fd4; }
.label-red { color: var(--accent-red); }
.label-amber { color: var(--accent-amber); }
.label-green { color: var(--accent-green); }

/* ── Module: Tip Box ─────────────────────────────────────────────── */
.tip-box {
  background: rgba(100,181,246,0.05); border: 1px solid rgba(100,181,246,0.12);
  border-radius: 8px; padding: 20px 24px; font-size: 1.15rem; line-height: 1.6;
}
.tip-box strong { display: block; margin-bottom: 6px; color: var(--accent-cyan); font-weight: 500; }

/* ── Module: Prompt Block ────────────────────────────────────────── */
.prompt-block {
  border-radius: 8px; padding: 20px 24px; font-size: 1.05rem;
  border: 1px solid var(--border-subtle);
}
.prompt-block pre { background: transparent; padding: 0; margin: 0; white-space: pre-wrap; border: none; font-size: inherit; }
.prompt-good { border-color: rgba(110,231,183,0.3); background: rgba(110,231,183,0.04); }
.prompt-mid { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.04); }
.prompt-bad { border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.04); }

/* ── Module: Carousel ────────────────────────────────────────────── */
.carousel { position: relative; width: 100%; overflow: hidden; border-radius: 8px; }
.carousel-track { display: flex; transition: transform 0.4s ease; }
.carousel-item { min-width: 100%; }
.carousel-item img { width: 100%; display: block; border-radius: 8px; }
.carousel-dots { display: flex; justify-content: center; gap: 6px; padding: 10px 0; }
.carousel-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,0.2); border: none; cursor: pointer;
  transition: background 0.2s;
}
.carousel-dot.active { background: var(--accent-cyan); }

/* ── Module: Comparison ──────────────────────────────────────────── */
.comparison { display: flex; gap: 20px; width: 100%; }
.comparison-panel {
  flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 24px;
}
.comparison-panel h3 { font-size: 1.3rem; margin-bottom: 8px; }
.comparison-panel p { font-size: 1.15rem; color: var(--text-muted); line-height: 1.5; }

/* ── Module: Card Grid ───────────────────────────────────────────── */
.card-grid { display: grid; gap: 20px; width: 100%; }

/* ── Module: Flow ────────────────────────────────────────────────── */
.flow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
.flow-node {
  background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle);
  border-radius: 8px; padding: 14px 22px; font-size: 1.15rem; text-align: center;
}
.flow-arrow { font-size: 1.2rem; color: var(--text-muted); }

/* ── Module: Stream List ─────────────────────────────────────────── */
.stream-list { list-style: none; padding: 0; }
.stream-list li {
  padding: 12px 16px; border-left: 2px solid var(--accent-cyan);
  margin-bottom: 6px; background: rgba(255,255,255,0.02); border-radius: 0 6px 6px 0;
  font-size: 1.15rem; line-height: 1.5;
}

/* ── Module: Image ───────────────────────────────────────────────── */
figure { text-align: center; margin: 0; }
figure img { max-width: 100%; max-height: 60vh; border-radius: 6px; object-fit: contain; }
figcaption { margin-top: 8px; font-size: 0.85rem; color: var(--text-muted); }

/* ── Module: Artifact ─────────────────────────────────────────────── */
.artifact-wrapper { width: 100%; border-radius: 8px; overflow: hidden; }
.artifact-wrapper iframe { display: block; }

/* ── Blockquote ──────────────────────────────────────────────────── */
blockquote {
  border-left: 3px solid var(--accent-cyan); padding: 16px 24px;
  font-style: italic; font-size: 1.15rem; background: rgba(100,181,246,0.04);
  border-radius: 0 6px 6px 0;
}
blockquote cite { display: block; margin-top: 8px; font-size: 0.85rem; color: var(--text-muted); font-style: normal; }

/* ── Step Reveal (all visible in preview) ───────────────────────── */
.step-hidden { opacity: 1; transform: none; }
.step-visible { opacity: 1; transform: none; }
`
