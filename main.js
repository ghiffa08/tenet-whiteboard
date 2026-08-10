/* ===================================================================
   GLOBAL STATE & UTILITIES
=================================================================== */
const state = { dir: 1 };
const IS_MOBILE = window.innerWidth < 600;

function onVisible(canvas, cb) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => cb(e.isIntersecting));
  }, { threshold: 0.1 });
  io.observe(canvas);
}

function fitCanvas(canvas) {
  // Baca ukuran tampilan dari CSS. JS tidak pernah mengubah ukuran tampilan.
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  // Set resolusi gambar = ukuran tampilan (1:1). Titik. Selesai.
  // Tidak ada perkalian devicePixelRatio. Tidak ada inline style.
  // Tidak ada yang bisa membuat canvas membesar.
  canvas.width  = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  return { w, h, ctx };
}

// On mobile, NEVER listen to resize. The viewport width doesn't change
// on scroll; only the height changes when the address bar hides/shows,
// and that was causing the infinite-growth crash loop.
function onResize(fn) {
  if (!IS_MOBILE) {
    window.addEventListener('resize', fn);
  }
}

/* ===================================================================
   HERO CANVAS: a bullet on a trail, direction-aware
=================================================================== */
(function(){
  const canvas = document.getElementById('heroCanvas');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let t = 0;
  let running = true;
  let trail = [];

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#12141c';
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for(let x=0; x<w; x+=24){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }

    const midY = h/2;
    const margin = 30;
    const span = w - margin*2;

    t += 0.012 * state.dir;
    if (t > 1) t = 0;
    if (t < 0) t = 1;

    const x = margin + span * t;
    const y = midY + Math.sin(t*Math.PI*2)*18;

    trail.push({x,y});
    const trailMax = IS_MOBILE ? 20 : 40;
    if (trail.length > trailMax) trail.shift();

    const col = state.dir === 1 ? '#e0655c' : '#5b8ce8';
    trail.forEach((p,i)=>{
      const a = i/trail.length;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2*a, 0, Math.PI*2);
      ctx.globalAlpha = a*0.6;
      ctx.fillStyle = col;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(x,y,4.5,0,Math.PI*2);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = w < 600 ? 0 : 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });

  const readout = document.getElementById('heroReadout');
  const btns = document.querySelectorAll('#heroToggle button');
  btns.forEach(b=>{
    b.addEventListener('click', ()=>{
      state.dir = b.dataset.dir === 'fwd' ? 1 : -1;
      btns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      readout.textContent = state.dir === 1
        ? 'ENTROPI: MENYEBAR ATAU NAIK'
        : 'ENTROPI: TERBALIK ATAU TURUN';
    });
  });
})();

/* ===================================================================
   PERCOBAAN 1: Kotak Gas (diffusion + live entropy gauge)
=================================================================== */
(function(){
  const canvas = document.getElementById('gasBoxCanvas');
  const fill = document.getElementById('gasEntropyFill');
  const val = document.getElementById('gasEntropyVal');
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); makeParticles(); });

  let wallOpen = false;
  let running = true;
  let particles = [];

  function makeParticles(){
    particles = [];
    const n = IS_MOBILE ? 20 : 40;
    const leftW = w*0.46;
    for(let i=0;i<n;i++){
      particles.push({
        x: 10 + Math.random()*(leftW-20),
        y: 20 + Math.random()*(h-40),
        vx: (Math.random()-0.5)*1.6,
        vy: (Math.random()-0.5)*1.6,
        r: 2.6
      });
    }
  }
  makeParticles();

  function entropyEstimate(){
    // fraction of particles that made it past the midline = spread measure
    const rightCount = particles.filter(p=>p.x > w/2).length;
    const frac = rightCount / particles.length; // 0 = all left, 0.5 = fully mixed
    return Math.min(1, frac / 0.5) * 100;
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0,0,w,h);

    const wallX = w/2;
    if(!wallOpen){
      ctx.strokeStyle = '#c7cbdb';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(wallX, 8); ctx.lineTo(wallX, h-8); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(199,203,219,0.15)';
      ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(wallX, 8); ctx.lineTo(wallX, h-8); ctx.stroke();
      ctx.setLineDash([]);
    }

    particles.forEach(p=>{
      p.x += p.vx;
      p.y += p.vy;

      if(p.y < p.r || p.y > h-p.r) p.vy *= -1;
      if(p.x < p.r) p.vx *= -1;
      if(p.x > w-p.r) p.vx *= -1;

      if(!wallOpen){
        const leftBound = wallX - p.r - 2;
        if(p.x > leftBound){ p.x = leftBound; p.vx *= -1; }
      }

      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = p.x < wallX ? '#e0655c' : '#5b8ce8';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const e = entropyEstimate();
    fill.style.width = e.toFixed(0) + '%';
    val.textContent = e.toFixed(0) + '%';

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });

  document.getElementById('btnOpenWall').addEventListener('click', ()=>{ wallOpen = true; });
  document.getElementById('btnResetWall').addEventListener('click', ()=>{ wallOpen = false; makeParticles(); });
})();

