# Interactive JS Artifacts

Embeddable JavaScript visualizations bundled as self-contained HTML.

These are standalone HTML canvas files that run in iframes with zero dependencies.
Each artifact is a self-contained visualization suitable for embedding in slide
stage panels (layout-split right column) or full-width content slides.

## Usage

Artifacts load via `<iframe>` in a slide's stage zone. The slide builder creates
an iframe element pointing to the artifact URL. Each artifact accepts optional
configuration via URL parameters or postMessage.

## Catalog

| Artifact | Category | Interactive | Description |
|----------|----------|-------------|-------------|
| boids | emergence | yes (click to add) | Flocking simulation, agent-based movement |
| fourier | signal | yes (draw path) | Rotating epicycles decompose waveforms |
| life | cellular automata | yes (draw) | Conway's Game of Life |
| logistic | chaos | yes (hover) | Bifurcation diagram — order meets chaos |
| lorenz | chaos | yes (rotate) | 3D chaotic butterfly attractor |
| percolation | phase transition | yes (adjust p) | Phase transition on a probability grid |
| voronoi | geometry | yes (click) | Click to partition the plane by nearest points |
