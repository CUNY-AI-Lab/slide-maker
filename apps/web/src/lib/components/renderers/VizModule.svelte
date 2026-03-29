<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  let {
    module,
    editable = false,
    onchange,
  }: {
    module: { id: string; type: string; data: Record<string, unknown> }
    editable?: boolean
    onchange?: (data: Record<string, unknown>) => void
  } = $props()

  // VizData shape: { viz: string, options?: Record<string,unknown> }
  let viz = $derived((module.data.viz as string) ?? 'boids')
  let canvasEl: HTMLCanvasElement | undefined = $state()
  let animId = 0
  let cleanup: (() => void) | null = null

  const VIZ_CATALOG = [
    { id: 'boids',      label: 'Boids Flocking',    icon: '⟶' },
    { id: 'life',       label: "Conway's Life",     icon: '⬡' },
    { id: 'fourier',    label: 'Fourier Epicycles', icon: '◎' },
    { id: 'nbody',      label: 'N-Body Gravity',    icon: '⊕' },
    { id: 'percolation',label: 'Percolation',       icon: '⠿' },
  ]

  function mountViz(c: HTMLCanvasElement, name: string) {
    if (cleanup) { cleanup(); cleanup = null }
    cancelAnimationFrame(animId)

    const dpr = Math.min(devicePixelRatio || 1, 2)
    const W = c.clientWidth, H = c.clientHeight
    c.width = W * dpr; c.height = H * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)

    const runners: Record<string, () => (() => void)> = {

      boids: () => {
        const N=50
        const boids = Array.from({length:N},()=>({
          x:Math.random()*W, y:Math.random()*H,
          vx:(Math.random()-.5)*2, vy:(Math.random()-.5)*2
        }))
        ctx.fillStyle='#080812';ctx.fillRect(0,0,W,H)
        const frame = () => {
          ctx.fillStyle='rgba(8,8,18,0.25)';ctx.fillRect(0,0,W,H)
          for(const b of boids){
            let ax=0,ay=0,sx=0,sy=0,cx2=0,cy2=0,cn=0
            for(const o of boids){
              const dx=o.x-b.x,dy=o.y-b.y,d=Math.sqrt(dx*dx+dy*dy)
              if(d===0||d>60) continue
              if(d<20){ax-=dx/d;ay-=dy/d}
              sx+=o.vx;sy+=o.vy;cx2+=o.x;cy2+=o.y;cn++
            }
            if(cn){b.vx+=ax*.05+(sx/cn-b.vx)*.03+(cx2/cn-b.x)*.0003
                    b.vy+=ay*.05+(sy/cn-b.vy)*.03+(cy2/cn-b.y)*.0003}
            const spd=Math.sqrt(b.vx**2+b.vy**2)
            if(spd>2.5){b.vx=b.vx/spd*2.5;b.vy=b.vy/spd*2.5}
            b.x=(b.x+b.vx+W)%W;b.y=(b.y+b.vy+H)%H
            const ang=Math.atan2(b.vy,b.vx)
            ctx.save();ctx.translate(b.x,b.y);ctx.rotate(ang)
            ctx.fillStyle='rgba(90,190,240,0.85)'
            ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,3);ctx.lineTo(-4,-3);ctx.closePath();ctx.fill()
            ctx.restore()
          }
          animId = requestAnimationFrame(frame)
        }
        frame()
        return () => cancelAnimationFrame(animId)
      },

      life: () => {
        const S=4, cols=Math.floor(W/S), rows=Math.floor(H/S)
        let g = Array.from({length:rows},()=>Array.from({length:cols},()=>Math.random()<0.3?1:0))
        const step = () => g.map((row,r)=>row.map((_,c)=>{
          let n=0
          for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
            if(!dr&&!dc) continue
            n+=g[(r+dr+rows)%rows][(c+dc+cols)%cols]
          }
          return(g[r][c]?n===2||n===3:n===3)?1:0
        }))
        const draw = () => {
          ctx.fillStyle='#07070f';ctx.fillRect(0,0,W,H)
          for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)
            if(g[r][c]){ctx.fillStyle='#6ee7b7';ctx.fillRect(c*S+.5,r*S+.5,S-1,S-1)}
          g=step()
          animId=requestAnimationFrame(draw)
        }
        draw()
        return () => cancelAnimationFrame(animId)
      },

      fourier: () => {
        const terms=12; let t=0
        const trail: {x:number,y:number}[] = []
        ctx.fillStyle='#06060f';ctx.fillRect(0,0,W,H)
        const cx2=W/2,cy2=H/2
        const draw = () => {
          ctx.fillStyle='rgba(6,6,16,0.18)';ctx.fillRect(0,0,W,H)
          let x=cx2,y=cy2
          for(let k=0;k<terms;k++){
            const n=k*2+1,rad=(H*.38)/n
            const px=x,py=y
            x+=rad*Math.cos(n*t);y+=rad*Math.sin(n*t)
            ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=.5
            ctx.beginPath();ctx.arc(px,py,rad,0,Math.PI*2);ctx.stroke()
            ctx.strokeStyle='rgba(180,180,220,0.4)';ctx.lineWidth=.8
            ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke()
          }
          trail.push({x,y});if(trail.length>400)trail.shift()
          ctx.beginPath();ctx.strokeStyle='rgba(130,220,255,0.9)';ctx.lineWidth=1.2
          for(let i=1;i<trail.length;i++){
            ctx.globalAlpha=i/trail.length
            i===1?ctx.moveTo(trail[i].x,trail[i].y):ctx.lineTo(trail[i].x,trail[i].y)
          }
          ctx.stroke();ctx.globalAlpha=1
          t+=0.04
          animId=requestAnimationFrame(draw)
        }
        draw()
        return () => cancelAnimationFrame(animId)
      },


      nbody: () => {
        const N=5, G=50
        const trail: {x:number,y:number}[][] = Array.from({length:N},()=>[])
        const bodies = Array.from({length:N},(_,i)=>{
          const a=i/N*Math.PI*2,r=H*.28
          return{x:W/2+Math.cos(a)*r,y:H/2+Math.sin(a)*r,vx:-Math.sin(a)*3.5,vy:Math.cos(a)*3.5,m:i===0?6:1}
        })
        ctx.fillStyle='#06060f';ctx.fillRect(0,0,W,H)
        const draw=()=>{
          ctx.fillStyle='rgba(6,6,18,0.2)';ctx.fillRect(0,0,W,H)
          for(let i=0;i<N;i++){
            let fx=0,fy=0
            for(let j=0;j<N;j++){if(i===j)continue
              const dx=bodies[j].x-bodies[i].x,dy=bodies[j].y-bodies[i].y
              const d=Math.sqrt(dx*dx+dy*dy)+5,f=G*bodies[j].m/(d*d)
              fx+=f*dx/d;fy+=f*dy/d
            }
            bodies[i].vx+=fx*.016;bodies[i].vy+=fy*.016
          }
          for(let i=0;i<N;i++){
            bodies[i].x+=bodies[i].vx*.016*60;bodies[i].y+=bodies[i].vy*.016*60
            trail[i].push({x:bodies[i].x,y:bodies[i].y});if(trail[i].length>120)trail[i].shift()
            ctx.beginPath();ctx.strokeStyle=`hsla(${i*72},80%,65%,0.5)`;ctx.lineWidth=1
            for(let t2=1;t2<trail[i].length;t2++){
              ctx.globalAlpha=t2/trail[i].length*.7
              t2===1?ctx.moveTo(trail[i][0].x,trail[i][0].y):ctx.lineTo(trail[i][t2].x,trail[i][t2].y)
            }
            ctx.stroke();ctx.globalAlpha=1
            ctx.fillStyle=`hsl(${i*72},80%,70%)`
            ctx.beginPath();ctx.arc(bodies[i].x,bodies[i].y,i===0?5:3,0,Math.PI*2);ctx.fill()
          }
          animId=requestAnimationFrame(draw)
        }
        draw()
        return () => cancelAnimationFrame(animId)
      },

      percolation: () => {
        const S=5, cols=Math.floor(W/S), rows=Math.floor(H/S)
        const run=()=>{
          const p=0.55+Math.random()*.08
          const grid=Array.from({length:rows},()=>Array.from({length:cols},()=>Math.random()<p))
          const vis=Array.from({length:rows},()=>new Uint8Array(cols))
          const q: [number,number][] = []
          for(let c=0;c<cols;c++)if(grid[0][c]){vis[0][c]=1;q.push([0,c])}
          while(q.length){
            const [r,c]=q.shift()!
            for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const){
              const nr=r+dr,nc=c+dc
              if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&grid[nr][nc]&&!vis[nr][nc]){vis[nr][nc]=1;q.push([nr,nc])}
            }
          }
          ctx.fillStyle='#070710';ctx.fillRect(0,0,W,H)
          for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
            if(!grid[r][c]) continue
            ctx.fillStyle=vis[r][c]?'rgba(80,200,255,0.9)':'rgba(60,60,100,0.5)'
            ctx.fillRect(c*S+.5,r*S+.5,S-1,S-1)
          }
        }
        run()
        const iv=setInterval(run,2400)
        return () => clearInterval(iv)
      },


    }

    const runner = runners[name]
    if (runner) cleanup = runner()
  }

  $effect(() => {
    if (canvasEl) mountViz(canvasEl, viz)
  })

  onDestroy(() => {
    if (cleanup) cleanup()
    cancelAnimationFrame(animId)
  })
</script>

<div class="viz-module">
  <canvas bind:this={canvasEl} class="viz-canvas"></canvas>
  {#if editable}
    <div class="viz-controls">
      <select
        class="viz-select"
        value={viz}
        onchange={(e) => onchange?.({ ...module.data, viz: (e.target as HTMLSelectElement).value })}
      >
        {#each VIZ_CATALOG as v}
          <option value={v.id}>{v.icon} {v.label}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .viz-module {
    position: relative;
    width: 100%;
    border-radius: 6px;
    overflow: hidden;
    background: #08080f;
  }

  .viz-canvas {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
  }

  .viz-controls {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 10;
  }

  .viz-select {
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.8);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    backdrop-filter: blur(4px);
  }
</style>