/* ===================================================================
   PERCOBAAN 2: Dua Balok Suhu
=================================================================== */
(function(){
  const canvas = document.getElementById('heatCanvas');
  const slider = document.getElementById('heatSlider');
  const valLabel = document.getElementById('heatVal');
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  let playing = false;
  let playTimer = null;

  function lerp(a,b,t){ return a+(b-a)*t; }
  function colorForTemp(t){
    // t: 0 (cold blue) .. 1 (hot red)
    const r = Math.round(lerp(91,224,t));
    const g = Math.round(lerp(140,101,t));
    const b = Math.round(lerp(232,92,t));
    return `rgb(${r},${g},${b})`;
  }

  function draw(){
    const p = slider.value/100;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0,0,w,h);

    const blockW = w*0.30, blockH = h*0.5, gap = w*0.20;
    const y = h/2 - blockH/2;
    const leftX = w/2 - gap/2 - blockW;
    const rightX = w/2 + gap/2;

    // temps converge toward 0.5 as p -> 1
    const hotTemp = lerp(0.92, 0.5, p);
    const coldTemp = lerp(0.08, 0.5, p);

    ctx.fillStyle = colorForTemp(hotTemp);
    ctx.fillRect(leftX, y, blockW, blockH);
    ctx.fillStyle = colorForTemp(coldTemp);
    ctx.fillRect(rightX, y, blockW, blockH);

    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f1117';
    ctx.fillText(Math.round(20 + hotTemp*80) + '°', leftX+blockW/2, y+blockH/2+4);
    ctx.fillText(Math.round(20 + coldTemp*80) + '°', rightX+blockW/2, y+blockH/2+4);

    ctx.fillStyle = '#8a90a6';
    ctx.fillText('PANAS', leftX+blockW/2, y-10);
    ctx.fillText('DINGIN', rightX+blockW/2, y-10);

    if(p>0.02 && p<0.98){
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(leftX+blockW+4, h/2);
      ctx.lineTo(rightX-4, h/2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('kalor mengalir →', w/2, h/2-8);
    }
    if(p>=0.98){
      ctx.fillStyle = '#3d7a4f';
      ctx.fillText('kesetimbangan tercapai', w/2, h-10);
    }
    ctx.textAlign = 'left';
    valLabel.textContent = Math.round(p*100) + '%';
  }
  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();

  document.getElementById('btnHeatPlay').addEventListener('click', (e)=>{
    if(playing){
      clearInterval(playTimer); playing = false; e.target.textContent = '▶ Jalankan Otomatis';
      return;
    }
    playing = true; e.target.textContent = '⏸ Jeda';
    playTimer = setInterval(()=>{
      let v = parseInt(slider.value,10) + 2;
      if(v>=100){ v=100; clearInterval(playTimer); playing=false; document.getElementById('btnHeatPlay').textContent='▶ Jalankan Otomatis'; }
      slider.value = v; draw();
    }, 60);
  });
  document.getElementById('btnHeatReset').addEventListener('click', ()=>{
    clearInterval(playTimer); playing = false;
    document.getElementById('btnHeatPlay').textContent = '▶ Jalankan Otomatis';
    slider.value = 0; draw();
  });
})();

/* ===================================================================
   PERCOBAAN 3: Kocok Kartu
=================================================================== */
(function(){
  const canvas = document.getElementById('cardCanvas');
  const comboLabel = document.getElementById('cardCombo');
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  const N = 16;
  const hues = Array.from({length:N}, (_,i)=> Math.round(i*(360/N)));
  let order = hues.map((_,i)=>i);
  let shuffleCount = 0;

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0,0,w,h);

    const cols = 8, rows = 2;
    const pad = 10;
    const cw = (w - pad*(cols+1))/cols;
    const ch = (h - pad*(rows+1))/rows;

    order.forEach((idx,i)=>{
      const cx = i % cols, cy = Math.floor(i/cols);
      const x = pad + cx*(cw+pad);
      const y = pad + cy*(ch+pad);
      ctx.fillStyle = `hsl(${hues[idx]},65%,55%)`;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x,y,cw,ch,6) : ctx.rect(x,y,cw,ch);
      ctx.fill();
    });
  }
  onVisible(canvas, ()=>{ draw(); });
  draw();

  document.getElementById('btnShuffle').addEventListener('click', ()=>{
    for(let i=order.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [order[i],order[j]] = [order[j],order[i]];
    }
    shuffleCount++;
    draw();
    comboLabel.textContent = 'Kocokan ke-' + shuffleCount + ' dari 20.922.789.888.000 kemungkinan susunan';
  });
  document.getElementById('btnSort').addEventListener('click', ()=>{
    order = hues.map((_,i)=>i);
    shuffleCount = 0;
    draw();
    comboLabel.textContent = 'Susunan rapi: 1 dari 20.922.789.888.000 kemungkinan';
  });
})();

