<script lang="ts">

  const games = [
    {
      id: 'whiteboard',
      href: '/whiteboard',
      title: 'HoverCanvas',
      subtitle: 'Free Draw',
      description: 'Draw anything with your hands. Gesture-powered infinite canvas with collaborative rooms.',
      icon: '✋',
      color: '#00f5ff',
      glow: 'rgba(0,245,255,0.15)',
      border: 'rgba(0,245,255,0.25)',
      tags: ['1–6 players', 'Creative', 'Multiplayer'],
      status: 'live',
    },
    {
      id: 'beat-slash',
      href: '/games/beatsaber',
      title: 'Beat Slash',
      subtitle: 'Rhythm Saber',
      description: 'Flick left, right, up, down to slash incoming blocks. Combo multipliers, health system, 3 difficulties.',
      icon: '⚡',
      color: '#ffdd57',
      glow: 'rgba(255,221,87,0.15)',
      border: 'rgba(255,221,87,0.25)',
      tags: ['Solo', 'Rhythm', 'Score attack'],
      status: 'live',
    },
    {
      id: 'boxing',
      href: '/games/boxing',
      title: 'Shadow Box',
      subtitle: 'Punch Training',
      description: 'Jab, cross, hook and uppercut with real hand tracking. Practice combos against AI opponents.',
      icon: '🥊',
      color: '#ff6b35',
      glow: 'rgba(255,107,53,0.15)',
      border: 'rgba(255,107,53,0.25)',
      tags: ['Solo', 'Fitness', 'Training'],
      status: 'live',
    },
    {
      id: 'boxing2',
      href: '/games/boxing2',
      title: 'Shadow Box 2',
      subtitle: 'Two-Player Bout',
      description: 'Go head-to-head with a second player. Each fighter uses one hand — dodge, block, and counter in real time.',
      icon: '🤜',
      color: '#ff3b5c',
      glow: 'rgba(255,59,92,0.15)',
      border: 'rgba(255,59,92,0.25)',
      tags: ['2 players', 'Versus', 'Fitness'],
      status: 'live',
    },
    {
      id: 'breakout',
      href: '/games/breakout',
      title: 'Hand Breakout',
      subtitle: 'Brick Breaker',
      description: 'Classic brick breaker — move your hand left and right to control the paddle and smash every block.',
      icon: '🧱',
      color: '#4eff91',
      glow: 'rgba(78,255,145,0.15)',
      border: 'rgba(78,255,145,0.25)',
      tags: ['Solo', 'Arcade', 'Score attack'],
      status: 'live',
    },
    {
      id: 'flappy',
      href: '/games/flappy',
      title: 'Flappy Hand',
      subtitle: 'Tap to Fly',
      description: 'Raise your hand to flap, lower it to dive. Navigate through endless pipes without touching anything.',
      icon: '🐦',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.15)',
      border: 'rgba(167,139,250,0.25)',
      tags: ['Solo', 'Endless', 'Casual'],
      status: 'live',
    },
    {
      id: 'skribbl',
      href: '/games/skribbl',
      title: 'Hand Skribbl',
      subtitle: 'Draw & Guess',
      description: 'Skribbl.io but you draw with finger gestures. AI players guess in real-time using computer vision.',
      icon: '🖊',
      color: '#ff4ecd',
      glow: 'rgba(255,78,205,0.15)',
      border: 'rgba(255,78,205,0.25)',
      tags: ['2–6 players', 'AI', 'Competitive'],
      status: 'live',
    },
    {
      id: 'two-truths',
      href: '/games/two-truths',
      title: 'Two Truths',
      subtitle: 'Bluff & Guess',
      description: 'Two truths and a lie — wave left or right to vote on which statement is the bluff. Works great with groups.',
      icon: '🤔',
      color: '#00f5ff',
      glow: 'rgba(0,245,255,0.15)',
      border: 'rgba(0,245,255,0.25)',
      tags: ['3–8 players', 'Party', 'Social'],
      status: 'live',
    },
    {
      id: 'tutorial',
      href: '/tutorial',
      title: 'Gesture Guide',
      subtitle: 'Learn Controls',
      description: 'Master all HoverArt gestures. Interactive tutorial with real-time feedback for every move.',
      icon: '📖',
      color: '#4eff91',
      glow: 'rgba(78,255,145,0.15)',
      border: 'rgba(78,255,145,0.25)',
      tags: ['Beginner', 'Interactive'],
      status: 'live',
    },
    {
      id: 'coming',
      href: '#',
      title: 'Gesture Pong',
      subtitle: 'Coming Soon',
      description: 'Classic Pong reimagined — control your paddle by moving your hand up and down in the air.',
      icon: '🏓',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.1)',
      border: 'rgba(167,139,250,0.15)',
      tags: ['2 players', 'Coming soon'],
      status: 'soon',
    },
  ];
</script>

<svelte:head>
  <title>HoverArt — Games</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
</svelte:head>

<div style="
  min-height:100vh;background:#070710;color:#e0e0f0;
  font-family:'Space Mono',monospace;position:relative;overflow:hidden;
