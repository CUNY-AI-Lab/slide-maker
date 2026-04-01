export const NATIVE_ARTIFACT_NAMES = new Set([
  'A* Pathfinding', 'Boids', 'Flow Field', 'Harmonograph',
  "Langton's Ant", 'Lorenz Attractor', 'Molnar', 'Nake',
  'Rössler Attractor', 'Sprott Attractor', '10 PRINT', 'Truchet Tiles',
])

export const ARTIFACTS_JS = `
(function() {
  'use strict';
  var registry = {};
  function register(name, fn) { registry[name] = fn; }

  // --- A* Pathfinding ---
  register('A* Pathfinding', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var SPEED_MAP = { slow: 2, medium: 4, fast: 8, instant: 0 };
    function resolveSpeed(v) {
      if (typeof v === 'string') return SPEED_MAP[v] != null ? SPEED_MAP[v] : 4;
      return typeof v === 'number' ? v : 4;
    }

    var EMPTY = 0, WALL = 1, START = 2, END = 3;

    var COL = {
      bg: '#0a0a0f',
      empty: '#12121a',
      wall: '#2a2a3a',
      start: '#00e87b',
      end: '#ff4466',
      visitA: 'rgba(60,140,255,0.35)',
      frontierA: 'rgba(60,140,255,0.15)',
      pathA: '#4da6ff',
      visitD: 'rgba(255,160,40,0.35)',
      frontierD: 'rgba(255,160,40,0.15)',
      pathD: '#ffa028',
    };

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
    var raf = 0;

    var config = {
      cellSize: 20,
      animSpeed: 4,
      mazeOnStart: true,
    };
    Object.assign(config, initialConfig);

    var grid = [];
    var startCell = { r: 0, c: 0 };
    var endCell = { r: 0, c: 0 };
    var animating = false;
    var animId = null;
    var pathA = null;
    var pathD = null;
    var visitedA = null;
    var visitedD = null;
    var mode = 'draw';
    var drawing = false;
    var drawVal = WALL;
    var demoTimer = null;

    function resize() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initGrid() {
      var cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)));
      cols = Math.floor(W / cs);
      rows = Math.floor(H / cs);
      grid = [];
      for (var r = 0; r < rows; r++) {
        grid[r] = [];
        for (var c = 0; c < cols; c++) grid[r][c] = EMPTY;
      }
      startCell = { r: Math.floor(rows / 2), c: Math.floor(cols * 0.15) };
      endCell = { r: Math.floor(rows / 2), c: Math.floor(cols * 0.85) };
      if (startCell.r >= rows) startCell.r = rows - 1;
      if (endCell.r >= rows) endCell.r = rows - 1;
      if (startCell.c >= cols) startCell.c = cols - 1;
      if (endCell.c >= cols) endCell.c = cols - 1;
      grid[startCell.r][startCell.c] = START;
      grid[endCell.r][endCell.c] = END;
      resetAnim();
      render();
    }

    function resetAnim() {
      animating = false;
      pathA = null;
      pathD = null;
      visitedA = null;
      visitedD = null;
      if (animId != null) { cancelAnimationFrame(animId); animId = null; }
    }

    function cellAt(x, y) {
      var cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)));
      var c = Math.floor(x / cs);
      var r = Math.floor(y / cs);
      if (r >= 0 && r < rows && c >= 0 && c < cols) return { r: r, c: c };
      return null;
    }

    function heuristic(a, b) {
      return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
    }

    function neighbors(r, c) {
      var dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      var out = [];
      for (var i = 0; i < dirs.length; i++) {
        var dr = dirs[i][0], dc = dirs[i][1];
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] !== WALL) {
          if (dr !== 0 && dc !== 0) {
            if (grid[r + dr][c] === WALL || grid[r][c + dc] === WALL) continue;
          }
          out.push({ r: nr, c: nc, cost: dr !== 0 && dc !== 0 ? 1.414 : 1 });
        }
      }
      return out;
    }

    function runSearch(useHeuristic) {
      var open = [];
      var gScore = {};
      var fScore = {};
      var cameFrom = {};
      var closed = new Set();
      var frames = [];
      var key = function(r, c) { return r * cols + c; };
      var sk = key(startCell.r, startCell.c);
      var ek = key(endCell.r, endCell.c);
      gScore[sk] = 0;
      fScore[sk] = useHeuristic ? heuristic(startCell, endCell) : 0;
      open.push({ r: startCell.r, c: startCell.c, f: fScore[sk] });

      while (open.length > 0) {
        open.sort(function(a, b) { return a.f - b.f; });
        var cur = open.shift();
        var ck = key(cur.r, cur.c);
        if (closed.has(ck)) continue;
        closed.add(ck);
        frames.push({ r: cur.r, c: cur.c, type: 'visit' });
        if (ck === ek) {
          var path = [];
          var k = ek;
          while (k !== undefined) {
            path.push({ r: Math.floor(k / cols), c: k % cols });
            k = cameFrom[k];
          }
          path.reverse();
          return { frames: frames, path: path, visited: closed.size };
        }
        var nbs = neighbors(cur.r, cur.c);
        for (var ni = 0; ni < nbs.length; ni++) {
          var nb = nbs[ni];
          var nk = key(nb.r, nb.c);
          if (closed.has(nk)) continue;
          var tentG = (gScore[ck] || 0) + nb.cost;
          if (tentG < (gScore[nk] != null ? gScore[nk] : Infinity)) {
            gScore[nk] = tentG;
            fScore[nk] = tentG + (useHeuristic ? heuristic(nb, endCell) : 0);
            cameFrom[nk] = ck;
            open.push({ r: nb.r, c: nb.c, f: fScore[nk] });
            frames.push({ r: nb.r, c: nb.c, type: 'frontier' });
          }
        }
      }
      return { frames: frames, path: null, visited: closed.size };
    }

    function render() {
      var cs = config.cellSize || Math.max(12, Math.min(28, Math.floor(Math.min(W, H) / 40)));
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * cs, y = r * cs;
          ctx.fillStyle = grid[r][c] === WALL ? COL.wall : COL.empty;
          ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        }
      }
      if (visitedA) {
        for (var i = 0; i < visitedA.length; i++) {
          var f = visitedA[i];
          var x = f.c * cs, y = f.r * cs;
          ctx.fillStyle = f.type === 'visit' ? COL.visitA : COL.frontierA;
          ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        }
      }
      if (visitedD) {
        for (var i = 0; i < visitedD.length; i++) {
          var f = visitedD[i];
          var x = f.c * cs, y = f.r * cs;
          ctx.fillStyle = f.type === 'visit' ? COL.visitD : COL.frontierD;
          ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
        }
      }
      if (pathA && pathA.length > 1) {
        ctx.strokeStyle = COL.pathA; ctx.lineWidth = Math.max(2, cs * 0.3);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pathA[0].c * cs + cs / 2, pathA[0].r * cs + cs / 2);
        for (var i = 1; i < pathA.length; i++) ctx.lineTo(pathA[i].c * cs + cs / 2, pathA[i].r * cs + cs / 2);
        ctx.stroke();
      }
      if (pathD && pathD.length > 1) {
        ctx.strokeStyle = COL.pathD; ctx.lineWidth = Math.max(2, cs * 0.3);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pathD[0].c * cs + cs / 2, pathD[0].r * cs + cs / 2);
        for (var i = 1; i < pathD.length; i++) ctx.lineTo(pathD[i].c * cs + cs / 2, pathD[i].r * cs + cs / 2);
        ctx.stroke();
      }
      var sr = startCell.r * cs + cs / 2, sc = startCell.c * cs + cs / 2;
      var er = endCell.r * cs + cs / 2, ec = endCell.c * cs + cs / 2;
      ctx.fillStyle = COL.start;
      ctx.beginPath(); ctx.arc(sc, sr, cs * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.end;
      ctx.beginPath(); ctx.arc(ec, er, cs * 0.35, 0, Math.PI * 2); ctx.fill();
    }

    function animateSearch(resultA, resultD) {
      animating = true;
      visitedA = []; visitedD = [];
      pathA = null; pathD = null;
      var framesA = resultA ? resultA.frames : [];
      var framesD = resultD ? resultD.frames : [];
      var maxLen = Math.max(framesA.length, framesD.length);
      var idx = 0;
      var speed = resolveSpeed(config.animSpeed);
      var spd = speed === 0 ? maxLen : speed;

      function step() {
        for (var s = 0; s < spd && idx < maxLen; s++, idx++) {
          if (idx < framesA.length) visitedA.push(framesA[idx]);
          if (idx < framesD.length) visitedD.push(framesD[idx]);
        }
        render();
        if (idx >= maxLen) {
          if (resultA) pathA = resultA.path;
          if (resultD) pathD = resultD.path;
          render();
          animating = false;
          return;
        }
        animId = requestAnimationFrame(step);
      }
      step();
    }

    function generateMaze() {
      resetAnim();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) grid[r][c] = WALL;
      var visited = new Set();
      var stack = [];
      var sr = 1, sc = 1;
      grid[sr][sc] = EMPTY;
      visited.add(sr * cols + sc);
      stack.push({ r: sr, c: sc });
      while (stack.length > 0) {
        var cur = stack[stack.length - 1];
        var nbrs = [];
        var dirs = [[0, 2], [2, 0], [0, -2], [-2, 0]];
        for (var di = 0; di < dirs.length; di++) {
          var dr = dirs[di][0], dc = dirs[di][1];
          var nr = cur.r + dr, nc = cur.c + dc;
          if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && !visited.has(nr * cols + nc)) {
            nbrs.push({ r: nr, c: nc, wr: cur.r + dr / 2, wc: cur.c + dc / 2 });
          }
        }
        if (nbrs.length === 0) { stack.pop(); continue; }
        var next = nbrs[Math.floor(Math.random() * nbrs.length)];
        grid[next.wr][next.wc] = EMPTY;
        grid[next.r][next.c] = EMPTY;
        visited.add(next.r * cols + next.c);
        stack.push({ r: next.r, c: next.c });
      }
      startCell = { r: 1, c: 1 };
      endCell = { r: rows - 2 - (rows % 2 === 0 ? 1 : 0), c: cols - 2 - (cols % 2 === 0 ? 1 : 0) };
      if (endCell.r >= 0 && endCell.c >= 0 && grid[endCell.r] && grid[endCell.r][endCell.c] === WALL) {
        endCell.r--; endCell.c--;
      }
      grid[startCell.r][startCell.c] = START;
      grid[endCell.r][endCell.c] = END;
      render();
    }

    function autoDemo() {
      generateMaze();
      var rA = runSearch(true);
      animateSearch(rA, null);
      var speed = resolveSpeed(config.animSpeed);
      var delay = Math.max(3000, (rA.frames.length / (speed || 8)) * 16 + 3000);
      demoTimer = setTimeout(autoDemo, delay);
    }

    // Pointer interaction
    function onPointerDown(e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      if (animating) return;
      var rect = root.getBoundingClientRect();
      var x = e.clientX - rect.left, y = e.clientY - rect.top;
      var cell = cellAt(x, y);
      if (!cell) return;
      if (cell.r === startCell.r && cell.c === startCell.c) { mode = 'dragStart'; return; }
      if (cell.r === endCell.r && cell.c === endCell.c) { mode = 'dragEnd'; return; }
      mode = 'draw'; drawing = true;
      resetAnim();
      if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
      drawVal = grid[cell.r][cell.c] === WALL ? EMPTY : WALL;
      grid[cell.r][cell.c] = drawVal;
      render();
    }

    function onPointerMove(e) {
      e.preventDefault();
      var rect = root.getBoundingClientRect();
      var x = e.clientX - rect.left, y = e.clientY - rect.top;
      var cell = cellAt(x, y);
      if (!cell) return;
      if (mode === 'dragStart') {
        if (grid[cell.r][cell.c] !== WALL && !(cell.r === endCell.r && cell.c === endCell.c)) {
          grid[startCell.r][startCell.c] = EMPTY;
          startCell = cell;
          grid[startCell.r][startCell.c] = START;
          resetAnim(); render();
        }
      } else if (mode === 'dragEnd') {
        if (grid[cell.r][cell.c] !== WALL && !(cell.r === startCell.r && cell.c === startCell.c)) {
          grid[endCell.r][endCell.c] = EMPTY;
          endCell = cell;
          grid[endCell.r][endCell.c] = END;
          resetAnim(); render();
        }
      } else if (drawing) {
        if (!(cell.r === startCell.r && cell.c === startCell.c) && !(cell.r === endCell.r && cell.c === endCell.c)) {
          grid[cell.r][cell.c] = drawVal;
          render();
        }
      }
    }

    function onPointerUp() {
      drawing = false; mode = 'draw';
    }

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    var prevW = 0, prevH = 0, initialized = false;
    var ro = new ResizeObserver(function() {
      var rect = root.getBoundingClientRect();
      var nw = Math.floor(rect.width), nh = Math.floor(rect.height);
      if (nw <= 0 || nh <= 0) return;
      if (nw === prevW && nh === prevH) return;
      prevW = nw; prevH = nh;
      resize();
      if (!initialized) {
        initialized = true;
        initGrid();
        if (config.mazeOnStart) {
          demoTimer = setTimeout(autoDemo, 300);
        }
      } else if (!animating && !demoTimer) {
        initGrid();
        if (config.mazeOnStart) {
          demoTimer = setTimeout(autoDemo, 300);
        }
      } else {
        render();
      }
    });
    ro.observe(root);

    return {
      update: function(next) {
        var prev = Object.assign({}, config);
        Object.assign(config, next);
        if (next.cellSize !== undefined && next.cellSize !== prev.cellSize) {
          initGrid();
        }
      },
      destroy: function() {
        if (animId != null) cancelAnimationFrame(animId);
        if (demoTimer) clearTimeout(demoTimer);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        root.removeChild(canvas);
      },
    };
  });

  // --- Boids ---
  register('Boids', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var px = null, py = null;
    var raf = 0;

    var config = {
      count: 120,
      maxSpeed: 2.2,
      separationRadius: 18,
      alignmentRadius: 42,
      cohesionRadius: 52,
      separationWeight: 1.35,
      alignmentWeight: 0.85,
      cohesionWeight: 0.65,
    };
    Object.assign(config, initialConfig);

    var boid = [];

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function reset() {
      boid.length = 0;
      for (var i = 0; i < config.count; i++) {
        boid.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() * 2 - 1) * 0.8,
          vy: (Math.random() * 2 - 1) * 0.8,
        });
      }
    }

    function wrap(b) {
      if (b.x < -20) b.x = W + 20;
      if (b.x > W + 20) b.x = -20;
      if (b.y < -20) b.y = H + 20;
      if (b.y > H + 20) b.y = -20;
    }

    function loop() {
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, W, H);

      var maxSpeed = config.maxSpeed;
      var maxForce = 0.06;
      var sepR2 = config.separationRadius * config.separationRadius;
      var aliR2 = config.alignmentRadius * config.alignmentRadius;
      var cohR2 = config.cohesionRadius * config.cohesionRadius;

      for (var i = 0; i < boid.length; i++) {
        var b = boid[i];
        var sx = 0, sy = 0, sa = 0;
        var ax = 0, ay = 0, aa = 0;
        var cx = 0, cy = 0, ca = 0;

        for (var j = 0; j < boid.length; j++) {
          if (i === j) continue;
          var o = boid[j];
          var dx = o.x - b.x;
          var dy = o.y - b.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 1e-4) continue;
          if (d2 < sepR2) {
            var d = Math.sqrt(d2);
            sx -= dx / d;
            sy -= dy / d;
            sa++;
          }
          if (d2 < aliR2) {
            ax += o.vx;
            ay += o.vy;
            aa++;
          }
          if (d2 < cohR2) {
            cx += o.x;
            cy += o.y;
            ca++;
          }
        }

        var fx = 0, fy = 0;
        if (sa) {
          sx /= sa; sy /= sa;
          var m = Math.hypot(sx, sy) || 1;
          sx = (sx / m) * maxSpeed - b.vx;
          sy = (sy / m) * maxSpeed - b.vy;
          var sm = Math.hypot(sx, sy) || 1;
          if (sm > 0.06) { sx = (sx / sm) * 0.06; sy = (sy / sm) * 0.06; }
          fx += sx * config.separationWeight;
          fy += sy * config.separationWeight;
        }
        if (aa) {
          ax /= aa; ay /= aa;
          var m = Math.hypot(ax, ay) || 1;
          ax = (ax / m) * maxSpeed - b.vx;
          ay = (ay / m) * maxSpeed - b.vy;
          var am = Math.hypot(ax, ay) || 1;
          if (am > maxForce) { ax = (ax / am) * maxForce; ay = (ay / am) * maxForce; }
          fx += ax * config.alignmentWeight;
          fy += ay * config.alignmentWeight;
        }
        if (ca) {
          cx = cx / ca - b.x;
          cy = cy / ca - b.y;
          var m = Math.hypot(cx, cy) || 1;
          cx = (cx / m) * maxSpeed - b.vx;
          cy = (cy / m) * maxSpeed - b.vy;
          var cm = Math.hypot(cx, cy) || 1;
          if (cm > maxForce) { cx = (cx / cm) * maxForce; cy = (cy / cm) * maxForce; }
          fx += cx * config.cohesionWeight;
          fy += cy * config.cohesionWeight;
        }

        if (px != null) {
          var dx = px - b.x;
          var dy = py - b.y;
          var d = Math.hypot(dx, dy) || 1;
          var pull = Math.min(1, 180 / d) * 0.015;
          fx += (dx / d) * pull;
          fy += (dy / d) * pull;
        }

        b.vx += fx; b.vy += fy;
        var sp = Math.hypot(b.vx, b.vy) || 1;
        if (sp > maxSpeed) { b.vx = (b.vx / sp) * maxSpeed; b.vy = (b.vy / sp) * maxSpeed; }
        b.x += b.vx; b.y += b.vy;
        wrap(b);
      }

      ctx.fillStyle = 'rgba(192,192,192,0.7)';
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      for (var bi = 0; bi < boid.length; bi++) {
        var b = boid[bi];
        var a = Math.atan2(b.vy, b.vx);
        var s = 7;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * s, b.y + Math.sin(a) * s);
        ctx.lineTo(b.x + Math.cos(a + 2.4) * s * 0.75, b.y + Math.sin(a + 2.4) * s * 0.75);
        ctx.lineTo(b.x + Math.cos(a - 2.4) * s * 0.75, b.y + Math.sin(a - 2.4) * s * 0.75);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }

      raf = requestAnimationFrame(loop);
    }

    function onMouseMove(e) { px = e.clientX - root.getBoundingClientRect().left; py = e.clientY - root.getBoundingClientRect().top; }
    function onMouseLeave() { px = py = null; }
    function onTouchMove(e) { var t = e.touches[0]; if (!t) return; var r = root.getBoundingClientRect(); px = t.clientX - r.left; py = t.clientY - r.top; }
    function onTouchEnd() { px = py = null; }

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    resize(); reset(); raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        var countChanged = nextMerged.count !== config.count;
        config = nextMerged;
        if (countChanged) reset();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        root.removeChild(canvas);
      },
    };
  });

  // --- Flow Field ---
  register('Flow Field', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    function Perlin() {
      this.p = [];
      for (var i = 0; i < 512; i++) this.p[i] = Math.floor(Math.random() * 256);
    }
    Perlin.prototype.fade = function(t) { return t * t * t * (t * (t * 6 - 15) + 10); };
    Perlin.prototype.lerp = function(t, a, b) { return a + t * (b - a); };
    Perlin.prototype.grad = function(hash, x, y) {
      var h = hash & 15;
      var u = h < 8 ? x : y;
      var v = h < 4 ? y : x;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };
    Perlin.prototype.noise = function(x, y) {
      var X = Math.floor(x) & 255;
      var Y = Math.floor(y) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      var u = this.fade(x);
      var v = this.fade(y);
      var a = this.p[X] + Y;
      var b = this.p[X + 1] + Y;
      return this.lerp(v,
        this.lerp(u, this.grad(this.p[a], x, y), this.grad(this.p[b], x - 1, y)),
        this.lerp(u, this.grad(this.p[a + 1], x, y - 1), this.grad(this.p[b + 1], x - 1, y - 1))
      );
    };

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;
    var time = 0;

    var config = {
      particleCount: 3000,
      noiseScale: 0.003,
      maxSpeed: 2,
      damping: 0.95,
      hueStart: 180,
      hueRange: 60,
    };
    Object.assign(config, initialConfig);

    var perlin = new Perlin();
    var particles = [];
    var mx = null, my = null;

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createParticle() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0,
        vy: 0,
        alpha: Math.random() * 0.5 + 0.3,
        maxSpeed: config.maxSpeed,
        hue: Math.random() * config.hueRange + config.hueStart,
      };
    }

    function initParticles() {
      particles = [];
      for (var i = 0; i < config.particleCount; i++) particles.push(createParticle());
    }

    function loop() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, W, H);

      var scale = config.noiseScale;

      for (var pi = 0; pi < particles.length; pi++) {
        var p = particles[pi];
        var angle = perlin.noise(p.x * scale, p.y * scale + time * 0.0001) * Math.PI * 4;
        p.vx += Math.cos(angle) * 0.1;
        p.vy += Math.sin(angle) * 0.1;

        if (mx != null && my != null) {
          var dx = mx - p.x;
          var dy = my - p.y;
          var d = Math.hypot(dx, dy) || 1;
          if (d < 150) {
            var force = (1 - d / 150) * 0.3;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        var speed = Math.hypot(p.vx, p.vy);
        if (speed > p.maxSpeed) {
          p.vx = (p.vx / speed) * p.maxSpeed;
          p.vy = (p.vy / speed) * p.maxSpeed;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= config.damping;
        p.vy *= config.damping;

        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.fillStyle = 'hsla(' + p.hue + ', 70%, 60%, ' + p.alpha + ')';
        ctx.fillRect(p.x, p.y, 2, 2);
      }

      time++;
      raf = requestAnimationFrame(loop);
    }

    function onMouseMove(e) {
      var rect = root.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    }
    function onMouseLeave() { mx = my = null; }
    function onTouchMove(e) {
      var t = e.touches[0];
      if (!t) return;
      var rect = root.getBoundingClientRect();
      mx = t.clientX - rect.left;
      my = t.clientY - rect.top;
    }
    function onTouchEnd() { mx = my = null; }

    var ro = new ResizeObserver(function() {
      resize();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      for (var pi = 0; pi < particles.length; pi++) {
        var p = particles[pi];
        if (p.x > W) p.x = Math.random() * W;
        if (p.y > H) p.y = Math.random() * H;
      }
    });
    ro.observe(root);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    resize();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    initParticles();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var prevCount = config.particleCount;
        Object.assign(config, next);
        if (config.particleCount !== prevCount) {
          initParticles();
        }
        for (var pi = 0; pi < particles.length; pi++) {
          particles[pi].maxSpeed = config.maxSpeed;
        }
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        root.removeChild(canvas);
      },
    };
  });

  // --- Harmonograph ---
  register('Harmonograph', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;
    var drawingActive = false;

    var config = {
      damping: 0.002,
      stepsPerFrame: 40,
      hue: 35,
    };
    Object.assign(config, initialConfig);

    var pens;
    var t = 0;
    var prev = { x: 0, y: 0 };
    var strokeHue = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function randomFreq() {
      var base = 1 + Math.floor(Math.random() * 4);
      return base + (Math.random() - 0.5) * 0.02;
    }

    function initPendulums() {
      var d = config.damping;
      pens = {
        x1: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.4 + Math.random() * 0.15, d: d * 0.5 + Math.random() * d * 1.5 },
        x2: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.2 + Math.random() * 0.15, d: d * 0.25 + Math.random() * d },
        y1: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.4 + Math.random() * 0.15, d: d * 0.5 + Math.random() * d * 1.5 },
        y2: { f: randomFreq(), p: Math.random() * Math.PI * 2, a: 0.2 + Math.random() * 0.15, d: d * 0.25 + Math.random() * d },
      };
    }

    function getPoint(t) {
      var scale = Math.min(W, H) * 0.42;
      var cx = W / 2, cy = H / 2;

      var x = pens.x1.a * Math.sin(pens.x1.f * t + pens.x1.p) * Math.exp(-pens.x1.d * t)
            + pens.x2.a * Math.sin(pens.x2.f * t + pens.x2.p) * Math.exp(-pens.x2.d * t);
      var y = pens.y1.a * Math.sin(pens.y1.f * t + pens.y1.p) * Math.exp(-pens.y1.d * t)
            + pens.y2.a * Math.sin(pens.y2.f * t + pens.y2.p) * Math.exp(-pens.y2.d * t);

      return { x: cx + x * scale, y: cy + y * scale };
    }

    function start() {
      cancelAnimationFrame(raf);
      resize();
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, W, H);
      initPendulums();
      t = 0;
      drawingActive = true;

      strokeHue = (config.hue - 10) + Math.random() * 25;
      prev = getPoint(0);

      var dt = 0.04;

      function draw() {
        for (var i = 0; i < config.stepsPerFrame; i++) {
          t += dt;
          var cur = getPoint(t);

          var amp = Math.exp(-Math.min(pens.x1.d, pens.y1.d) * t);
          if (amp < 0.005) {
            drawingActive = false;
            return;
          }

          var alpha = Math.min(0.8, 0.15 + amp * 0.6);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          ctx.strokeStyle = 'hsla(' + strokeHue + ', 50%, 65%, ' + alpha + ')';
          ctx.lineWidth = 0.5 + amp * 1.2;
          ctx.lineCap = 'round';
          ctx.stroke();

          prev = cur;
        }

        if (drawingActive) raf = requestAnimationFrame(draw);
      }

      raf = requestAnimationFrame(draw);
    }

    function onClick() { start(); }
    function onTouchStart(e) { e.preventDefault(); start(); }

    var ro = new ResizeObserver(function() { if (!drawingActive) resize(); });
    ro.observe(root);

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });

    resize();
    start();

    return {
      update: function(next) {
        Object.assign(config, next);
        start();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('touchstart', onTouchStart);
        root.removeChild(canvas);
      },
    };
  });

  // --- Langton's Ant ---
  register("Langton's Ant", function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var raf = 0;

    var config = {
      cellSize: 3,
      stepsPerFrame: 50,
      startingAnts: 1,
    };
    Object.assign(config, initialConfig);

    var DX = [0, 1, 0, -1];
    var DY = [-1, 0, 1, 0];

    var PALETTE = [
      [10, 10, 20],
      [230, 180, 60],
    ];

    var cols = 0, rows = 0;
    var grid = new Uint8Array(0);
    var ants = [];
    var step = 0;
    var running = true;

    function hueToRgb(h) {
      var hn = h / 360;
      var hi = Math.floor(hn * 6);
      var f = hn * 6 - hi;
      var q = Math.floor((1 - f) * 255);
      var t = Math.floor(f * 255);
      var table = [
        [255, t, 0], [q, 255, 0], [0, 255, t],
        [0, q, 255], [t, 0, 255], [255, 0, q],
      ];
      return table[hi % 6];
    }

    function init() {
      var CELL = config.cellSize;
      var rect = root.getBoundingClientRect();
      cols = Math.floor(Math.max(1, rect.width) / CELL);
      rows = Math.floor(Math.max(1, rect.height) / CELL);
      canvas.width = cols;
      canvas.height = rows;
      grid = new Uint8Array(cols * rows);
      ants = [];
      for (var i = 0; i < config.startingAnts; i++) {
        ants.push({
          x: Math.floor(cols / 2) + i * 3,
          y: Math.floor(rows / 2),
          d: Math.floor(Math.random() * 4),
          h: 120 + i * 60,
        });
      }
      step = 0;
    }

    function tick() {
      for (var ai = 0; ai < ants.length; ai++) {
        var a = ants[ai];
        var i = a.y * cols + a.x;
        var s = grid[i];
        a.d = ((a.d + (s === 0 ? 1 : -1)) + 4) % 4;
        grid[i] = 1 - s;
        a.x = (a.x + DX[a.d] + cols) % cols;
        a.y = (a.y + DY[a.d] + rows) % rows;
      }
      step++;
    }

    function draw() {
      var img = ctx.getImageData(0, 0, cols, rows);
      var d = img.data;
      for (var i = 0; i < cols * rows; i++) {
        var s = grid[i];
        var b = i * 4;
        var p = PALETTE[s];
        d[b] = p[0]; d[b + 1] = p[1]; d[b + 2] = p[2]; d[b + 3] = 255;
      }
      for (var ai = 0; ai < ants.length; ai++) {
        var a = ants[ai];
        var b = (a.y * cols + a.x) * 4;
        var rgb = hueToRgb(a.h);
        d[b] = rgb[0]; d[b + 1] = rgb[1]; d[b + 2] = rgb[2]; d[b + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    function loop() {
      if (running) {
        for (var i = 0; i < config.stepsPerFrame; i++) tick();
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onClick(e) {
      var r = canvas.getBoundingClientRect();
      var x = Math.floor((e.clientX - r.left) / r.width * cols);
      var y = Math.floor((e.clientY - r.top) / r.height * rows);
      ants.push({ x: x, y: y, d: Math.floor(Math.random() * 4), h: Math.random() * 360 });
    }

    function onTouchEnd(e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      var r = canvas.getBoundingClientRect();
      var x = Math.floor((t.clientX - r.left) / r.width * cols);
      var y = Math.floor((t.clientY - r.top) / r.height * rows);
      ants.push({ x: x, y: y, d: Math.floor(Math.random() * 4), h: Math.random() * 360 });
    }

    var ro = new ResizeObserver(function() { init(); });
    ro.observe(root);

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    init();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        var needsReset = nextMerged.cellSize !== config.cellSize || nextMerged.startingAnts !== config.startingAnts;
        config = nextMerged;
        if (needsReset) init();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('touchend', onTouchEnd);
        root.removeChild(canvas);
      },
    };
  });

  // --- Lorenz Attractor ---
  register('Lorenz Attractor', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;

    var config = {
      particleCount: 6,
      sigma: 10,
      rho: 28,
      beta: 2.667,
      trailLength: 600,
      speed: 0.005,
    };
    Object.assign(config, initialConfig);

    var hues = [200, 260, 320, 40, 160, 80];

    var particles = [];
    var trails = [];

    var angle = 0, targetAngle = 0;
    var dragging = false, dragStartX = 0, dragStartAngle = 0;

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      particles = [];
      trails = [];
      for (var i = 0; i < config.particleCount; i++) {
        var p = {
          x: 0.1 + (Math.random() - 0.5) * 0.01,
          y: (Math.random() - 0.5) * 0.01,
          z: 25 + (Math.random() - 0.5) * 0.01,
        };
        particles.push(p);
        trails.push([{ x: p.x, y: p.y, z: p.z }]);
      }
    }

    function project(wx, wy, wz) {
      var cosA = Math.cos(angle), sinA = Math.sin(angle);
      var px = wx * cosA + wz * sinA;
      var py = wy;
      var scale = Math.min(W, H) / 55;
      return { sx: W / 2 + px * scale, sy: H * 0.55 - py * scale };
    }

    function integrate() {
      var sigma = config.sigma, rho = config.rho, beta = config.beta, dt = config.speed;
      for (var i = 0; i < config.particleCount; i++) {
        var p = particles[i];
        p.x += sigma * (p.y - p.x) * dt;
        p.y += (p.x * (rho - p.z) - p.y) * dt;
        p.z += (p.x * p.y - beta * p.z) * dt;
        trails[i].push({ x: p.x, y: p.y, z: p.z });
        if (trails[i].length > config.trailLength) trails[i].shift();
      }
    }

    function loop() {
      if (!dragging) targetAngle += 0.002;
      angle += (targetAngle - angle) * 0.08;
      for (var s = 0; s < 4; s++) integrate();

      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (var i = 0; i < config.particleCount; i++) {
        var trail = trails[i];
        if (trail.length < 2) continue;
        var hue = hues[i % hues.length];
        var prev = project(trail[0].x, trail[0].y, trail[0].z);
        for (var j = 1; j < trail.length; j++) {
          var cur = project(trail[j].x, trail[j].y, trail[j].z);
          var alpha = (j / trail.length) * 0.85;
          ctx.strokeStyle = 'hsla(' + hue + ',80%,65%,' + alpha + ')';
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(cur.sx, cur.sy);
          ctx.stroke();
          prev = cur;
        }
        var head = project(trail[trail.length - 1].x, trail[trail.length - 1].y, trail[trail.length - 1].z);
        ctx.fillStyle = 'hsla(' + hue + ',90%,80%,0.95)';
        ctx.beginPath();
        ctx.arc(head.sx, head.sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    }

    function onPointerDown(e) {
      dragging = true;
      dragStartX = e.clientX;
      dragStartAngle = targetAngle;
      canvas.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (dragging) targetAngle = dragStartAngle + (e.clientX - dragStartX) * 0.01;
    }
    function onPointerUp() { dragging = false; }

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);

    resize();
    init();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        var countChanged = nextMerged.particleCount !== config.particleCount;
        config = nextMerged;
        if (countChanged) init();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        root.removeChild(canvas);
      },
    };
  });

  // --- Molnar ---
  register('Molnar', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var mx = -1, my = -1;
    var raf = 0;

    var config = {
      gridCols: 24,
      gridRows: 24,
      disruption: true,
    };
    Object.assign(config, initialConfig);

    var grid = [];

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      generate();
    }

    function generate() {
      grid = [];
      var cols = config.gridCols;
      var rows = config.gridRows;
      var cellW = W / cols;
      var cellH = H / rows;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          grid.push({
            x: c * cellW + cellW / 2,
            y: r * cellH + cellH / 2,
            w: cellW * 0.7,
            h: cellH * 0.7,
            baseAngle: (Math.random() - 0.5) * 0.15,
            seed: Math.random(),
          });
        }
      }
    }

    function loop() {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#c0c0c0';
      ctx.lineWidth = 1;

      var radius = Math.min(W, H) * 0.25;
      for (var gi = 0; gi < grid.length; gi++) {
        var g = grid[gi];
        var dx = mx - g.x;
        var dy = my - g.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var influence = config.disruption ? Math.max(0, 1 - dist / radius) : 0;
        var disruption = influence * influence;
        var angle = g.baseAngle + disruption * (g.seed - 0.5) * Math.PI * 1.5;
        var scale = 1 - disruption * 0.4 * g.seed;
        var ox = disruption * (g.seed - 0.5) * 12;
        var oy = disruption * (g.seed - 0.5) * 12;

        ctx.save();
        ctx.translate(g.x + ox, g.y + oy);
        ctx.rotate(angle);
        ctx.globalAlpha = 0.4 + 0.6 * (1 - disruption * 0.5);
        ctx.strokeRect(-g.w * scale / 2, -g.h * scale / 2, g.w * scale, g.h * scale);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    }

    function onMouseMove(e) {
      var rect = root.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;
    }
    function onMouseLeave() { mx = -1; my = -1; }
    function onTouchMove(e) {
      var t = e.touches[0];
      if (!t) return;
      var rect = root.getBoundingClientRect();
      mx = t.clientX - rect.left;
      my = t.clientY - rect.top;
    }
    function onTouchEnd() { mx = -1; my = -1; }
    function onClick() { generate(); }

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    root.addEventListener('click', onClick);

    resize();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        var gridChanged = nextMerged.gridCols !== config.gridCols || nextMerged.gridRows !== config.gridRows;
        config = nextMerged;
        if (gridChanged) generate();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        root.removeEventListener('click', onClick);
        root.removeChild(canvas);
      },
    };
  });

  // --- Nake ---
  register('Nake', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;

    var config = {
      gridCols: 8,
      gridRows: 7,
      maxSubdivision: 2,
    };
    Object.assign(config, initialConfig);

    var palette = [
      '#c23b22',
      '#2d5da1',
      '#f0c75e',
      '#1a1a1a',
      '#e8e0d0',
      '#d35400',
      '#2e7d32',
      '#5c3d2e',
    ];

    function mulberry32(a) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      generate();
    }

    function generate() {
      var seed = Date.now() & 0xFFFFFF;
      var rand = mulberry32(seed);

      ctx.fillStyle = '#f0ece4';
      ctx.fillRect(0, 0, W, H);

      var margin = Math.min(W, H) * 0.08;
      var drawW = W - margin * 2;
      var drawH = H - margin * 2;
      var cols = config.gridCols;
      var rows = config.gridRows;
      var cellW = drawW / cols;
      var cellH = drawH / rows;

      function drawCell(x, y, w, h) {
        var r = rand();

        if (r < 0.35) {
          var colorIdx = Math.floor(rand() * palette.length);
          ctx.fillStyle = palette[colorIdx];
          ctx.globalAlpha = 0.6 + rand() * 0.35;
          ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
          ctx.globalAlpha = 1;
        } else if (r < 0.55) {
          var spacing = 3 + Math.floor(rand() * 5);
          ctx.strokeStyle = 'rgba(30, 25, 20, 0.4)';
          ctx.lineWidth = 0.5;
          for (var ly = y + spacing; ly < y + h; ly += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + 2, ly);
            ctx.lineTo(x + w - 2, ly);
            ctx.stroke();
          }
        } else if (r < 0.7) {
          var spacing = 4 + Math.floor(rand() * 4);
          ctx.strokeStyle = 'rgba(30, 25, 20, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          var dir = rand() > 0.5 ? 1 : -1;
          for (var d = -Math.max(w, h); d < Math.max(w, h) * 2; d += spacing) {
            ctx.beginPath();
            ctx.moveTo(x + d, y);
            ctx.lineTo(x + d + h * dir, y + h);
            ctx.stroke();
          }
          ctx.restore();
        } else if (r < 0.82) {
          var radius = Math.min(w, h) * 0.35 * (0.5 + rand() * 0.5);
          var colorIdx = Math.floor(rand() * palette.length);
          ctx.beginPath();
          ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = palette[colorIdx];
          ctx.globalAlpha = 0.5 + rand() * 0.3;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = 'rgba(30, 25, 20, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, w, h);
      }

      function subdivide(x, y, w, h, depth) {
        if (depth <= 0 || w < 15 || h < 15) {
          drawCell(x, y, w, h);
          return;
        }
        var r = rand();
        if (r < 0.4) {
          var split = 0.3 + rand() * 0.4;
          var splitX = x + w * split;
          subdivide(x, y, w * split, h, depth - 1);
          subdivide(splitX, y, w * (1 - split), h, depth - 1);
        } else if (r < 0.8) {
          var split = 0.3 + rand() * 0.4;
          var splitY = y + h * split;
          subdivide(x, y, w, h * split, depth - 1);
          subdivide(x, splitY, w, h * (1 - split), depth - 1);
        } else {
          drawCell(x, y, w, h);
        }
      }

      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var x = margin + col * cellW;
          var y = margin + row * cellH;
          var maxDepth = Math.floor(rand() * (config.maxSubdivision + 1));
          subdivide(x, y, cellW, cellH, maxDepth);
        }
      }

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, margin, drawW, drawH);
    }

    function onClick() { generate(); }

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);
    root.addEventListener('click', onClick);

    resize();

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        config = nextMerged;
        generate();
      },
      destroy: function() {
        ro.disconnect();
        root.removeEventListener('click', onClick);
        root.removeChild(canvas);
      },
    };
  });

  // --- Rössler Attractor ---
  register('Rössler Attractor', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;

    var config = {
      a: 0.2,
      b: 0.2,
      c: 5.7,
      trailLength: 60000,
      speed: 0.005,
    };
    Object.assign(config, initialConfig);

    var x = 0.1, y = 0, z = 0;
    var points = [];

    var rotY = 0, rotX = -0.3;
    var autoRotate = true;
    var dragging = false, lastMX = 0, lastMY = 0;

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resetSim() {
      x = 0.1; y = 0; z = 0;
      points = [];
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, W, H);
    }

    function step() {
      var a = config.a, b = config.b, c = config.c, dt = config.speed;
      var dx = -y - z;
      var dy = x + a * y;
      var dz = b + z * (x - c);
      x += dx * dt; y += dy * dt; z += dz * dt;
      if (Math.abs(x) > 500 || Math.abs(y) > 500 || Math.abs(z) > 500) {
        x = 0.1; y = 0; z = 0; points = [];
      }
      points.push({ x: x, y: y, z: z });
      if (points.length > config.trailLength) points.shift();
    }

    function project(px, py, pz) {
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      var rx = px * cosY - pz * sinY;
      var rz = px * sinY + pz * cosY;
      var ry = py * cosX - rz * sinX;

      var scale = Math.min(W, H) / 28;
      return { sx: W / 2 + rx * scale, sy: H / 2 + ry * scale };
    }

    function draw() {
      ctx.fillStyle = 'rgba(5,5,8,0.15)';
      ctx.fillRect(0, 0, W, H);

      if (points.length < 2) return;

      var len = points.length;
      for (var i = 1; i < len; i++) {
        var p0 = project(points[i - 1].x, points[i - 1].y, points[i - 1].z);
        var p1 = project(points[i].x, points[i].y, points[i].z);
        var age = i / len;
        var alpha = 0.15 + age * age * 0.75;
        var hue = 200 + (p1.sy / H) * 160;
        ctx.strokeStyle = 'hsla(' + hue + ',70%,' + (45 + age * 20) + '%,' + alpha + ')';
        ctx.lineWidth = 0.5 + age * 1.5;
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        ctx.lineTo(p1.sx, p1.sy);
        ctx.stroke();
      }

      var cur = project(x, y, z);
      ctx.fillStyle = '#ff6060';
      ctx.beginPath();
      ctx.arc(cur.sx, cur.sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    function loop() {
      if (autoRotate) rotY += 0.003;
      for (var i = 0; i < 8; i++) step();
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      dragging = true;
      lastMX = e.clientX; lastMY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      autoRotate = false;
    }
    function onPointerMove(e) {
      if (!dragging) return;
      rotY += (e.clientX - lastMX) * 0.005;
      rotX += (e.clientY - lastMY) * 0.005;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
      lastMX = e.clientX; lastMY = e.clientY;
    }
    function onPointerUp() { dragging = false; }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);

    resize();
    for (var i = 0; i < 30000; i++) step();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var prev = Object.assign({}, config);
        Object.assign(config, next);
        if (next.a !== undefined || next.b !== undefined || next.c !== undefined) {
          resetSim();
        }
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        root.removeChild(canvas);
      },
    };
  });

  // --- Sprott Attractor ---
  register('Sprott Attractor', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var SYSTEMS = [
      {
        name: 'Thomas',
        init: [0.1, 0, 0],
        scale: 0.22,
        fn: function(x, y, z) { return [Math.sin(y) - 0.208186 * x, Math.sin(z) - 0.208186 * y, Math.sin(x) - 0.208186 * z]; },
      },
      {
        name: 'Dadras',
        init: [1, 2, 3],
        scale: 0.18,
        fn: function(x, y, z) { return [y - 3 * x + 2.7 * y * z, 1.7 * y - x * z + z, 2 * x * y - 9 * z]; },
      },
      {
        name: 'Halvorsen',
        init: [-5, 0, 1],
        scale: 0.13,
        fn: function(x, y, z) { return [-1.4 * x - 4 * y - 4 * z - y * y, -1.4 * y - 4 * z - 4 * x - z * z, -1.4 * z - 4 * x - 4 * y - x * x]; },
      },
      {
        name: 'Sprott B',
        init: [0.1, 0.1, 0.1],
        scale: 0.42,
        fn: function(x, y, z) { return [y * z, x - y, 1 - x * y]; },
      },
      {
        name: 'Sprott C',
        init: [0.1, 0.1, 0.1],
        scale: 0.45,
        fn: function(x, y, z) { return [y * z, x - y, 1 - x * x]; },
      },
      {
        name: 'Aizawa',
        init: [0.1, 1, 0.01],
        scale: 0.85,
        fn: function(x, y, z) {
          return [
            (z - 0.7) * x - 3.5 * y,
            3.5 * x + (z - 0.7) * y,
            0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x,
          ];
        },
      },
      {
        name: 'Sprott D',
        init: [0, 0, 1],
        scale: 0.38,
        fn: function(x, y, z) { return [-y, x + z, x * z + 3 * y * y]; },
      },
      {
        name: 'Four-Wing',
        init: [1, 1, 1],
        scale: 0.5,
        fn: function(x, y, z) { return [0.2 * x + y * z, 0.01 * y - x * z, -x * y - z]; },
      },
      {
        name: 'Linz-Sprott',
        init: [0.1, 0, 0],
        scale: 0.55,
        fn: function(x, y, z) { return [y, -x + y * z, 1 - y * y]; },
      },
    ];

    function rk4(fn, x, y, z, dt) {
      var k1 = fn(x, y, z);
      var k2 = fn(x + dt / 2 * k1[0], y + dt / 2 * k1[1], z + dt / 2 * k1[2]);
      var k3 = fn(x + dt / 2 * k2[0], y + dt / 2 * k2[1], z + dt / 2 * k2[2]);
      var k4 = fn(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
      return [
        x + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        z + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
      ];
    }

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;

    var config = {
      system: 'Thomas',
      trailLength: 60000,
      autoRotate: true,
    };
    Object.assign(config, initialConfig);

    var sysIdx = -1;
    for (var si = 0; si < SYSTEMS.length; si++) {
      if (SYSTEMS[si].name === config.system) { sysIdx = si; break; }
    }
    if (sysIdx < 0) sysIdx = 0;

    var px = 0, py = 0, pz = 0;
    var trail = [];

    var rotX = 0.4, rotY = 0.3;
    var autoAngle = 0;
    var dragging = false, lastPX = 0, lastPY = 0;

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resetSystem() {
      var sys = SYSTEMS[sysIdx];
      px = sys.init[0] + (Math.random() - 0.5) * 0.001;
      py = sys.init[1] + (Math.random() - 0.5) * 0.001;
      pz = sys.init[2] + (Math.random() - 0.5) * 0.001;
      trail = [];
      var dt = 0.004;
      for (var i = 0; i < 2000; i++) {
        var result = rk4(sys.fn, px, py, pz, dt);
        px = result[0]; py = result[1]; pz = result[2];
        if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
          px = sys.init[0]; py = sys.init[1]; pz = sys.init[2];
        }
      }
    }

    function project(x, y, z) {
      var ry = config.autoRotate ? autoAngle : rotY;
      var cosY = Math.cos(ry), sinY = Math.sin(ry);
      var rx = rotX;
      var cosX = Math.cos(rx), sinX = Math.sin(rx);

      var x1 = x * cosY - z * sinY;
      var z1 = x * sinY + z * cosY;
      var y1 = y * cosX - z1 * sinX;

      var scale = SYSTEMS[sysIdx].scale * Math.min(W, H) * 0.45;
      return [W / 2 + x1 * scale, H / 2 + y1 * scale];
    }

    function frame() {
      var sys = SYSTEMS[sysIdx];
      var dt = 0.004;
      var stepsPerFrame = 4;

      ctx.fillStyle = 'rgba(8,8,16,0.05)';
      ctx.fillRect(0, 0, W, H);

      if (config.autoRotate) autoAngle += 0.003;

      for (var s = 0; s < stepsPerFrame; s++) {
        var result = rk4(sys.fn, px, py, pz, dt);
        px = result[0]; py = result[1]; pz = result[2];
        if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) { resetSystem(); return; }
        trail.push([px, py, pz]);
        if (trail.length > config.trailLength) trail.shift();
      }

      var len = trail.length;
      if (len < 2) { raf = requestAnimationFrame(frame); return; }

      for (var i = 1; i < len; i++) {
        var t = i / len;
        var hue = (200 + t * 200) % 360;
        var alpha = 0.15 + t * 0.55;
        var p0 = project(trail[i - 1][0], trail[i - 1][1], trail[i - 1][2]);
        var p1 = project(trail[i][0], trail[i][1], trail[i][2]);
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > Math.min(W, H) * 0.15) continue;
        ctx.beginPath();
        ctx.strokeStyle = 'hsla(' + hue + ',80%,65%,' + alpha + ')';
        ctx.lineWidth = 1;
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }

      var hp = project(px, py, pz);
      ctx.beginPath();
      ctx.arc(hp[0], hp[1], 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      raf = requestAnimationFrame(frame);
    }

    function onPointerDown(e) {
      dragging = true;
      lastPX = e.clientX; lastPY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      if (config.autoRotate) {
        config = Object.assign({}, config, { autoRotate: false });
        rotY = autoAngle;
      }
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var dx = e.clientX - lastPX, dy = e.clientY - lastPY;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
      lastPX = e.clientX; lastPY = e.clientY;
    }
    function onPointerUp() { dragging = false; }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);

    resize();
    resetSystem();

    var sys = SYSTEMS[sysIdx];
    var dt = 0.004;
    for (var i = 0; i < 20000; i++) {
      var result = rk4(sys.fn, px, py, pz, dt);
      px = result[0]; py = result[1]; pz = result[2];
      if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) {
        px = sys.init[0]; py = sys.init[1]; pz = sys.init[2];
      }
      trail.push([px, py, pz]);
      if (trail.length > config.trailLength) trail.shift();
    }

    raf = requestAnimationFrame(frame);

    return {
      update: function(next) {
        var systemChanged = next.system !== undefined && next.system !== config.system;
        Object.assign(config, next);
        if (systemChanged) {
          for (var si = 0; si < SYSTEMS.length; si++) {
            if (SYSTEMS[si].name === config.system) { sysIdx = si; break; }
          }
          if (sysIdx < 0) sysIdx = 0;
          resetSystem();
        }
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        root.removeChild(canvas);
      },
    };
  });

  // --- 10 PRINT ---
  register('10 PRINT', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var x = 0, y = 0;
    var raf = 0;

    var config = {
      cellSize: 22,
      lineWidth: 2,
      color: '#c0c0c0',
      bgColor: '#050b07',
    };
    Object.assign(config, initialConfig);

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetDraw();
    }

    function resetDraw() {
      x = 0;
      y = 0;
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = config.color;
      ctx.lineWidth = config.lineWidth;
      ctx.lineCap = 'square';
    }

    function loop() {
      var size = config.cellSize;
      var linesPerFrame = 6;

      for (var i = 0; i < linesPerFrame; i++) {
        if (y >= H) {
          resetDraw();
          raf = requestAnimationFrame(loop);
          return;
        }
        ctx.beginPath();
        if (Math.random() > 0.5) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + size, y + size);
        } else {
          ctx.moveTo(x + size, y);
          ctx.lineTo(x, y + size);
        }
        ctx.stroke();
        x += size;
        if (x >= W) { x = 0; y += size; }
      }
      raf = requestAnimationFrame(loop);
    }

    function onClick() { resetDraw(); }

    var ro = new ResizeObserver(function() { resize(); });
    ro.observe(root);
    root.addEventListener('click', onClick);

    resize();
    raf = requestAnimationFrame(loop);

    return {
      update: function(next) {
        var nextMerged = Object.assign({}, config, next);
        config = nextMerged;
        resetDraw();
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        root.removeEventListener('click', onClick);
        root.removeChild(canvas);
      },
    };
  });

  // --- Truchet Tiles ---
  register('Truchet Tiles', function(root, initialConfig) {
    initialConfig = initialConfig || {};

    var canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    root.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var raf = 0;
    var lastFlip = 0;

    var modeMap = { arcs: 0, triangles: 1, diagonal: 2 };
    var palMap = { monochrome: 0, earth: 1, neon: 2, forest: 3, ocean: 4 };

    var palettes = [
      ['#e8e8e8', '#1a1a2e'],
      ['#264653', '#2a9d8f', '#e9c46a'],
      ['#f72585', '#7209b7', '#3a0ca3'],
      ['#606c38', '#283618', '#dda15e'],
      ['#0077b6', '#00b4d8', '#90e0ef'],
    ];

    var config = {
      mode: 'arcs',
      tileSize: 45,
      flipInterval: 120,
      lineWidth: 0.12,
      palette: 'monochrome',
    };
    Object.assign(config, initialConfig);

    var mode = modeMap[config.mode] != null ? modeMap[config.mode] : 0;
    var palette = palettes[0];
    var tileSize = config.tileSize;
    var grid = [];

    function pickPalette() {
      var pi = palMap[config.palette];
      palette = pi != null ? palettes[pi] : palettes[Math.floor(Math.random() * palettes.length)];
    }

    function resize() {
      var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      var rect = root.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tileSize = config.tileSize > 0
        ? config.tileSize
        : Math.max(30, Math.min(60, Math.floor(Math.min(W, H) / 14)));
    }

    function generate() {
      pickPalette();
      var cols = Math.ceil(W / tileSize) + 1;
      var rows = Math.ceil(H / tileSize) + 1;
      grid = [];
      for (var r = 0; r < rows; r++) {
        var row = [];
        for (var c = 0; c < cols; c++) {
          row.push(Math.random() < 0.5 ? 0 : 1);
        }
        grid.push(row);
      }
      draw();
    }

    function drawArcTile(x, y, s, flip) {
      ctx.lineWidth = s * config.lineWidth;
      ctx.lineCap = 'round';
      ctx.strokeStyle = palette[0];
      if (flip) {
        ctx.beginPath();
        ctx.arc(x + s, y, s / 2, Math.PI * 0.5, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + s, s / 2, -Math.PI * 0.5, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0, Math.PI * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + s, y + s, s / 2, Math.PI, Math.PI * 1.5);
        ctx.stroke();
      }
    }

    function drawTriTile(x, y, s, flip) {
      var c1 = palette[0];
      var c2 = palette.length > 2 ? palette[1] : palette[0];
      if (flip) {
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath();
        ctx.fill();
      }
    }

    function drawDiagTile(x, y, s, flip) {
      ctx.lineWidth = s * config.lineWidth * 0.67;
      ctx.lineCap = 'round';
      var colors = palette.length > 2 ? palette : [palette[0], palette[0]];
      var nLines = 5;
      for (var i = 0; i <= nLines; i++) {
        var t = i / nLines;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.5 + t * 0.5;
        ctx.beginPath();
        if (flip) {
          ctx.moveTo(x + s * t, y);
          ctx.lineTo(x, y + s * t);
          if (i > 0) {
            ctx.moveTo(x + s, y + s * (1 - t));
            ctx.lineTo(x + s * (1 - t), y + s);
          }
        } else {
          ctx.moveTo(x + s * (1 - t), y);
          ctx.lineTo(x + s, y + s * t);
          if (i > 0) {
            ctx.moveTo(x, y + s * (1 - t));
            ctx.lineTo(x + s * t, y + s);
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    var drawFns = [drawArcTile, drawTriTile, drawDiagTile];

    function draw() {
      ctx.fillStyle = palette.length > 2 ? palette[2] : '#0a0a0a';
      ctx.fillRect(0, 0, W, H);
      var fn = drawFns[mode];
      for (var r = 0; r < grid.length; r++) {
        for (var c = 0; c < grid[r].length; c++) {
          fn(c * tileSize, r * tileSize, tileSize, grid[r][c] === 1);
        }
      }
    }

    function animate(t) {
      if (t - lastFlip > config.flipInterval && grid.length > 0) {
        var r = Math.floor(Math.random() * grid.length);
        var c = Math.floor(Math.random() * grid[0].length);
        grid[r][c] = 1 - grid[r][c];
        draw();
        lastFlip = t;
      }
      raf = requestAnimationFrame(animate);
    }

    var ro = new ResizeObserver(function() {
      resize();
      generate();
    });
    ro.observe(root);

    resize();
    generate();
    raf = requestAnimationFrame(animate);

    return {
      update: function(next) {
        var prev = Object.assign({}, config);
        Object.assign(config, next);
        mode = modeMap[config.mode] != null ? modeMap[config.mode] : 0;
        var sizeChanged = config.tileSize !== prev.tileSize;
        var paletteChanged = config.palette !== prev.palette;
        if (sizeChanged) {
          tileSize = config.tileSize;
          resize();
          generate();
        } else if (paletteChanged) {
          pickPalette();
          draw();
        } else if (config.mode !== prev.mode) {
          draw();
        }
      },
      destroy: function() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        root.removeChild(canvas);
      },
    };
  });

  // --- Initialize all artifact containers on the page ---
  function initArtifacts() {
    document.querySelectorAll('.artifact-native[data-artifact]').forEach(function(el) {
      var name = el.getAttribute('data-artifact');
      var config = {};
      try { config = JSON.parse(el.getAttribute('data-config') || '{}'); } catch(e) {}
      var factory = registry[name];
      if (factory) {
        try { factory(el, config); } catch(e) { console.error('Artifact init failed:', name, e); }
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArtifacts);
  } else {
    initArtifacts();
  }
})();
`;