/* ===================================================================
   SCENE 1: Entropy particle diagram (tap to flip, sliders to tune)
=================================================================== */
(function(){
  const canvas = document.getElementById('entropyCanvas');
  const stateLabel = document.getElementById('entropyState');
  const countSlider = document.getElementById('entCountSlider');
  const countVal = document.getElementById('entCountVal');
  const speedSlider = document.getElementById('entSpeedSlider');
  const speedVal = document.getElementById('entSpeedVal');
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); makeParticles(); });

  let inverted = false;
  let running = true;
  const cx = ()=> w/2, cy = ()=> h/2;

  let particles = [];
  function makeParticles(){
    particles = [];
    const n = parseInt(countSlider.value,10);
    for(let i=0;i<n;i++){
      const angle = Math.random()*Math.PI*2;
      const dist = 20 + Math.random()* (Math.min(w,h)/2 - 20);
      particles.push({
        angle, dist,
        p: Math.random(),
        speed: 0.004 + Math.random()*0.006,
        size: 1.4 + Math.random()*2.2
      });
    }
  }
  makeParticles();

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0,0,w,h);

    ctx.beginPath();
    ctx.arc(cx(),cy(),3,0,Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    const speedMul = parseInt(speedSlider.value,10)/100;

    particles.forEach(pt=>{
      const step = pt.speed * speedMul;
      if(!inverted){
        pt.p += step;
        if (pt.p > 1){ pt.p = 0; }
      } else {
        pt.p -= step*1.6;
        if (pt.p < 0){ pt.p = 1; }
      }
      const r = pt.p * pt.dist;
      const x = cx() + Math.cos(pt.angle)*r;
      const y = cy() + Math.sin(pt.angle)*r;
      ctx.beginPath();
      ctx.arc(x,y,pt.size,0,Math.PI*2);
      ctx.fillStyle = inverted ? '#5b8ce8' : '#e0655c';
      ctx.globalAlpha = 0.4 + pt.p*0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });

  canvas.parentElement.style.cursor = 'pointer';
  canvas.addEventListener('click', ()=>{
    inverted = !inverted;
    stateLabel.textContent = inverted
      ? 'MODE: TERBALIK, partikel mengumpul'
      : 'MODE: NORMAL, partikel menyebar';
  });

  countSlider.addEventListener('input', ()=>{
    countVal.textContent = countSlider.value;
    makeParticles();
  });
  speedSlider.addEventListener('input', ()=>{
    speedVal.textContent = speedSlider.value + '%';
  });
})();

/* ===================================================================
   SCENE 2: Turnstile, two figures passing through a gate
=================================================================== */
(function(){
  const canvas = document.getElementById('turnstileCanvas');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let running = true;
  let t1 = 0.1, t2 = 0.9;

  function drawFigure(x,y,col,facing){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(facing,1);
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,-20,6,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(0,8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-10,2); ctx.moveTo(0,-6); ctx.lineTo(10,-10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(-8,22); ctx.moveTo(0,8); ctx.lineTo(8,22); ctx.stroke();
    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const gateX = w/2;
    const gateW = 26, gateH = h*0.62;
    const gateY = h/2 - gateH/2;

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(gateX-gateW/2, gateY, gateW, gateH);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(gateX-gateW/2, gateY, gateW, gateH);
    for(let i=1;i<5;i++){
      const yy = gateY + gateH*i/5;
      ctx.beginPath(); ctx.moveTo(gateX-gateW/2, yy); ctx.lineTo(gateX+gateW/2, yy);
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.stroke();
    }

    t1 += 0.006; if (t1>1.15) t1 = -0.15;
    t2 -= 0.006; if (t2<-0.15) t2 = 1.15;

    const margin = 26;
    const span = w - margin*2;
    const x1 = margin + span*t1;
    const x2 = margin + span*t2;

    drawFigure(x1, h/2+18, '#e0655c', 1);
    drawFigure(x2, h/2+18, '#5b8ce8', -1);

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#8a90a6';
    ctx.textAlign='center';
    ctx.fillText('NORMAL →', gateX - gateW/2 - 34, h-10);
    ctx.fillText('← TERBALIK', gateX + gateW/2 + 34, h-10);
    ctx.textAlign='left';

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });
})();

/* ===================================================================
   SCENE 3: Temporal pincer, two convoys converge from opposite time
=================================================================== */
(function(){
  const canvas = document.getElementById('pincerCanvas');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let running = true;
  let p = 0;

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const midY = h*0.58;
    const margin = 30;
    const targetX = w/2;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(margin, midY); ctx.lineTo(w-margin, midY); ctx.stroke();

    ctx.beginPath();
    ctx.arc(targetX, midY, 5, 0, Math.PI*2);
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#f2c14e'; ctx.textAlign='center';
    ctx.fillText('TARGET', targetX, midY-14);

    p += 0.008;
    const cycle = p % 1;
    const ease = cycle < 0.85 ? cycle/0.85 : 1;

    const redX = margin + (targetX-margin)*ease;
    const blueX = (w-margin) - ((w-margin)-targetX)*ease;

    ctx.fillStyle = '#e0655c';
    ctx.beginPath(); ctx.moveTo(redX-8,midY+16); ctx.lineTo(redX+8,midY+16); ctx.lineTo(redX,midY+4); ctx.closePath(); ctx.fill();
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle='#e0655c';
    ctx.fillText('TIM MERAH · MAJU', redX, midY+30);

    ctx.fillStyle = '#5b8ce8';
    ctx.beginPath(); ctx.moveTo(blueX-8,midY-16); ctx.lineTo(blueX+8,midY-16); ctx.lineTo(blueX,midY-4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#5b8ce8';
    ctx.fillText('TIM BIRU · MUNDUR', blueX, midY-24);

    ctx.textAlign='left';

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });
})();