">

  <!-- Grid -->
  <div style="
    position:fixed;inset:0;pointer-events:none;z-index:0;
    background-image:
      linear-gradient(rgba(0,245,255,0.025) 1px,transparent 1px),
      linear-gradient(90deg,rgba(0,245,255,0.025) 1px,transparent 1px);
    background-size:60px 60px;
  "></div>

  <!-- Radial glow top -->
  <div style="position:fixed;top:-200px;left:50%;transform:translateX(-50%);
    width:800px;height:400px;pointer-events:none;z-index:0;
    background:radial-gradient(ellipse,rgba(0,245,255,0.06),transparent 70%)"></div>

  <div style="position:relative;z-index:10;max-width:1100px;margin:0 auto;padding:3rem 1.5rem 5rem">

    <!-- Header -->
    <header style="margin-bottom:3.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
        <div>
          <div style="font-size:0.6rem;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.25);margin-bottom:0.75rem">
            // hover_art / games
          </div>
          <h1 style="font-family:'Syne',sans-serif;font-size:clamp(2.5rem,6vw,4rem);font-weight:800;
            margin:0;line-height:1;color:#fff">
            Hover<span style="color:#00f5ff">Art</span>
          </h1>
          <p style="margin:0.75rem 0 0;font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;
            color:rgba(255,255,255,0.3)">
            Every game. One hand.
          </p>
        </div>
      </div>

      <!-- Divider -->
      <div style="margin-top:2rem;height:1px;background:linear-gradient(to right,rgba(0,245,255,0.3),transparent)"></div>
    </header>

    <!-- Stats bar -->
    <div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:3rem">
      {#each [
        [games.filter(g=>g.status==='live').length + '', 'Games Live'],
        ['2', 'Multiplayer'],
        ['∞', 'Gesture Controls'],
      ] as item}
        <div>
          <div style="font-family:'Syne';font-size:1.5rem;font-weight:800;color:#00f5ff">{item[0]}</div>
          <div style="font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.25)">{item[1]}</div>
        </div>
      {/each}
    </div>

    <!-- Games grid -->
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
      gap:1.5px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.06);
    ">
      {#each games as g}
        <a
          href={g.status === 'soon' ? undefined : g.href}
          style="
            display:block;text-decoration:none;color:inherit;
            background:#070710;padding:2rem;
            position:relative;overflow:hidden;
            opacity:{g.status==='soon'?'0.55':'1'};
            cursor:{g.status==='soon'?'default':'pointer'};
            transition:background 0.2s;
          "
          class:game-card={g.status !== 'soon'}
        >
          <!-- Hover glow -->
          <div class="card-glow" style="
            position:absolute;inset:0;pointer-events:none;
            background:radial-gradient(ellipse at 30% 30%,{g.glow},transparent 70%);
            opacity:0;transition:opacity 0.3s;
          "></div>

          <!-- Corner accent -->
          <div style="
            position:absolute;top:0;right:0;
            width:60px;height:60px;pointer-events:none;
            border-top:2px solid {g.border};
            border-right:2px solid {g.border};
          "></div>

          <!-- Status badge -->
          {#if g.status === 'soon'}
            <div style="
              position:absolute;top:1rem;right:1rem;
              font-size:0.55rem;letter-spacing:0.15em;text-transform:uppercase;
              color:rgba(255,255,255,0.3);border:1px solid rgba(255,255,255,0.1);
              padding:0.2rem 0.5rem;
            ">SOON</div>
          {:else}
            <div style="
              position:absolute;top:1rem;right:1rem;
              display:flex;align-items:center;gap:0.4rem;
              font-size:0.55rem;letter-spacing:0.1em;color:{g.color};
            ">
              <span style="width:5px;height:5px;border-radius:50%;background:{g.color};
                animation:pulse 2s infinite;display:inline-block"></span>
              LIVE
            </div>
          {/if}

          <!-- Icon -->
          <div style="font-size:2.5rem;margin-bottom:1rem;line-height:1">{g.icon}</div>

          <!-- Title -->
          <div style="margin-bottom:1rem">
            <div style="font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:800;
              color:#fff;line-height:1.1;margin-bottom:0.2rem">{g.title}</div>
            <div style="font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:{g.color}">{g.subtitle}</div>
          </div>

          <!-- Description -->
          <p style="font-size:0.72rem;line-height:1.7;color:rgba(255,255,255,0.4);margin:0 0 1.5rem">{g.description}</p>

          <!-- Tags -->
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:1.5rem">
            {#each g.tags as tag}
              <span style="
                font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;
                border:1px solid {g.border};color:{g.color};
                padding:0.2rem 0.5rem;
              ">{tag}</span>
            {/each}
          </div>

          <!-- CTA -->
          {#if g.status !== 'soon'}
            <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.7rem;
              letter-spacing:0.1em;text-transform:uppercase;color:{g.color}">
              <span>Play now</span>
              <span style="font-size:1rem">→</span>
            </div>
          {/if}
        </a>
      {/each}
    </div>

    <!-- Footer -->
    <footer style="margin-top:4rem;padding-top:2rem;
      border-top:1px solid rgba(255,255,255,0.06);
      display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
      <div style="font-size:0.6rem;color:rgba(255,255,255,0.2);letter-spacing:0.1em">
        HOVERART · No touch required.
      </div>
      <div style="font-size:0.6rem;color:rgba(255,255,255,0.15)">
        Powered by MediaPipe · Claude AI
      </div>
    </footer>
  </div>
</div>

<style>
  @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

  .game-card:hover {
    background: #0a0a1a !important;
  }
  .game-card:hover .card-glow {
    opacity: 1 !important;
  }
</style>