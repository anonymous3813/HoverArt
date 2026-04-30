<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

  // ── Types ─────────────────────────────────────────────────────────────────
  type Dir = 'left' | 'right' | 'up' | 'down';
  type Block = {
    id: number; x: number; y: number;
    dir: Dir; color: 'red' | 'blue';
    speed: number; z: number;
    hit: boolean; miss: boolean;
  };
  type Particle = {
    x: number; y: number; vx: number; vy: number;
    life: number; color: string; size: number;
  };
  type Feedback = { text: string; x: number; y: number; age: number; };

  // ── Reactive UI state only (HUD) ──────────────────────────────────────────
  let phase      = $state<'menu' | 'playing' | 'gameover'>('menu');
  let score      = $state(0);
  let combo      = $state(0);
  let maxCombo   = $state(0);
  let health     = $state(100);
  let difficulty = $state<'easy' | 'medium' | 'hard'>('medium');
  let handsReady = $state(false);
  let statusMsg  = $state('Initialising camera…');

  // ── Canvas / video refs ───────────────────────────────────────────────────
  let gameCanvas: HTMLCanvasElement;
  let videoEl: HTMLVideoElement;

  // ── Plain (non-reactive) game objects ─────────────────────────────────────
  // These live in JS only — canvas renders them directly, no DOM diffing.
  let blocks:    Block[]    = [];
  let particles: Particle[] = [];
  let feedbacks: Feedback[] = [];

  // Internal score mirrors so we can batch HUD updates
  let _score = 0, _combo = 0, _maxCombo = 0, _health = 100;

  // ── MediaPipe ─────────────────────────────────────────────────────────────
  let handLandmarker: HandLandmarker | null = null;
  let mediaStream: MediaStream | null = null;
  let rafId: number | null = null;

  // ── Game loop state ───────────────────────────────────────────────────────
  let spawnIv: ReturnType<typeof setInterval> | null = null;
  let blockId = 0;
  let lastTime = 0;

  const COLS  = [0.2, 0.4, 0.6, 0.8];
  const ROWS  = [0.25, 0.5, 0.75];
  const DIRS: Dir[] = ['left', 'right', 'up', 'down'];
  const HIT_ZONE = 0.25;

  const DIFFICULTY = {
    easy:   { spawnMs: 1800, speed: 0.38 },
    medium: { spawnMs: 1100, speed: 0.55 },
    hard:   { spawnMs: 700,  speed: 0.75 },
  };

  // ── Hand tracking state ───────────────────────────────────────────────────
  let handPos: { x: number; y: number } | null = null;
  let flickBuffer: { x: number; y: number; t: number }[] = [];
  let flickCooldown = false;

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      statusMsg = 'Loading hand model…';

      // Use tasks-vision — modern, reliable, GPU-accelerated
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/' +
            'hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence:  0.5,
        minTrackingConfidence:      0.5,
      });

      statusMsg = 'Requesting camera…';
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      videoEl.srcObject = mediaStream;
      await videoEl.play();

      handsReady = true;
      statusMsg = 'Camera ready';

      // Single unified RAF loop — game update + MediaPipe + render
      rafId = requestAnimationFrame(mainLoop);
    } catch (e: any) {
      statusMsg = `Error: ${e?.message ?? e}`;
      console.error(e);
    }
  }

  // ── Main loop (single RAF — no competing loops) ───────────────────────────
  function mainLoop(ts: number) {
    rafId = requestAnimationFrame(mainLoop);

    // 1. Hand detection (only when video is ready)
    if (videoEl.readyState >= 2 && handLandmarker) {
      const result = handLandmarker.detectForVideo(videoEl, ts);
      processHands(result, ts);
    }

    // 2. Game simulation
    if (phase === 'playing') {
      const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0;
      lastTime = ts;
      updateGame(dt);
    }

    // 3. Canvas render
    renderFrame();
  }

  // ── Hand processing ───────────────────────────────────────────────────────
  function processHands(result: any, _ts: number) {
    if (!result.landmarks?.length) {
      handPos = null;
      flickBuffer = [];
      return;
    }

    const lm  = result.landmarks[0];
    const tip = lm[8]; // index fingertip
    const nx  = 1 - tip.x; // mirror horizontally
    const ny  = tip.y;
    handPos = { x: nx, y: ny };

    if (flickCooldown || phase !== 'playing') return;

    const now = Date.now();
    flickBuffer.push({ x: nx, y: ny, t: now });
    flickBuffer = flickBuffer.filter(p => now - p.t < 200);
    if (flickBuffer.length < 4) return;

    const first = flickBuffer[0];
    const last  = flickBuffer[flickBuffer.length - 1];
    const dx    = last.x - first.x;
    const dy    = last.y - first.y;
    const dist  = Math.hypot(dx, dy);
    if (dist < 0.15) return;

    const ratio        = Math.abs(dx) / (Math.abs(dy) + 0.001);
    const isHorizontal = ratio > 1.8;
    const isVertical   = ratio < 0.55;
    if (!isHorizontal && !isVertical) return; // diagonal — ignore

    const dir: Dir = isHorizontal
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');

    tryHit(dir);
    flickBuffer = [];
    flickCooldown = true;
    setTimeout(() => { flickCooldown = false; }, 400);
  }

  // ── Game simulation ───────────────────────────────────────────────────────
  function updateGame(dt: number) {
    // Advance blocks toward camera
    for (const b of blocks) {
      b.z -= b.speed * dt;
    }

    // Miss detection
    for (const b of blocks) {
      if (!b.hit && !b.miss && b.z < -0.05) {
        b.miss = true;
        _health = Math.max(0, _health - 15);
        _combo  = 0;
        health  = _health;
        combo   = _combo;
        if (_health <= 0) endGame();
      }
    }

    // Clean up off-screen
    blocks    = blocks.filter(b => b.z > -0.3);
    particles = particles.filter(p => p.life > 0);
    feedbacks = feedbacks.filter(f => f.age < 0.6);

    // Advance particles and feedback
    for (const p of particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= dt;
    }
    for (const f of feedbacks) {
      f.age += dt;
    }
  }

  // ── Canvas rendering — no DOM involved ───────────────────────────────────
  const ARROW: Record<Dir, string> = { left: '←', right: '→', up: '↑', down: '↓' };

  function renderFrame() {
    if (!gameCanvas) return;
    const ctx = gameCanvas.getContext('2d')!;
    const W   = gameCanvas.width;
    const H   = gameCanvas.height;

    ctx.clearRect(0, 0, W, H);

    if (phase !== 'playing') return;

    // Rail lines (perspective converging lines)
    ctx.lineWidth   = 1;
    for (const cx of COLS) {
      ctx.strokeStyle = 'rgba(0,245,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(cx * W, 0);
      ctx.lineTo(W / 2 + (cx - 0.5) * W * 0.35, H * 0.6);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,245,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.6);
    ctx.lineTo(W, H * 0.6);
    ctx.stroke();

    // Blocks
    for (const b of blocks) {
      if (b.hit || b.miss) continue;
      const persp = 1 / (1 + b.z * 2);
      const sx    = W / 2 + (b.x - 0.5) * W * 0.85 * persp;
      const sy    = H / 2 + (b.y - 0.5) * H * 0.7  * persp;
      const sz    = Math.max(20, 90 * persp);
      const alpha = Math.min(1, (1 - b.z) * 2);
      const col   = b.color === 'red' ? '#ff3b5c' : '#00f5ff';

      ctx.save();
      ctx.globalAlpha = alpha;

      // Fill
      ctx.fillStyle = b.color === 'red'
        ? 'rgba(255,59,92,0.15)'
        : 'rgba(0,245,255,0.15)';
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);

      // Border + glow
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2;
      ctx.shadowColor = col;
      ctx.shadowBlur  = sz * 0.5;
      ctx.strokeRect(sx - sz / 2, sy - sz / 2, sz, sz);

      // Arrow label
      ctx.shadowBlur     = 0;
      ctx.fillStyle      = col;
      ctx.font           = `bold ${Math.round(sz * 0.45)}px Orbitron, monospace`;
      ctx.textAlign      = 'center';
      ctx.textBaseline   = 'middle';
      ctx.fillText(ARROW[b.dir], sx, sy);

      ctx.restore();
    }

    // Particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha  = Math.max(0, p.life * 2.5);
      ctx.fillStyle    = p.color;
      ctx.shadowColor  = p.color;
      ctx.shadowBlur   = p.size;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Feedback text
    for (const f of feedbacks) {
      const t = f.age / 0.6;
      ctx.save();
      ctx.globalAlpha    = 1 - t;
      ctx.fillStyle      = '#ffdd57';
      ctx.shadowColor    = '#ffdd57';
      ctx.shadowBlur     = 10;
      ctx.font           = 'bold 14px Orbitron, monospace';
      ctx.textAlign      = 'center';
      ctx.textBaseline   = 'middle';
      ctx.fillText(f.text, f.x * W, f.y * H - 40 - t * 50);
      ctx.restore();
    }

    // Hand cursor
    if (handPos) {
      const cx = handPos.x * W;
      const cy = handPos.y * H;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#00f5ff';
      ctx.shadowBlur  = 20;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00f5ff';
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Hit detection ─────────────────────────────────────────────────────────
  function tryHit(dir: Dir) {
    const hittable = blocks.filter(b => !b.hit && !b.miss && b.z < HIT_ZONE);
    if (!hittable.length) return;

    // Closest to camera
    const b = hittable.reduce((a, c) => c.z < a.z ? c : a);
    b.hit = true;

    if (b.dir !== dir) {
      _health = Math.max(0, _health - 5);
      _combo  = 0;
      health  = _health;
      combo   = _combo;
      spawnBurst(b.x, b.y, '#ff4444', 6);
      feedbacks.push({ text: '✗ WRONG', x: b.x, y: b.y, age: 0 });
      return;
    }

    _combo++;
    _maxCombo = Math.max(_maxCombo, _combo);
    const pts = 100 * (_combo >= 10 ? 3 : _combo >= 5 ? 2 : 1);
    _score   += pts;
    _health   = Math.min(100, _health + 3);
    score     = _score;
    combo     = _combo;
    maxCombo  = _maxCombo;
    health    = _health;

    const col = b.color === 'red' ? '#ff3b5c' : '#00f5ff';
    spawnBurst(b.x, b.y, col, 16);
    feedbacks.push({
      text: _combo >= 10 ? '🔥 PERFECT' : _combo >= 5 ? 'GREAT' : 'HIT',
      x: b.x, y: b.y, age: 0,
    });
  }

  function spawnBurst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        life: 0.4 + Math.random() * 0.3,
        color, size: 4 + Math.random() * 8,
      });
    }
  }

  // ── Game control ──────────────────────────────────────────────────────────
  function startGame() {
    // Reset plain state
    blocks = []; particles = []; feedbacks = [];
    _score = 0; _combo = 0; _maxCombo = 0; _health = 100;
    blockId = 0; lastTime = 0;
    // Reset reactive HUD
    score = 0; combo = 0; maxCombo = 0; health = 100;
    phase = 'playing';
    const cfg = DIFFICULTY[difficulty];
    spawnIv = setInterval(spawnBlock, cfg.spawnMs);
  }

  function spawnBlock() {
    const cfg = DIFFICULTY[difficulty];
    const col = COLS[Math.floor(Math.random() * COLS.length)];
    const row = ROWS[Math.floor(Math.random() * ROWS.length)];
    blocks.push({
      id:    blockId++,
      x:     col + (Math.random() - 0.5) * 0.12,
      y:     row,
      dir:   DIRS[Math.floor(Math.random() * 4)],
      color: col < 0.5 ? 'red' : 'blue',
      speed: cfg.speed + Math.random() * 0.1,
      z:     1,
      hit:   false,
      miss:  false,
    });
  }

  function endGame() {
    phase = 'gameover';
    if (spawnIv) clearInterval(spawnIv);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  onMount(() => {
    const resize = () => {
      if (!gameCanvas) return;
      gameCanvas.width  = window.innerWidth;
      gameCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    init();
    return () => window.removeEventListener('resize', resize);
  });

  onDestroy(() => {
    if (rafId)   cancelAnimationFrame(rafId);
    if (spawnIv) clearInterval(spawnIv);
    handLandmarker?.close();
    mediaStream?.getTracks().forEach(t => t.stop());
  });
</script>

<svelte:head>
  <title>Beat Slash</title>
  <link
    href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Mono:wght@400;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<!-- Hidden video — MediaPipe reads raw pixels directly, no display needed -->
<video
  bind:this={videoEl}
  autoplay playsinline muted
  style="position:fixed;width:1px;height:1px;top:-9999px;opacity:0;pointer-events:none"
></video>

<main style="
  min-height:100vh;background:#04040f;color:#e0e0f0;
  font-family:'Space Mono',monospace;overflow:hidden;position:relative;
">
  <!-- Grid background -->
  <div style="
    position:fixed;inset:0;pointer-events:none;
    background-image:
      linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px);
    background-size:48px 48px;
  "></div>

  <!-- Horizon glow -->
  <div style="
    position:fixed;bottom:0;left:0;right:0;height:35vh;pointer-events:none;
    background:linear-gradient(to top, rgba(0,245,255,0.06), transparent)
  "></div>

  <!-- ════ MENU ════ -->
  {#if phase === 'menu'}
  <div style="
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;min-height:100vh;gap:2.5rem;
    padding:2rem;position:relative;z-index:10
  ">
    <div style="text-align:center">
      <div style="font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;
        color:rgba(255,255,255,0.25);margin-bottom:1rem">// beat_slash</div>
      <h1 style="
        font-family:'Orbitron',monospace;font-size:clamp(3rem,8vw,5.5rem);
        font-weight:900;margin:0;line-height:1;
        background:linear-gradient(135deg,#ff3b5c,#00f5ff);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text
      ">BEAT<br/>SLASH</h1>
      <p style="margin:1rem 0 0;font-size:0.75rem;color:rgba(255,255,255,0.35);letter-spacing:0.15em">
        FLICK YOUR HAND TO SLASH THE BLOCKS
      </p>
    </div>

    <!-- Gesture guide -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;max-width:420px;width:100%">
      {#each [['←','Flick LEFT','#ff3b5c'],['→','Flick RIGHT','#00f5ff'],['↑','Flick UP','#ffdd57'],['↓','Flick DOWN','#4eff91']] as [arrow,label,color]}
        <div style="
          border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);
          padding:1rem;display:flex;align-items:center;gap:0.75rem;
        ">
          <span style="font-family:'Orbitron';font-size:1.5rem;color:{color}">{arrow}</span>
          <span style="font-size:0.65rem;color:rgba(255,255,255,0.4);letter-spacing:0.1em">{label}</span>
        </div>
      {/each}
    </div>

    <!-- Difficulty -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
      <div style="font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Difficulty</div>
      <div style="display:flex;gap:0.5rem">
        {#each (['easy','medium','hard'] as const) as d}
          <button onclick={() => difficulty = d} style="
            padding:0.5rem 1.25rem;font-family:'Space Mono';font-size:0.7rem;
            letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.15s;
            border:1px solid {difficulty===d?'#00f5ff':'rgba(255,255,255,0.15)'};
            color:{difficulty===d?'#00f5ff':'rgba(255,255,255,0.4)'};
            background:{difficulty===d?'rgba(0,245,255,0.08)':'transparent'};
          ">{d}</button>
        {/each}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;gap:0.75rem">
      {#if !handsReady}
        <div style="font-size:0.65rem;color:rgba(255,255,255,0.3);animation:pulse 1.5s infinite">
          ● {statusMsg}
        </div>
      {:else}
        <div style="font-size:0.65rem;color:#4eff91">● Camera ready</div>
      {/if}
      <button onclick={startGame} style="
        padding:1rem 3rem;font-family:'Orbitron';font-size:1rem;font-weight:700;
        letter-spacing:0.15em;cursor:pointer;transition:all 0.2s;
        background:linear-gradient(135deg,#ff3b5c,#00f5ff);color:#04040f;border:none;
        box-shadow:0 0 40px rgba(0,245,255,0.2);
      ">START</button>
    </div>
  </div>

  <!-- ════ PLAYING ════ -->
  {:else if phase === 'playing'}
  <div style="width:100vw;height:100vh;position:relative;overflow:hidden">

    <!-- Single canvas — all game rendering happens here -->
    <canvas
      bind:this={gameCanvas}
      style="position:absolute;inset:0;width:100%;height:100%"
    ></canvas>

    <!-- HUD — reactive Svelte, but only a handful of values, not hundreds of DOM nodes -->
    <div style="
      position:absolute;top:0;left:0;right:0;z-index:20;
      padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:flex-start;
      background:linear-gradient(to bottom,rgba(4,4,15,0.8),transparent);pointer-events:none;
    ">
      <div>
        <div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Score</div>
        <div style="font-family:'Orbitron';font-size:1.8rem;font-weight:700;color:#00f5ff">{score.toLocaleString()}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Combo</div>
        <div style="
          font-family:'Orbitron';font-size:1.8rem;font-weight:700;
          color:{combo>=10?'#ffdd57':combo>=5?'#4eff91':'#e0e0f0'}
        ">{combo}x</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:0.3rem">Health</div>
        <div style="width:120px;height:8px;background:rgba(255,255,255,0.1);overflow:hidden">
          <div style="
            height:100%;width:{health}%;transition:width 0.3s;
            background:{health>50?'#4eff91':health>25?'#ffdd57':'#ff3b5c'};
            box-shadow:0 0 10px {health>50?'#4eff91':health>25?'#ffdd57':'#ff3b5c'}
          "></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ════ GAME OVER ════ -->
  {:else if phase === 'gameover'}
  <div style="
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;min-height:100vh;gap:2rem;
    padding:2rem;position:relative;z-index:10
  ">
    <div style="
      font-family:'Orbitron';font-size:clamp(2rem,6vw,4rem);font-weight:900;
      color:#ff3b5c;text-shadow:0 0 40px rgba(255,59,92,0.5)
    ">GAME OVER</div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;text-align:center">
      {#each [['Score', score.toLocaleString(), '#00f5ff'],['Max Combo', maxCombo+'x', '#ffdd57'],['Health Left', health+'%', '#4eff91']] as [label, val, color]}
        <div style="border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);padding:1.5rem 1rem">
          <div style="font-size:0.55rem;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:0.5rem">{label}</div>
          <div style="font-family:'Orbitron';font-size:1.6rem;font-weight:700;color:{color}">{val}</div>
        </div>
      {/each}
    </div>

    <div style="display:flex;gap:1rem">
      <button onclick={startGame} style="
        padding:0.75rem 2rem;font-family:'Orbitron';font-size:0.85rem;font-weight:700;
        letter-spacing:0.1em;cursor:pointer;background:#00f5ff;color:#04040f;border:none;
        box-shadow:0 0 20px rgba(0,245,255,0.3)
      ">PLAY AGAIN</button>
      <a href="/games" style="
        padding:0.75rem 2rem;font-family:'Orbitron';font-size:0.85rem;font-weight:700;
        letter-spacing:0.1em;cursor:pointer;border:1px solid rgba(255,255,255,0.2);
        color:rgba(255,255,255,0.5);text-decoration:none;display:flex;align-items:center
      ">← GAMES</a>
    </div>
  </div>
  {/if}
</main>

<style>
  @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
  button { font-family: 'Space Mono', monospace; }
</style>