/* ===================================================================
   SCENE 4: Causal loop, closed circle (Novikov) vs crossed-out branch
=================================================================== */
(function(){
  const canvas = document.getElementById('loopCanvas');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let running = true;
  let angle = 0;

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const lx = w*0.27, ly = h*0.42;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(lx-34, ly+30); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx+34, ly-26); ctx.stroke();
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx-6, ly-34); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#e0655c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(lx-9,ly-9); ctx.lineTo(lx+9,ly+9); ctx.moveTo(lx+9,ly-9); ctx.lineTo(lx-9,ly+9); ctx.stroke();
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8a90a6'; ctx.textAlign='center';
    ctx.fillText('paradoks: cabang baru', lx, ly+52);

    const rx = w*0.72, ry = h*0.42, rad = Math.min(w,h)*0.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(rx,ry,rad,0,Math.PI*2); ctx.stroke();

    angle += 0.018;
    const redX = rx + Math.cos(angle)*rad;
    const redY = ry + Math.sin(angle)*rad;
    const blueX = rx + Math.cos(angle+Math.PI)*rad;
    const blueY = ry + Math.sin(angle+Math.PI)*rad;

    ctx.beginPath(); ctx.moveTo(redX,redY); ctx.lineTo(blueX,blueY);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath(); ctx.arc(redX,redY,5,0,Math.PI*2); ctx.fillStyle='#e0655c'; ctx.fill();
    ctx.beginPath(); ctx.arc(blueX,blueY,5,0,Math.PI*2); ctx.fillStyle='#5b8ce8'; ctx.fill();

    ctx.fillStyle = '#8a90a6';
    ctx.fillText('Tenet: satu garis waktu', rx, ry+rad+28);

    ctx.textAlign='left';

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });
})();

/* ===================================================================
   SCENE 5: Timeline Flow (Alur Waktu)
=================================================================== */
(function(){
  const canvas = document.getElementById('timelineCanvas');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let running = true;
  let p = 0;

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const margin = 20;
    const spanX = w - margin*2;
    
    const events = [
      { name: 'Opera', x: margin + spanX*0.1 },
      { name: 'Oslo', x: margin + spanX*0.35 },
      { name: 'Tallinn', x: margin + spanX*0.65 },
      { name: 'Stalsk-12', x: margin + spanX*0.9 }
    ];

    const yAxis = h/2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(margin, yAxis); ctx.lineTo(w-margin, yAxis); ctx.stroke();
    
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    events.forEach(ev => {
      ctx.beginPath(); ctx.arc(ev.x, yAxis, 3, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
      ctx.fillStyle = '#8a90a6'; ctx.fillText(ev.name, ev.x, yAxis + 24);
    });

    p += 0.0025;
    if (p > 1) p = 0;

    // Protagonist (Red)
    ctx.strokeStyle = 'rgba(224, 101, 92, 0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(margin, yAxis - 15); ctx.lineTo(events[3].x + 20, yAxis - 15); ctx.stroke();

    const protagX = margin + (events[3].x + 20 - margin) * p;
    ctx.beginPath(); ctx.arc(protagX, yAxis - 15, 5, 0, Math.PI*2); ctx.fillStyle = '#e0655c'; 
    ctx.shadowColor='#e0655c'; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0;

    // Neil (Blue)
    ctx.strokeStyle = 'rgba(91, 140, 232, 0.4)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w-margin, yAxis + 15);
    ctx.lineTo(events[2].x, yAxis + 15); 
    ctx.arc(events[2].x, yAxis, 15, Math.PI/2, Math.PI*1.5);
    ctx.lineTo(events[3].x, yAxis - 15);
    ctx.arc(events[3].x, yAxis, 15, -Math.PI/2, Math.PI/2);
    ctx.lineTo(events[0].x, yAxis + 15);
    ctx.stroke();

    let neilX, neilY;
    if (p < 0.3) {
      const localP = p / 0.3;
      neilX = (w-margin) - ((w-margin) - events[2].x) * localP;
      neilY = yAxis + 15;
    } else if (p < 0.4) {
      const localP = (p - 0.3) / 0.1;
      const angle = Math.PI/2 + Math.PI * localP;
      neilX = events[2].x + Math.cos(angle)*15;
      neilY = yAxis + Math.sin(angle)*15;
    } else if (p < 0.7) {
      const localP = (p - 0.4) / 0.3;
      neilX = events[2].x + (events[3].x - events[2].x) * localP;
      neilY = yAxis - 15;
    } else if (p < 0.8) {
      const localP = (p - 0.7) / 0.1;
      const angle = -Math.PI/2 + Math.PI * localP;
      neilX = events[3].x + Math.cos(angle)*15;
      neilY = yAxis + Math.sin(angle)*15;
    } else {
      const localP = (p - 0.8) / 0.2;
      neilX = events[3].x - (events[3].x - events[0].x) * localP;
      neilY = yAxis + 15;
    }

    ctx.beginPath(); ctx.arc(neilX, neilY, 5, 0, Math.PI*2); ctx.fillStyle = '#5b8ce8'; 
    ctx.shadowColor='#5b8ce8'; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0;

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });
})();

