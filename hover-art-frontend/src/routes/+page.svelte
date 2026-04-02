<svelte:head>
  <title>HoverArt — Draw Without Touching</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
</svelte:head>

<div class="cursor" id="cursor"></div>
<div class="cursor-dot" id="cursorDot"></div>

<!-- NAV -->
<nav>
  <a class="nav-logo" href="/">Hover<span>Art</span></a>
  <ul class="nav-links">
    <li><a href="#gestures">Gestures</a></li>
    <li><a href="#how">How It Works</a></li>
    <li><a href="/tutorial">Tutorial</a></li>
    <li><a href="/games/imposter">Two Truths</a></li>
    <li><a href="/games/flappy">Flappy Mouth</a></li>
    <li><a href="/games/breakout">Face Breakout</a></li>
  </ul>
  <a href="#launch" class="nav-cta">Launch App →</a>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>

  <div>
    <div class="hero-eyebrow">✦ Gesture-powered canvas</div>
    <h1 class="hero-title">
      Draw<span class="accent">.</span><br>
      <span class="line2">No Touch.</span>
    </h1>
    <p class="hero-sub">HoverArt uses your webcam and AI hand tracking to turn your fingers into a paintbrush. Just point, pinch, and create — no stylus, no touchscreen required.</p>
    <div class="hero-actions">
      <a href="#launch" class="btn-primary">Open Canvas</a>
      <a href="/tutorial" class="btn-secondary">Learn Gestures →</a>
    </div>
  </div>

  <div class="scroll-hint">
    <div class="scroll-line"></div>
    Scroll
  </div>
</section>

<!-- STRIP -->
<div class="strip">
  <span class="strip-label">Powered by</span>
  <div class="strip-items">
    <span class="strip-item"><span>◈</span> MediaPipe</span>
    <span class="strip-item"><span>◈</span> Real-time AI</span>
    <span class="strip-item"><span>◈</span> No Installation</span>
    <span class="strip-item"><span>◈</span> Works in Browser</span>
    <span class="strip-item"><span>◈</span> Privacy-first</span>
    <span class="strip-item"><span>◈</span> Open Source</span>
  </div>
</div>

<!-- GESTURES SECTION -->
<section class="section" id="gestures">
  <span class="section-tag">// gesture_library</span>
  <h2 class="section-title">Three signs.<br>Infinite expression.</h2>
  <p class="section-desc">The entire interface is controlled by three hand gestures, detected in real-time at up to 60fps by an on-device AI model.</p>

  <div class="gestures-grid">
    <div class="gesture-card">
      <div class="gesture-number">01</div>
      <span class="gesture-icon">☝️</span>
      <div class="gesture-name">Draw</div>
      <span class="gesture-tag">Index up · others curled</span>
      <p class="gesture-desc">Extend your index finger toward the camera while keeping your middle, ring, and pinky fingers curled inward. Your fingertip becomes the brush.</p>
      <span class="gesture-corner">draw</span>
    </div>
    <div class="gesture-card">
      <div class="gesture-number">02</div>
      <span class="gesture-icon">🤏</span>
      <div class="gesture-name">Erase</div>
      <span class="gesture-tag">Pinch · thumb + index</span>
      <p class="gesture-desc">Bring your thumb tip and index fingertip together in a pinch. Move across your drawing to erase. Release the pinch to stop erasing.</p>
      <span class="gesture-corner">erase</span>
    </div>
    <div class="gesture-card">
      <div class="gesture-number">03</div>
      <span class="gesture-icon">✋</span>
      <div class="gesture-name">Hover</div>
      <span class="gesture-tag">Any other position</span>
      <p class="gesture-desc">Open your hand, make a fist, or any position that isn't draw or pinch — the canvas pauses. Use this to reposition without leaving a mark.</p>
      <span class="gesture-corner">none</span>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="section" id="how" style="padding-top: 0;">
  <span class="section-tag">// pipeline</span>
  <h2 class="section-title">How it works.</h2>
  <p class="section-desc">From camera pixel to canvas stroke in milliseconds.</p>

  <div class="steps">
    <div class="step">
      <div class="step-num">01</div>
      <div class="step-title">Camera Capture</div>
      <p class="step-desc">Your webcam streams live video at 1280×720 — all processing happens locally in your browser. Nothing is uploaded.</p>
    </div>
    <div class="step">
      <div class="step-num">02</div>
      <div class="step-title">Hand Detection</div>
      <p class="step-desc">MediaPipe's neural network finds your hand and tracks 21 3D landmark points — knuckles, joints, and fingertips.</p>
    </div>
    <div class="step">
      <div class="step-num">03</div>
      <div class="step-title">Gesture Classify</div>
      <p class="step-desc">A fast classifier reads the landmarks and decides: draw, erase, or hover — updated every animation frame.</p>
    </div>
    <div class="step">
      <div class="step-num">04</div>
      <div class="step-title">Canvas Render</div>
      <p class="step-desc">Smoothed fingertip coordinates are fed into a HTML5 Canvas drawing API, producing silky strokes in your chosen color.</p>
    </div>
  </div>