/* ===================================================================
   SCENE 5B: Stalsk-12 10-Minute Pincer Interactive Slider
=================================================================== */
(function(){
  const canvas = document.getElementById('stalskCanvas');
  const slider = document.getElementById('stalskSlider');
  const timeVal = document.getElementById('stalskVal');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function draw(){
    const p = slider.value / 100; // 0 to 1
    const totalSeconds = p * 600; // 10 minutes = 600s
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    timeVal.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const margin = 30;
    const trackW = w - margin*2;
    const yRed = h*0.35;
    const yBlue = h*0.65;

    // Draw static timelines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(margin, yRed); ctx.lineTo(w-margin, yRed); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, yBlue); ctx.lineTo(w-margin, yBlue); ctx.stroke();

    // Time markings
    ctx.fillStyle = '#8a90a6'; ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0 Menit', margin, h*0.5 + 4);
    ctx.fillText('5 Menit', margin + trackW*0.5, h*0.5 + 4);
    ctx.fillText('10 Menit', w-margin, h*0.5 + 4);
    
    // Vertical grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(margin, yRed-20); ctx.lineTo(margin, yBlue+20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin + trackW*0.5, yRed-20); ctx.lineTo(margin + trackW*0.5, yBlue+20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w-margin, yRed-20); ctx.lineTo(w-margin, yBlue+20); ctx.stroke();

    // Center explosion marker
    ctx.beginPath(); ctx.arc(margin + trackW*0.5, h*0.5, 6, 0, Math.PI*2);
    ctx.fillStyle = p > 0.48 && p < 0.52 ? '#f2c14e' : 'rgba(255,255,255,0.1)';
    if(p > 0.48 && p < 0.52) {
       ctx.shadowColor='#f2c14e'; ctx.shadowBlur=12; 
    }
    ctx.fill(); ctx.shadowBlur=0;
    if(p > 0.48 && p < 0.52) {
      ctx.fillStyle = '#f2c14e';
      ctx.fillText('LEDAKAN GANDA', margin + trackW*0.5, h*0.5 - 12);
    }

    // Red Team Progress (moves left to right)
    const redX = margin + trackW * p;
    ctx.strokeStyle = 'rgba(224, 101, 92, 0.4)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(margin, yRed); ctx.lineTo(redX, yRed); ctx.stroke();
    
    ctx.beginPath(); ctx.arc(redX, yRed, 6, 0, Math.PI*2);
    ctx.fillStyle = '#e0655c'; ctx.fill();
    ctx.fillText('MERAH (MAJU)', Math.min(Math.max(redX, margin+40), w-margin-40), yRed - 15);

    // Blue Team Progress (moves right to left)
    const blueX = w - margin - trackW * p;
    ctx.strokeStyle = 'rgba(91, 140, 232, 0.4)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(w-margin, yBlue); ctx.lineTo(blueX, yBlue); ctx.stroke();
    
    ctx.beginPath(); ctx.arc(blueX, yBlue, 6, 0, Math.PI*2);
    ctx.fillStyle = '#5b8ce8'; ctx.fill();
    ctx.fillText('BIRU (MUNDUR)', Math.min(Math.max(blueX, margin+45), w-margin-45), yBlue + 22);
    
    // Connect them with a sync line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(redX, yRed); ctx.lineTo(blueX, yBlue); ctx.stroke();
    ctx.setLineDash([]);
  }

  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();

/* ===================================================================
   SCENE 1B: Inverted Bullet Catching
=================================================================== */
(function(){
  const canvas = document.getElementById('bulletCanvas');
  const slider = document.getElementById('bulletSlider');
  const valText = document.getElementById('bulletVal');
  const caption = document.getElementById('bulletCaption');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function draw(){
    const p = slider.value / 100;
    valText.textContent = slider.value + '%';
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const gunX = w - 60;
    const wallX = 50;
    const y = h/2;

    // Wall
    ctx.fillStyle = '#33353f'; ctx.fillRect(10, y-40, 40, 80);
    // Bullet hole / crack
    ctx.strokeStyle = '#1c1f29'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(wallX, y); ctx.lineTo(wallX-15, y-15); ctx.moveTo(wallX, y); ctx.lineTo(wallX-12, y+18); ctx.stroke();

    // Gun
    ctx.fillStyle = '#5b5d68'; 
    ctx.fillRect(gunX, y-5, 40, 12); // barrel
    ctx.fillRect(gunX+25, y-5, 12, 35); // handle

    // Bullet (moves from wall to gun as p goes 0 -> 1)
    const bulletX = wallX + (gunX - wallX) * p;
    ctx.fillStyle = '#5b8ce8';
    ctx.beginPath();
    ctx.arc(bulletX, y, 5, 0, Math.PI*2);
    ctx.fill();
    // Motion trail
    if(p > 0.05 && p < 0.95) {
       ctx.strokeStyle = 'rgba(91, 140, 232, 0.5)'; ctx.lineWidth=2.5;
       ctx.beginPath(); ctx.moveTo(bulletX+5, y); ctx.lineTo(bulletX+25, y); ctx.stroke();
    }

    if(p === 0) {
      caption.textContent = 'Status Kuantum: Peluru tertanam di medium pembatas (Dinding)';
    } else if (p < 1) {
      caption.textContent = 'Trajektori Terbalik: Peluru tertarik kembali menelusuri vektor angin';
    } else {
      caption.textContent = 'Eksekusi: Peluru terkunci di dalam laras. Tangan terhentak mundurnya pelatuk.';
    }
  }
  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();

/* ===================================================================
   SCENE 2B: Proving Window Mirror
=================================================================== */
(function(){
  const canvas = document.getElementById('mirrorCanvas');
  const slider = document.getElementById('mirrorSlider');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function drawFigure(x,y,col,facing){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(facing,1);
    ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,-20,6,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(0,8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(-10,2); ctx.moveTo(0,-6); ctx.lineTo(10,-10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(-8,22); ctx.moveTo(0,8); ctx.lineTo(8,22); ctx.stroke();
    ctx.restore();
  }

  function draw(){
    const p = slider.value / 100;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const midX = w/2;
    const y = h/2 + 10;
    
    // Proving window glass
    ctx.fillStyle = 'rgba(198, 214, 245, 0.08)';
    ctx.fillRect(midX - 3, 20, 6, h-40);
    ctx.strokeStyle = 'rgba(198, 214, 245, 0.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(midX - 3, 20, 6, h-40);

    // Corridor ground
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(0, y+22); ctx.lineTo(w, y+22); ctx.stroke();

    // Protagonist (Red)
    const protagX = 30 + (midX - 30) * p;
    drawFigure(protagX, y, '#e0655c', 1);

    // Inverted Protagonist (Blue)
    const invX = w - 30 - (w/2 - 30) * p;
    drawFigure(invX, y, '#5b8ce8', -1);

    // Annihilation / Merge Effect when touching the turnstile
    if(p > 0.96) {
      ctx.beginPath();
      ctx.arc(midX, y-5, 30, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }
  }
  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();

/* ===================================================================
   SCENE 3B: Inverted Car Thermodynamics
=================================================================== */
(function(){
  const canvas = document.getElementById('carPhysicsCanvas');
  const btn = document.getElementById('btnExplode');
  const stateLabel = document.getElementById('carState');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); });

  let exploded = false;
  let particles = [];
  let running = true;

  function initParticles() {
    particles = [];
    for(let i=0; i<80; i++){
       particles.push({
         x: w/2 + (Math.random()-0.5)*90,
         y: h/2 + (Math.random()-0.5)*50,
         vx: (Math.random()-0.5)*1.5,
         vy: (Math.random()-0.5)*1.5 - 0.5,
         life: Math.random()
       });
    }
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    // Road
    ctx.fillStyle = '#1c1f29'; ctx.fillRect(0, h/2+15, w, 40);

    // Car (Simple Box)
    const carX = w/2 - 35;
    const carY = h/2 - 10;
    ctx.fillStyle = '#5b5d68'; ctx.fillRect(carX, carY, 70, 25);
    ctx.fillStyle = '#a0a3b0'; ctx.fillRect(carX+15, carY-15, 35, 15); // roof
    
    // Wheels
    ctx.fillStyle = '#111'; 
    ctx.beginPath(); ctx.arc(carX+15, carY+25, 9, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(carX+55, carY+25, 9, 0, Math.PI*2); ctx.fill();

    if(exploded) {
       // Draw ice crystals forming
       particles.forEach(p => {
          p.x += p.vx; p.y += p.vy; p.life -= 0.015;
          if(p.life < 0) {
             p.x = w/2 + (Math.random()-0.5)*90;
             p.y = h/2 + (Math.random()-0.5)*50;
             p.life = 1;
          }
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+4, p.y+6); ctx.lineTo(p.x-4, p.y+6); ctx.closePath();
          ctx.fillStyle = `rgba(198, 214, 245, ${p.life})`; // Ice blue
          ctx.fill();
       });
       
       // Ice crust on car
       ctx.fillStyle = 'rgba(198, 214, 245, 0.45)';
       ctx.fillRect(carX-8, carY-18, 86, 50);
    }

    if (running) requestAnimationFrame(draw);
  }
  onVisible(canvas, v=>{ running = v; if(v) requestAnimationFrame(draw); });

  btn.addEventListener('click', ()=>{
     exploded = !exploded;
     if(exploded) {
       btn.textContent = 'Kembalikan Kondisi Awal';
       btn.classList.replace('blue', 'active');
       stateLabel.innerHTML = '<span style="color:#c6d6f5;">Radiasi endotermik! Lapisan es terbentuk secara termodinamis.</span>';
       initParticles();
     } else {
       btn.textContent = 'Simulasikan Perpindahan Kalor Terbalik';
       btn.classList.replace('active', 'blue');
       stateLabel.textContent = 'Mobil melaju dalam suhu ekuilibrium';
     }
  });
})();

/* ===================================================================
   SCENE 4B: Stalsk-12 Gate & Neil's Causal Loop
=================================================================== */
(function(){
  const canvas = document.getElementById('gateCanvas');
  const slider = document.getElementById('gateSlider');
  const caption = document.getElementById('gateCaption');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function draw(){
    const p = slider.value / 100;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const gateX = w/2;
    const yFloor = h/2 + 20;

    // Floor
    ctx.strokeStyle = '#33353f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, yFloor); ctx.lineTo(w, yFloor); ctx.stroke();

    // Gate
    ctx.strokeStyle = p > 0.4 && p < 0.8 ? '#3d7a4f' : '#e0655c'; // Green if open
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(gateX, yFloor); ctx.lineTo(gateX, yFloor - 60); ctx.stroke();
    
    // Volkov (Right side)
    ctx.fillStyle = '#e0655c';
    ctx.fillRect(w - 50, yFloor - 45, 20, 45);
    ctx.font = '9px "IBM Plex Mono", monospace'; ctx.textAlign='center';
    ctx.fillText('Musuh', w - 40, yFloor - 52);

    // Neil (Blue)
    ctx.fillStyle = '#5b8ce8';
    
    if(p < 0.2) {
       // Dead on the floor
       caption.innerHTML = '<span style="color:#e0655c;">T=0 (Merah): Mayat Neil membujur kaku menghalangi akses</span>';
       ctx.fillRect(gateX - 55, yFloor - 12, 45, 12); 
    } else if (p < 0.4) {
       // Rising up, catching bullet
       caption.innerHTML = '<span style="color:#e0655c;">T=1 (Merah): Mayat merekonstruksi diri, menyerap energi balistik</span>';
       ctx.fillRect(gateX - 30, yFloor - 35, 18, 35); 
       // Bullet flying right to Volkov's gun
       const bx = (gateX - 12) + (w - 50 - (gateX - 12)) * ((p-0.2)/0.2);
       ctx.beginPath(); ctx.arc(bx, yFloor - 25, 4, 0, Math.PI*2); ctx.fillStyle='#f2c14e'; ctx.fill();
    } else if (p < 0.7) {
       // Unlocking gate
       caption.innerHTML = '<span style="color:#e0655c;">T=2 (Merah): Entitas biru memutar mekanika gembok membuka gerbang</span>';
       ctx.fillRect(gateX - 25, yFloor - 45, 18, 45); 
       ctx.beginPath(); ctx.moveTo(gateX-7, yFloor-35); ctx.lineTo(gateX+5, yFloor-45); ctx.strokeStyle='#5b8ce8'; ctx.stroke(); 
    } else {
       // Running backwards away
       caption.innerHTML = '<span style="color:#e0655c;">T=3 (Merah): Entitas berlari mundur menjauh. Gerbang kembali terkunci otomatis.</span>';
       const runX = (gateX - 25) - ((gateX - 25) - 20) * ((p-0.7)/0.3);
       ctx.fillRect(runX, yFloor - 45, 18, 45);
    }
  }

  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();

/* ===================================================================
   SCENE 6: Dead Drops & Information Paradox
=================================================================== */
(function(){
  const canvas = document.getElementById('capsuleCanvas');
  const slider = document.getElementById('capsuleSlider');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function draw(){
    const p = slider.value / 100;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const margin = 30;
    const trackW = w - margin*2;
    const ySurface = h/2 - 20;
    const yUnderground = h/2 + 25;

    // Surface line
    ctx.strokeStyle = '#33353f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(margin, ySurface); ctx.lineTo(w-margin, ySurface); ctx.stroke();

    // Time Axis Text
    ctx.fillStyle = '#8a90a6'; ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Masa Kini (Sator)', margin + 40, ySurface - 20);
    ctx.fillText('Masa Depan (+300 thn)', w - margin - 40, ySurface - 20);

    // Current Time Marker (Scanner Line)
    const currentX = margin + trackW * p;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([3,3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(currentX, 20); ctx.lineTo(currentX, h-10); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('WAKTU', currentX, 15);

    // Timeline Path (Capsule moving forward)
    ctx.strokeStyle = 'rgba(224, 101, 92, 0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(margin + 50, yUnderground - 6); ctx.lineTo(w - margin - 50, yUnderground - 6); ctx.stroke();
    // Timeline Path (Gold moving backward)
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w - margin - 50, yUnderground + 10); ctx.lineTo(margin + 50, yUnderground + 10); ctx.stroke();

    // Capsule Box
    ctx.fillStyle = '#e0655c'; 
    if (p > 0.05) {
       ctx.fillRect(Math.min(currentX, w - margin - 55), yUnderground - 12, 14, 10);
    }
    
    // Inverted Gold Box
    ctx.fillStyle = '#f2c14e';
    if (p < 0.95) {
       ctx.fillRect(Math.max(currentX, margin + 45), yUnderground + 4, 14, 10);
    }

    // Digging markers
    if (p < 0.1) {
       ctx.fillStyle = '#e0655c'; ctx.fillText('↓ Kubur Kapsul', margin + 50, ySurface - 5);
       ctx.fillStyle = '#f2c14e'; ctx.fillText('↑ Gali Emas', margin + 50, ySurface + 65);
    } else if (p > 0.9) {
       ctx.fillStyle = '#e0655c'; ctx.fillText('↑ Gali Kapsul', w - margin - 50, ySurface - 5);
       ctx.fillStyle = '#f2c14e'; ctx.fillText('↓ Kubur Emas (Terbalik)', w - margin - 50, ySurface + 65);
    }
  }

  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();

/* ===================================================================
   SCENE 7: Biomechanics of a punch
=================================================================== */
(function(){
  const canvas = document.getElementById('punchCanvas');
  const slider = document.getElementById('punchSlider');
  const caption = document.getElementById('punchCaption');
  if(!canvas) return;
  let { w, h, ctx } = fitCanvas(canvas);
  onResize(()=>{ ({w,h,ctx} = fitCanvas(canvas)); draw(); });

  function draw(){
    const p = slider.value / 100;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = '#0f1117'; ctx.fillRect(0,0,w,h);

    const y = h/2;
    const leftX = w/2 - 60;
    const rightX = w/2 + 60;

    // Protagonist (Red) Arm
    let redX = leftX;
    if(p > 0.2 && p < 0.5) {
       redX = leftX + (w/2 - leftX) * ((p-0.2)/0.3);
    } else if (p >= 0.5 && p < 0.8) {
       redX = w/2 - (w/2 - leftX) * ((p-0.5)/0.3);
    } else if (p >= 0.8) {
       redX = leftX;
    }

    // Inverted Protagonist (Blue) Face/Body
    let blueX = rightX;
    if(p < 0.2) {
       blueX = rightX + 25 - (25) * (p/0.2); 
    } else if (p >= 0.2 && p < 0.5) {
       blueX = rightX - (rightX - w/2) * ((p-0.2)/0.3);
    } else if (p >= 0.5 && p < 0.8) {
       blueX = w/2 + (rightX + 25 - w/2) * ((p-0.5)/0.3);
    } else if (p >= 0.8) {
       blueX = rightX + 25;
    }

    // Draw Blue body
    ctx.fillStyle = '#5b8ce8';
    ctx.fillRect(blueX, y-20, 20, 40); // head/body
    ctx.beginPath(); ctx.moveTo(blueX+10, y+20); ctx.lineTo(blueX+10, y+40); ctx.strokeStyle='#5b8ce8'; ctx.lineWidth=4; ctx.stroke(); // body
    
    // Draw Red Arm
    ctx.fillStyle = '#e0655c';
    ctx.fillRect(redX - 35, y-10, 35, 20); // arm
    ctx.beginPath(); ctx.arc(redX, y, 11, 0, Math.PI*2); ctx.fill(); // fist

    // Caption Logic
    if(p < 0.2) {
       caption.innerHTML = '<span style="color:#e0655c;">(T=0) Biru terlihat terseret maju dengan aneh. Merah bersiap.</span>';
    } else if (p >= 0.2 && p < 0.45) {
       caption.innerHTML = '<span style="color:#e0655c;">(T=1) Merah melempar tinju. Wajah biru seperti tersedot "menjemput" tinju.</span>';
    } else if (p >= 0.45 && p < 0.55) {
       caption.innerHTML = '<span style="color:#fff;">(T=2) BENTURAN! Momentum bertukar lintas entropi yang berlawanan.</span>';
       ctx.beginPath(); ctx.arc(w/2, y, 20, 0, Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill();
    } else if (p >= 0.55 && p < 0.8) {
       caption.innerHTML = '<span style="color:#e0655c;">(T=3) Merah menarik tangannya. Biru terdorong ke belakang secara natural.</span>';
    } else {
       caption.innerHTML = '<span style="color:#e0655c;">(T=4) Keduanya kembali ke kuda-kuda dan menjauh.</span>';
    }
  }

  onVisible(canvas, ()=>{ draw(); });
  slider.addEventListener('input', draw);
  draw();
})();