</section>

<!-- STATS -->
<div class="stats-wrapper">
  <div class="stats-row">
    <div class="stat">
      <div class="stat-value">21</div>
      <div class="stat-label">hand landmarks tracked</div>
    </div>
    <div class="stat">
      <div class="stat-value">60<small>fps</small></div>
      <div class="stat-label">real-time detection</div>
    </div>
    <div class="stat">
      <div class="stat-value">0kb</div>
      <div class="stat-label">data ever uploaded</div>
    </div>
  </div>
</div>

<!-- CTA SECTION -->
<section class="cta-section" id="launch">
  <div class="cta-bg"></div>
  <h2 class="cta-title">
    Start <span class="outline">creating</span><br>
    right now.
  </h2>
  <p class="cta-sub">Open your browser. Allow camera access. Draw.</p>
  <div class="cta-actions">
    <a href="/whiteboard" class="btn-primary btn-large">Open the Canvas</a>
    <a href="/tutorial" class="btn-secondary btn-large">Take the Tutorial</a>
    <a href="/games/imposter" class="btn-secondary btn-large">Two Truths</a>
    <a href="/games/flappy" class="btn-secondary btn-large">Flappy Mouth</a>
    <a href="/games/breakout" class="btn-secondary btn-large">Face Breakout</a>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <span>HoverArt — Draw Without Touching</span>
  <span>Built with MediaPipe + SvelteKit</span>
  <span>No data collected. No accounts. Just art.</span>
</footer>

<script>
  import { onMount } from 'svelte';

  onMount(() => {
    const cursor = document.getElementById('cursor');
    const dot = document.getElementById('cursorDot');
    let mx = 0, my = 0, cx = 0, cy = 0;

    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    function animCursor() {
      cx += (mx - cx) * 0.12;
      cy += (my - cy) * 0.12;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';
      dot.style.left = mx + 'px';
      dot.style.top = my + 'px';
      requestAnimationFrame(animCursor);
    }
    animCursor();

    document.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.style.width = '40px';
        cursor.style.height = '40px';
        cursor.style.background = 'rgba(0,245,255,0.1)';
      });
      el.addEventListener('mouseleave', () => {
        cursor.style.width = '20px';
        cursor.style.height = '20px';
        cursor.style.background = 'transparent';
      });
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.gesture-card, .step, .stat').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });

    document.querySelectorAll('.gesture-card').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.1) + 's';
    });
    document.querySelectorAll('.step').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.08) + 's';
    });
    document.querySelectorAll('.stat').forEach((el, i) => {
      el.style.transitionDelay = (i * 0.1) + 's';
    });
  });
</script>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    background: #070710;
    color: #e0e0f0;
    font-family: 'Space Mono', monospace;
    overflow-x: hidden;
    cursor: none;
  }
  :global(body::before) {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(0,245,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,245,255,0.025) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
    z-index: 0;
  }
  :global(body::after) {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
    );
    pointer-events: none;
    z-index: 9990;
  }

  .cursor {
    position: fixed;
    width: 20px; height: 20px;
    border: 2px solid #00f5ff;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%,-50%);
    transition: width 0.2s, height 0.2s, background 0.2s;
    mix-blend-mode: screen;
  }
  .cursor-dot {
    position: fixed;
    width: 4px; height: 4px;
    background: #00f5ff;
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%,-50%);
  }

  nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.2rem 3rem;
    background: rgba(7,7,16,0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .nav-logo {
    font-family: 'Syne', sans-serif;
    font-size: 1.4rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: white;
    text-decoration: none;
  }
  .nav-logo span { color: #00f5ff; }
  .nav-links { display: flex; gap: 2rem; list-style: none; }
  .nav-links a {
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition: color 0.2s;
  }
  .nav-links a:hover { color: #00f5ff; }
  .nav-cta {
    background: transparent;
    border: 1px solid #00f5ff;
    color: #00f5ff;
    font-family: 'Space Mono', monospace;
    font-size: 0.75rem;
    padding: 0.5rem 1.2rem;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    text-decoration: none;
  }
  .nav-cta:hover { background: #00f5ff; color: #070710; }

  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 8rem 2rem 4rem;
    z-index: 1;
    overflow: hidden;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
    animation: drift 8s ease-in-out infinite;
  }
  .orb-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(0,245,255,0.12) 0%, transparent 70%);
    top: -200px; left: 50%;
    transform: translateX(-50%);
  }
  .orb-2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,78,205,0.1) 0%, transparent 70%);
    bottom: 0; right: -100px;
    animation: drift2 10s ease-in-out infinite;
    animation-delay: -3s;
  }
  .orb-3 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(0,245,255,0.07) 0%, transparent 70%);
    bottom: 100px; left: -50px;
    animation: drift3 12s ease-in-out infinite;
    animation-delay: -6s;
  }
  @keyframes drift {
    0%, 100% { transform: translateY(0) translateX(-50%); }
    33% { transform: translateY(-30px) translateX(calc(-50% + 20px)); }
    66% { transform: translateY(20px) translateX(calc(-50% - 15px)); }
  }
  @keyframes drift2 {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-40px); }
  }
  @keyframes drift3 {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(30px); }
  }

  .hero-eyebrow {
    display: inline-block;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #00f5ff;
    border: 1px solid rgba(0,245,255,0.3);
    padding: 0.3rem 1rem;
    margin-bottom: 1.5rem;
    opacity: 0;
    animation: fadeUp 0.6s 0.2s forwards;
  }
  .hero-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(3.5rem, 10vw, 8rem);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -0.04em;
    color: white;
    margin-bottom: 1.5rem;
    opacity: 0;
    animation: fadeUp 0.7s 0.35s forwards;
  }
  .hero-title .accent { color: #00f5ff; }
  .hero-title .line2 {
    display: block;
    -webkit-text-stroke: 1px rgba(255,255,255,0.3);
    color: transparent;
  }
  .hero-sub {
    max-width: 520px;
    margin: 0 auto 2.5rem;
    font-size: 0.85rem;
    line-height: 1.8;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.02em;
    opacity: 0;
    animation: fadeUp 0.7s 0.5s forwards;
  }
  .hero-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    opacity: 0;
    animation: fadeUp 0.7s 0.65s forwards;
  }

  .btn-primary {
    display: inline-block;
    background: #00f5ff;
    color: #070710;
    font-family: 'Space Mono', monospace;
    font-weight: 700;
    font-size: 0.8rem;
    padding: 0.9rem 2.2rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    cursor: pointer;
    border: none;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.3s;
    box-shadow: 0 0 30px rgba(0,245,255,0.3);
  }
  .btn-primary::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 100%; height: 100%;
    background: rgba(255,255,255,0.2);
    transition: left 0.3s;
  }
  .btn-primary:hover::before { left: 100%; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 50px rgba(0,245,255,0.5); }
  .btn-large { font-size: 0.9rem; padding: 1.1rem 3rem; }

  .btn-secondary {
    display: inline-block;
    background: transparent;
    color: rgba(255,255,255,0.6);
    font-family: 'Space Mono', monospace;
    font-size: 0.8rem;
    padding: 0.9rem 2.2rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,0.15);
    transition: border-color 0.2s, color 0.2s;
  }
  .btn-secondary:hover { border-color: rgba(255,255,255,0.4); color: white; }

  .scroll-hint {
    position: absolute;
    bottom: 2rem; left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    opacity: 0;
    animation: fadeUp 0.7s 1s forwards;
    color: rgba(255,255,255,0.2);
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .scroll-line {
    width: 1px; height: 40px;
    background: linear-gradient(to bottom, rgba(0,245,255,0.6), transparent);
    animation: scrollLine 1.5s ease-in-out infinite;
  }
  @keyframes scrollLine {
    0% { transform: scaleY(0); transform-origin: top; }
    50% { transform: scaleY(1); transform-origin: top; }
    51% { transform: scaleY(1); transform-origin: bottom; }
    100% { transform: scaleY(0); transform-origin: bottom; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .strip {
    position: relative;
    z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.07);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    padding: 1.2rem 3rem;
    display: flex;
    gap: 2rem;
    align-items: center;
    overflow: hidden;
    background: rgba(0,245,255,0.02);
  }
  .strip-label {
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    white-space: nowrap;
  }
  .strip-items { display: flex; gap: 3rem; overflow: hidden; flex: 1; }
  .strip-item {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .strip-item span { color: #00f5ff; font-size: 1rem; }

  .section {
    position: relative;
    z-index: 1;
    padding: 7rem 3rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .section-tag {
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #00f5ff;
    margin-bottom: 0.75rem;
    display: block;
  }
  .section-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(2rem, 4vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: white;
    margin-bottom: 1rem;
    line-height: 1.1;
  }
  .section-desc {
    font-size: 0.8rem;
    line-height: 1.9;
    color: rgba(255,255,255,0.3);
    max-width: 480px;
    margin-bottom: 4rem;
  }

  .gestures-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .gesture-card {
    background: #0d0d1a;
    padding: 3rem 2.5rem;
    position: relative;
    overflow: hidden;
    transition: background 0.3s;
  }
  .gesture-card::before {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .gesture-card:nth-child(1)::before { background: radial-gradient(circle at 30% 40%, rgba(0,245,255,0.07) 0%, transparent 60%); }
  .gesture-card:nth-child(2)::before { background: radial-gradient(circle at 30% 40%, rgba(255,78,205,0.07) 0%, transparent 60%); }
  .gesture-card:nth-child(3)::before { background: radial-gradient(circle at 30% 40%, rgba(167,139,250,0.07) 0%, transparent 60%); }
  .gesture-card:hover::before { opacity: 1; }
  .gesture-number {
    font-family: 'Syne', sans-serif;
    font-size: 4.5rem;
    font-weight: 900;
    line-height: 1;
    -webkit-text-stroke: 1px rgba(255,255,255,0.08);
    color: transparent;
    margin-bottom: 1.5rem;
    transition: -webkit-text-stroke-color 0.3s;
  }
  .gesture-card:nth-child(1):hover .gesture-number { -webkit-text-stroke-color: rgba(0,245,255,0.3); }
  .gesture-card:nth-child(2):hover .gesture-number { -webkit-text-stroke-color: rgba(255,78,205,0.3); }
  .gesture-card:nth-child(3):hover .gesture-number { -webkit-text-stroke-color: rgba(167,139,250,0.3); }
  .gesture-icon {
    font-size: 3.5rem;
    margin-bottom: 1.2rem;
    display: block;
    filter: grayscale(0.4);
    transition: filter 0.2s, transform 0.3s;
  }
  .gesture-card:hover .gesture-icon { filter: grayscale(0); transform: scale(1.1); }
  .gesture-name {
    font-family: 'Syne', sans-serif;
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
    color: white;
  }
  .gesture-tag {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 1rem;
    display: block;
  }
  .gesture-card:nth-child(1) .gesture-tag { color: #00f5ff; }
  .gesture-card:nth-child(2) .gesture-tag { color: #ff4ecd; }
  .gesture-card:nth-child(3) .gesture-tag { color: #a78bfa; }
  .gesture-desc { font-size: 0.78rem; line-height: 1.7; color: rgba(255,255,255,0.35); }
  .gesture-corner {
    position: absolute;
    bottom: 1.5rem; right: 1.5rem;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.1);
    text-transform: uppercase;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid rgba(255,255,255,0.07);
    margin-top: 1rem;
  }
  .step {
    padding: 2.5rem 2rem;
    border-right: 1px solid rgba(255,255,255,0.07);
  }
  .step:last-child { border-right: none; }
  .step-num {
    font-family: 'Syne', sans-serif;
    font-size: 3rem;
    font-weight: 900;
    color: rgba(0,245,255,0.1);
    line-height: 1;
    margin-bottom: 1rem;
  }
  .step-title { font-size: 0.9rem; font-weight: 700; color: white; margin-bottom: 0.5rem; }
  .step-desc { font-size: 0.72rem; line-height: 1.7; color: rgba(255,255,255,0.3); }

  .stats-wrapper {
    position: relative;
    z-index: 1;
    padding: 0 3rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.07);
    margin: 5rem 0;
  }
  .stat { background: #0d0d1a; padding: 3rem 2rem; text-align: center; }
  .stat-value {
    font-family: 'Syne', sans-serif;
    font-size: 3.5rem;
    font-weight: 900;
    color: #00f5ff;
    line-height: 1;
    margin-bottom: 0.5rem;
    letter-spacing: -0.03em;
  }
  .stat-value small { font-size: 1.5rem; }
  .stat-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.25); }

  .cta-section {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 7rem 2rem;
    overflow: hidden;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .cta-bg {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 100%, rgba(0,245,255,0.06) 0%, transparent 60%);
    pointer-events: none;
  }
  .cta-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(2.5rem, 6vw, 5rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    color: white;
    line-height: 1;
    margin-bottom: 1.5rem;
    position: relative;
  }
  .cta-title .outline { -webkit-text-stroke: 1px rgba(255,255,255,0.25); color: transparent; }
  .cta-sub {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.05em;
    margin-bottom: 3rem;
    position: relative;
  }
  .cta-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    position: relative;
  }

  footer {
    position: relative;
    z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.07);
    padding: 2rem 3rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.18);
    letter-spacing: 0.08em;
  }

  @media (max-width: 768px) {
    nav { padding: 1rem 1.5rem; }
    .nav-links { display: none; }
    .section { padding: 5rem 1.5rem; }
    .gestures-grid { grid-template-columns: 1fr; }
    .steps { grid-template-columns: 1fr 1fr; }
    .step { border-bottom: 1px solid rgba(255,255,255,0.07); }
    .stats-row { grid-template-columns: 1fr; }
    .strip { padding: 1rem 1.5rem; gap: 1rem; }
    footer { flex-direction: column; gap: 1rem; text-align: center; }
    .stats-wrapper { padding: 0 1.5rem; }
  }
</style>
