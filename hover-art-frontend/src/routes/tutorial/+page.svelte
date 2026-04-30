<svelte:head>
  <title>HoverArt — Gesture Tutorial</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
</svelte:head>

<script lang="ts">import { onMount } from 'svelte';
let currentLesson = $state(0);
let done = $state(false);
const quizAnswered: Record<string, boolean> = { draw: false, erase: false, hover: false };
const progress = $derived(done ? 100 : ((currentLesson + 1) / 3) * 100);
function goLesson(n: number) {
    currentLesson = n;
    done = false;
    setTimeout(() => {
        document.querySelectorAll('.lesson-panel')[n]
            ?.querySelectorAll('.step-item')
            .forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 130 + 80));
    }, 60);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function finishTutorial() {
    done = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function restartTutorial() {
    done = false;
    currentLesson = 0;
}
function checkAnswer(e: MouseEvent, isCorrect: boolean, lessonId: string) {
    if (quizAnswered[lessonId])
        return;
    quizAnswered[lessonId] = true;
    const btn = e.currentTarget as HTMLButtonElement;
    const quiz = btn.closest('.quiz-section')!;
    quiz.querySelectorAll<HTMLButtonElement>('.quiz-option').forEach(b => b.style.pointerEvents = 'none');
    if (isCorrect) {
        btn.classList.add('correct');
        quiz.querySelector('.quiz-result')!.innerHTML = '<span class="result-correct">✓ Correct! You\'ve got it.</span>';
    }
    else {
        btn.classList.add('wrong');
        quiz.querySelectorAll<HTMLButtonElement>('.quiz-option[data-correct="true"]').forEach(b => b.classList.add('correct'));
        quiz.querySelector('.quiz-result')!.innerHTML = '<span class="result-wrong">✗ Not quite — the correct answer is highlighted in green.</span>';
    }
}
onMount(() => {
    setTimeout(() => {
        document.querySelectorAll('.lesson-panel')[0]
            ?.querySelectorAll('.step-item')
            .forEach((el, i) => setTimeout(() => el.classList.add('visible'), i * 150 + 300));
    }, 200);
});
</script>


<div class="progress-bar" style="width: {progress}%;"></div>


<nav>
  <a class="nav-logo" href="/">Hover<span>Art</span></a>
  <a class="nav-back" href="/">← Back to home</a>
</nav>

{#if !done}


<div class="tutorial-hero">
  <div class="tutorial-eyebrow">// gesture_tutorial</div>
  <h1 class="tutorial-title">Learn the Signs</h1>
  <p class="tutorial-sub">Three gestures, mastered in five minutes. Follow each lesson to get comfortable before you open the canvas.</p>
</div>


<div class="tabs-wrapper">
  <div class="lesson-nav">
    <button class="lesson-tab" class:active={currentLesson===0} class:tab-cyan={currentLesson===0} on:click={() => goLesson(0)}>
      <span class="tab-icon">☝️</span><span>01 — Draw</span>
    </button>
    <button class="lesson-tab" class:active={currentLesson===1} class:tab-pink={currentLesson===1} on:click={() => goLesson(1)}>
      <span class="tab-icon">🤏</span><span>02 — Erase</span>
    </button>
    <button class="lesson-tab" class:active={currentLesson===2} class:tab-violet={currentLesson===2} on:click={() => goLesson(2)}>
      <span class="tab-icon">✋</span><span>03 — Hover</span>
    </button>
  </div>
</div>


<div class="lessons-container">

  
  <div class="lesson-panel" class:hidden={currentLesson !== 0} data-id="draw">
    <div class="lesson-header">
      <div class="lesson-number ln-cyan">01</div>
      <div class="lesson-meta">
        <span class="lesson-label lc-cyan">Gesture One</span>
        <div class="lesson-title">Draw</div>
        <p class="lesson-tagline">Point your index finger to paint on the canvas. Your fingertip is the brush tip.</p>
      </div>
    </div>

    <div class="anatomy-grid">
      <div class="finger finger-active"><span class="finger-emoji">☝️</span><div class="finger-name">Index</div><div class="finger-state state-up">EXTENDED ↑</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Middle</div><div class="finger-state state-curl">curled</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Ring</div><div class="finger-state state-curl">curled</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Pinky</div><div class="finger-state state-curl">curled</div></div>
      <div class="finger"><span class="finger-emoji">👍</span><div class="finger-name">Thumb</div><div class="finger-state state-curl">relaxed</div></div>
    </div>

    <div class="lesson-body">
      <div class="lesson-demo">
        <div class="demo-glow glow-cyan"></div>
        <span class="demo-hand">☝️</span>
        <span class="demo-label" style="color:#00f5ff">✏ Drawing mode active</span>
      </div>
      <div class="lesson-info">
        <div class="info-title">// how_to_draw</div>
        <ul class="steps-list">
          <li class="step-item"><div class="step-num sn-cyan">1</div><div class="step-content"><div class="step-text">Hold your hand up in front of the camera, palm facing the screen.</div></div></li>
          <li class="step-item"><div class="step-num sn-cyan">2</div><div class="step-content"><div class="step-text">Extend your <strong style="color:#00f5ff">index finger</strong> straight up — like you're pointing at the ceiling.</div><div class="step-note">Your index fingertip (landmark #8) is the brush tip.</div></div></li>
          <li class="step-item"><div class="step-num sn-cyan">3</div><div class="step-content"><div class="step-text">Curl your <strong style="color:rgba(255,255,255,0.5)">middle, ring, and pinky fingers</strong> downward toward your palm.</div><div class="step-note">Their tips must sit below their PIP knuckles for detection.</div></div></li>
          <li class="step-item"><div class="step-num sn-cyan">4</div><div class="step-content"><div class="step-text">Move your hand — the canvas traces wherever your index fingertip goes!</div></div></li>
        </ul>
        <div class="tip-box tip-cyan"><span class="tip-icon">💡</span><span>Keep your index fingertip clearly visible to the camera. The AI tracks the tip position at up to 60fps and smooths jitter over 5 frames for silky lines.</span></div>
      </div>
    </div>

    <div class="section-label">// common_mistakes</div>
    <div class="mistakes-grid">
      <div class="mistake-card"><span class="mistake-icon">😬</span><div class="mistake-title">Two fingers up <span class="badge-wrong">✗ wrong</span></div><div class="mistake-desc">Raising both index and middle fingers creates a "peace sign" — the middle tip won't be curled below its PIP, so the gesture won't register as Draw.</div></div>
      <div class="mistake-card"><span class="mistake-icon">✅</span><div class="mistake-title">Curl tightly <span class="badge-right">✓ correct</span></div><div class="mistake-desc">Firmly curl middle, ring, and pinky so their tips drop clearly below their second knuckles. A loose half-curl may confuse the detector.</div></div>
    </div>

    <div class="quiz-section">
      <div class="quiz-title">Quick Check</div>
      <div class="quiz-question">Which hand shape triggers the <strong>Draw</strong> gesture?</div>
      <div class="quiz-options">
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'draw')}><span class="option-emoji">✌️</span><span>Index + Middle both up</span></button>
        <button class="quiz-option" data-correct="true"  on:click={(e) => checkAnswer(e, true,  'draw')}><span class="option-emoji">☝️</span><span>Only index up, others curled</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'draw')}><span class="option-emoji">🤏</span><span>Pinching thumb + index</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'draw')}><span class="option-emoji">✋</span><span>Open palm facing camera</span></button>
      </div>
      <div class="quiz-result"></div>
    </div>

    <div class="lesson-controls">
      <button class="btn-lesson" disabled>← Previous</button>
      <button class="btn-lesson primary" on:click={() => goLesson(1)}>Next: Erase →</button>
    </div>
  </div>

  
  <div class="lesson-panel" class:hidden={currentLesson !== 1} data-id="erase">
    <div class="lesson-header">
      <div class="lesson-number ln-pink">02</div>
      <div class="lesson-meta">
        <span class="lesson-label lc-pink">Gesture Two</span>
        <div class="lesson-title">Erase</div>
        <p class="lesson-tagline">Pinch your thumb and index finger together to erase a 40×40px area wherever you move.</p>
      </div>
    </div>

    <div class="anatomy-grid">
      <div class="finger finger-active-pink"><span class="finger-emoji">👆</span><div class="finger-name">Index</div><div class="finger-state state-up-pink">PINCHING ↓</div></div>
      <div class="finger"><span class="finger-emoji">👎</span><div class="finger-name">Thumb</div><div class="finger-state state-up-pink">PINCHING ↓</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Middle</div><div class="finger-state state-curl">any</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Ring</div><div class="finger-state state-curl">any</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Pinky</div><div class="finger-state state-curl">any</div></div>
    </div>

    <div class="lesson-body">
      <div class="lesson-demo">
        <div class="demo-glow glow-pink"></div>
        <span class="demo-hand" style="animation-duration:2s">🤏</span>
        <span class="demo-label" style="color:#ff4ecd">⬜ Erase mode active</span>
      </div>
      <div class="lesson-info">
        <div class="info-title">// how_to_erase</div>
        <ul class="steps-list">
          <li class="step-item"><div class="step-num sn-pink">1</div><div class="step-content"><div class="step-text">Hold your hand naturally in front of the camera with fingers relaxed.</div></div></li>
          <li class="step-item"><div class="step-num sn-pink">2</div><div class="step-content"><div class="step-text">Bring your <strong style="color:#ff4ecd">thumb tip</strong> and <strong style="color:#ff4ecd">index fingertip</strong> together until they almost touch.</div><div class="step-note">The system measures the 3D distance between landmarks #4 (thumb) and #8 (index). Distance &lt; 0.06 = erase!</div></div></li>
          <li class="step-item"><div class="step-num sn-pink">3</div><div class="step-content"><div class="step-text">While pinching, <strong style="color:rgba(255,255,255,0.6)">move your hand</strong> across the canvas to erase strokes in a 40×40px brush area.</div></div></li>
          <li class="step-item"><div class="step-num sn-pink">4</div><div class="step-content"><div class="step-text">Release the pinch to stop erasing. The middle, ring, and pinky fingers can be in any position.</div></div></li>
        </ul>
        <div class="tip-box tip-pink"><span class="tip-icon">💡</span><span>Erase is checked <em>before</em> Draw — so even if your index is extended, if you're pinching close enough, erase takes priority. The threshold is a 3D distance of 0.06 in normalized coordinates.</span></div>
      </div>
    </div>

    <div class="section-label">// pinch_detector</div>
    <div class="detector-mock">
      <div class="detector-header">
        <span class="detector-title">Pinch distance monitor</span>
        <span class="detector-badge badge-erase">ERASE ACTIVE</span>
      </div>
      <div class="landmark-diagram">
        <div class="lm-row"><span class="lm-label">Thumb tip (#4)</span><div class="lm-bar" style="width:30px;background:#ff4ecd"></div><span class="lm-val" style="color:#ff4ecd">x:0.41 y:0.58</span></div>
        <div class="lm-row"><span class="lm-label">Index tip (#8)</span><div class="lm-bar" style="width:30px;background:#ff4ecd"></div><span class="lm-val" style="color:#ff4ecd">x:0.44 y:0.61</span></div>
        <div class="lm-row" style="margin-top:0.5rem"><span class="lm-label">3D distance</span><div class="lm-bar" style="width:14px;background:#ff4ecd"></div><span class="lm-val" style="color:#ff4ecd;font-weight:bold">0.047 &lt; 0.06 ✓</span></div>
      </div>
    </div>

    <div class="section-label">// common_mistakes</div>
    <div class="mistakes-grid">
      <div class="mistake-card"><span class="mistake-icon">😬</span><div class="mistake-title">Fingers close but not touching <span class="badge-wrong">✗ wrong</span></div><div class="mistake-desc">If the distance stays above 0.06 in normalized units, erase won't trigger. Make sure the tips actually make contact or nearly touch.</div></div>
      <div class="mistake-card"><span class="mistake-icon">✅</span><div class="mistake-title">Full contact pinch <span class="badge-right">✓ correct</span></div><div class="mistake-desc">Firmly press thumb tip to index tip — like picking up a tiny object. Other fingers don't matter for this gesture.</div></div>
    </div>

    <div class="quiz-section">
      <div class="quiz-title">Quick Check</div>
      <div class="quiz-question">What landmark distance triggers <strong>Erase</strong>?</div>
      <div class="quiz-options">
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'erase')}><span class="option-emoji">📏</span><span>Thumb to middle &lt; 0.06</span></button>
        <button class="quiz-option" data-correct="true"  on:click={(e) => checkAnswer(e, true,  'erase')}><span class="option-emoji">🤏</span><span>Thumb to index tip &lt; 0.06</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'erase')}><span class="option-emoji">📐</span><span>Any two fingers &lt; 0.12</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'erase')}><span class="option-emoji">✊</span><span>All fingers curled to palm</span></button>
      </div>
      <div class="quiz-result"></div>
    </div>

    <div class="lesson-controls">
      <button class="btn-lesson" on:click={() => goLesson(0)}>← Previous</button>
      <button class="btn-lesson primary" on:click={() => goLesson(2)}>Next: Hover →</button>
    </div>
  </div>

  
  <div class="lesson-panel" class:hidden={currentLesson !== 2} data-id="hover">
    <div class="lesson-header">
      <div class="lesson-number ln-violet">03</div>
      <div class="lesson-meta">
        <span class="lesson-label lc-violet">Gesture Three</span>
        <div class="lesson-title">Hover</div>
        <p class="lesson-tagline">Any hand position that isn't Draw or Erase pauses the canvas. Use it to reposition freely.</p>
      </div>
    </div>

    <div class="anatomy-grid">
      <div class="finger"><span class="finger-emoji">👆</span><div class="finger-name">Index</div><div class="finger-state state-any">any ↕</div></div>
      <div class="finger"><span class="finger-emoji">🖕</span><div class="finger-name">Middle</div><div class="finger-state state-any">any ↕</div></div>
      <div class="finger"><span class="finger-emoji">💍</span><div class="finger-name">Ring</div><div class="finger-state state-any">any ↕</div></div>
      <div class="finger"><span class="finger-emoji">🤙</span><div class="finger-name">Pinky</div><div class="finger-state state-any">any ↕</div></div>
      <div class="finger"><span class="finger-emoji">👍</span><div class="finger-name">Thumb</div><div class="finger-state state-any">any ↕</div></div>
    </div>

    <div class="lesson-body">
      <div class="lesson-demo">
        <div class="demo-glow glow-violet"></div>
        <span class="demo-hand" style="animation-duration:4s">✋</span>
        <span class="demo-label" style="color:#a78bfa">✋ Hovering / Paused</span>
      </div>
      <div class="lesson-info">
        <div class="info-title">// how_to_hover</div>
        <ul class="steps-list">
          <li class="step-item"><div class="step-num sn-violet">1</div><div class="step-content"><div class="step-text">Any hand shape that doesn't match Draw or Erase triggers Hover — the "none" state.</div></div></li>
          <li class="step-item"><div class="step-num sn-violet">2</div><div class="step-content"><div class="step-text">Common hover positions: <strong style="color:#a78bfa">open palm ✋</strong>, a fist ✊, peace sign ✌️, or pointing with two fingers.</div><div class="step-note">Anything that breaks the "only index up" rule and isn't a pinch.</div></div></li>
          <li class="step-item"><div class="step-num sn-violet">3</div><div class="step-content"><div class="step-text">While hovering, your hand cursor is still visible on screen — you can plan your next stroke without drawing.</div></div></li>
          <li class="step-item"><div class="step-num sn-violet">4</div><div class="step-content"><div class="step-text">Any unfinished stroke is committed when you exit Draw — even mid-stroke. Use hover to "lift the pen."</div></div></li>
        </ul>
        <div class="tip-box tip-violet"><span class="tip-icon">💡</span><span>Think of Hover like lifting your pen off paper. Use it strategically: draw a stroke, hover to reposition your hand far away, then resume drawing exactly where you want.</span></div>
      </div>
    </div>

    <div class="section-label">// gesture_priority_order</div>
    <div class="detector-mock">
      <div class="detector-header">
        <span class="detector-title">Classification flow (each frame)</span>
        <span class="detector-badge badge-none">✋ NONE ACTIVE</span>
      </div>
      <div class="landmark-diagram">
        <div class="lm-row priority-row" style="background:rgba(255,78,205,0.06);border:1px solid rgba(255,78,205,0.2);margin-bottom:0.5rem"><span class="lm-label" style="color:#ff4ecd">1. Erase check</span><span class="lm-val" style="color:rgba(255,255,255,0.3)">dist(#4,#8) &lt; 0.06 ?</span></div>
        <div class="lm-row priority-row" style="background:rgba(0,245,255,0.06);border:1px solid rgba(0,245,255,0.2);margin-bottom:0.5rem"><span class="lm-label" style="color:#00f5ff">2. Draw check</span><span class="lm-val" style="color:rgba(255,255,255,0.3)">index up AND others curled ?</span></div>
        <div class="lm-row priority-row" style="background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.2)"><span class="lm-label" style="color:#a78bfa">3. Hover (fallback)</span><span class="lm-val" style="color:rgba(255,255,255,0.3)">return 'none'</span></div>
      </div>
    </div>

    <div class="section-label" style="margin-top:1.5rem">// hover_examples</div>
    <div class="mistakes-grid hover-grid">
      <div class="mistake-card" style="text-align:center"><span class="mistake-icon">✋</span><div class="mistake-title" style="justify-content:center">Open Palm</div><div class="mistake-desc" style="text-align:center">All fingers extended — multiple fingers up breaks the Draw rule</div></div>
      <div class="mistake-card" style="text-align:center"><span class="mistake-icon">✊</span><div class="mistake-title" style="justify-content:center">Fist</div><div class="mistake-desc" style="text-align:center">All fingers curled — index isn't above its PIP joint</div></div>
      <div class="mistake-card" style="text-align:center"><span class="mistake-icon">✌️</span><div class="mistake-title" style="justify-content:center">Peace Sign</div><div class="mistake-desc" style="text-align:center">Middle finger isn't curled — breaks the Draw condition</div></div>
      <div class="mistake-card" style="text-align:center"><span class="mistake-icon">🤘</span><div class="mistake-title" style="justify-content:center">Rock On</div><div class="mistake-desc" style="text-align:center">Ring + middle curled, but pinky up — pinky isn't curled</div></div>
    </div>

    <div class="quiz-section">
      <div class="quiz-title">Quick Check</div>
      <div class="quiz-question">You want to reposition your hand without drawing. What do you do?</div>
      <div class="quiz-options">
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'hover')}><span class="option-emoji">☝️</span><span>Keep index finger extended</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'hover')}><span class="option-emoji">🤏</span><span>Pinch thumb + index while moving</span></button>
        <button class="quiz-option" data-correct="true"  on:click={(e) => checkAnswer(e, true,  'hover')}><span class="option-emoji">✋</span><span>Open your hand or make a fist</span></button>
        <button class="quiz-option" data-correct="false" on:click={(e) => checkAnswer(e, false, 'hover')}><span class="option-emoji">🚶</span><span>Move out of camera frame</span></button>
      </div>
      <div class="quiz-result"></div>
    </div>

    <div class="lesson-controls">
      <button class="btn-lesson" on:click={() => goLesson(1)}>← Previous</button>
      <button class="btn-lesson primary" on:click={finishTutorial}>Finish Tutorial ✓</button>
    </div>
  </div>

</div>

{:else}


<div class="all-done">
  <span class="done-emoji">🎨</span>
  <h2 class="done-title">You're <span class="accent">ready.</span></h2>
  <p class="done-sub">You've learned all three gestures: Draw ☝️, Erase 🤏, and Hover ✋.<br>Open the canvas and start creating — no touch required.</p>
  <div class="done-actions">
    <a href="/whiteboard" class="btn-done primary">Open HoverArt Canvas</a>
    <button class="btn-done secondary" on:click={restartTutorial}>↺ Review Again</button>
  </div>
</div>

{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html) { scroll-behavior: smooth; }
  :global(body) {
    background: #070710;
    color: #e0e0f0;
    font-family: 'Space Mono', monospace;
    overflow-x: hidden;
    min-height: 100vh;
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

  .progress-bar {
    position: fixed;
    top: 0; left: 0;
    height: 2px;
    background: #00f5ff;
    z-index: 200;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 12px #00f5ff;
  }

  nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.2rem 3rem;
    background: rgba(7,7,16,0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .nav-logo { font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 900; color: white; text-decoration: none; }
  .nav-logo span { color: #00f5ff; }
  .nav-back { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); text-decoration: none; transition: color 0.2s; }
  .nav-back:hover { color: #00f5ff; }

  .tutorial-hero { position: relative; z-index: 1; padding: 10rem 3rem 5rem; max-width: 900px; margin: 0 auto; text-align: center; }
  .tutorial-eyebrow { display: inline-block; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #00f5ff; border: 1px solid rgba(0,245,255,0.25); padding: 0.3rem 1rem; margin-bottom: 1.5rem; }
  .tutorial-title { font-family: 'Syne', sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 900; letter-spacing: -0.04em; color: white; line-height: 1; margin-bottom: 1rem; }
  .tutorial-sub { font-size: 0.8rem; line-height: 1.8; color: rgba(255,255,255,0.3); max-width: 500px; margin: 0 auto 3rem; }

  .tabs-wrapper { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 0 3rem; }
  .lesson-nav { display: flex; border: 1px solid rgba(255,255,255,0.07); margin: 0 auto 4rem; }
  .lesson-tab {
    flex: 1; padding: 1rem 0.5rem;
    background: #0d0d1a; border: none; border-right: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.3); font-family: 'Space Mono', monospace; font-size: 0.65rem;
    letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s;
    display: flex; flex-direction: column; align-items: center; gap: 0.4rem; position: relative;
  }
  .lesson-tab:last-child { border-right: none; }
  .lesson-tab .tab-icon { font-size: 1.5rem; filter: grayscale(0.7); transition: filter 0.2s; }
  .lesson-tab:hover { color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.03); }
  .lesson-tab:hover .tab-icon { filter: grayscale(0); }
  .lesson-tab.active .tab-icon { filter: grayscale(0); }
  .lesson-tab.active::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; }
  .tab-cyan  { color: #00f5ff; background: rgba(0,245,255,0.05); }
  .tab-cyan::after  { background: #00f5ff; }
  .tab-pink  { color: #ff4ecd; background: rgba(255,78,205,0.05); }
  .tab-pink::after  { background: #ff4ecd; }
  .tab-violet{ color: #a78bfa; background: rgba(167,139,250,0.05); }
  .tab-violet::after{ background: #a78bfa; }

  .lessons-container { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 0 3rem 5rem; }
  .lesson-panel { animation: fadeInLesson 0.4s ease; }
  .lesson-panel.hidden { display: none; }

  @keyframes fadeInLesson { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

  .lesson-header { display: flex; align-items: flex-start; gap: 2rem; margin-bottom: 2.5rem; }
  .lesson-number { font-family: 'Syne', sans-serif; font-size: 5rem; font-weight: 900; line-height: 1; color: transparent; flex-shrink: 0; }
  .ln-cyan   { -webkit-text-stroke: 1px rgba(0,245,255,0.2); }
  .ln-pink   { -webkit-text-stroke: 1px rgba(255,78,205,0.2); }
  .ln-violet { -webkit-text-stroke: 1px rgba(167,139,250,0.2); }
  .lesson-meta { flex: 1; }
  .lesson-label { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.4rem; display: block; }
  .lc-cyan   { color: #00f5ff; }
  .lc-pink   { color: #ff4ecd; }
  .lc-violet { color: #a78bfa; }
  .lesson-title { font-family: 'Syne', sans-serif; font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; color: white; margin-bottom: 0.5rem; }
  .lesson-tagline { font-size: 0.75rem; color: rgba(255,255,255,0.3); line-height: 1.6; }

  .anatomy-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.07); margin-bottom: 2rem; }
  .finger { background: #0d0d1a; padding: 1rem 0.5rem; text-align: center; }
  .finger-emoji { font-size: 1.2rem; display: block; margin-bottom: 0.4rem; }
  .finger-name { font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .finger-state { font-size: 0.6rem; margin-top: 0.3rem; font-weight: 700; }
  .state-up      { color: #00f5ff; }
  .state-up-pink { color: #ff4ecd; }
  .state-curl    { color: rgba(255,255,255,0.25); }
  .state-any     { color: rgba(167,139,250,0.7); }
  .finger-active      { background: rgba(0,245,255,0.06); border-bottom: 2px solid #00f5ff; }
  .finger-active-pink { background: rgba(255,78,205,0.06); border-bottom: 2px solid #ff4ecd; }

  .lesson-body { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.07); margin-bottom: 2rem; }
  .lesson-demo { background: #0d0d1a; padding: 3rem 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 380px; position: relative; overflow: hidden; }
  .demo-hand { font-size: 8rem; display: block; animation: handFloat 3s ease-in-out infinite; position: relative; z-index: 2; }
  @keyframes handFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  .demo-label { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 1.5rem; position: relative; z-index: 2; }
  .demo-glow { position: absolute; width: 200px; height: 200px; border-radius: 50%; filter: blur(60px); animation: pulseGlow 2.5s ease-in-out infinite; }
  @keyframes pulseGlow { 0%, 100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 0.8; transform: scale(1.1); } }
  .glow-cyan   { background: radial-gradient(circle, rgba(0,245,255,0.4), transparent 70%); }
  .glow-pink   { background: radial-gradient(circle, rgba(255,78,205,0.4), transparent 70%); }
  .glow-violet { background: radial-gradient(circle, rgba(167,139,250,0.4), transparent 70%); }

  .lesson-info { background: #0d0d1a; padding: 2.5rem 2rem; }
  .info-title { font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 1.2rem; }

  .steps-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
  .step-item { display: flex; gap: 1rem; align-items: flex-start; opacity: 0; transform: translateX(-10px); transition: opacity 0.4s, transform 0.4s; }
  :global(.step-item.visible) { opacity: 1; transform: translateX(0); }
  .step-num { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; border: 1px solid; }
  .sn-cyan   { border-color: rgba(0,245,255,0.3); color: #00f5ff; }
  .sn-pink   { border-color: rgba(255,78,205,0.3); color: #ff4ecd; }
  .sn-violet { border-color: rgba(167,139,250,0.3); color: #a78bfa; }
  .step-text { font-size: 0.8rem; line-height: 1.6; color: rgba(255,255,255,0.75); }
  .step-note { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-top: 0.2rem; }

  .tip-box { border: 1px solid; padding: 1rem 1.2rem; font-size: 0.72rem; line-height: 1.6; display: flex; gap: 0.8rem; align-items: flex-start; }
  .tip-cyan   { border-color: rgba(0,245,255,0.2); background: rgba(0,245,255,0.04); color: rgba(0,245,255,0.8); }
  .tip-pink   { border-color: rgba(255,78,205,0.2); background: rgba(255,78,205,0.04); color: rgba(255,78,205,0.8); }
  .tip-violet { border-color: rgba(167,139,250,0.2); background: rgba(167,139,250,0.04); color: rgba(167,139,250,0.8); }
  .tip-icon { font-size: 1rem; flex-shrink: 0; }

  .section-label { margin-bottom: 0.5rem; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.25); }

  .detector-mock { border: 1px solid rgba(255,255,255,0.07); background: #0a0a14; padding: 1.5rem; margin-bottom: 2rem; }
  .detector-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .detector-title { font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
  .detector-badge { font-size: 0.6rem; padding: 0.2rem 0.6rem; letter-spacing: 0.1em; }
  .badge-erase { background: rgba(255,78,205,0.15); color: #ff4ecd; border: 1px solid rgba(255,78,205,0.3); }
  .badge-none  { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
  .landmark-diagram { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.65rem; color: rgba(255,255,255,0.3); }
  .lm-row { display: flex; align-items: center; gap: 0.6rem; }
  .priority-row { padding: 0.5rem; }
  .lm-label { min-width: 90px; }
  .lm-bar { height: 4px; border-radius: 2px; }
  .lm-val { margin-left: auto; font-size: 0.6rem; }

  .mistakes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.07); margin-bottom: 2rem; }
  .hover-grid { grid-template-columns: repeat(4, 1fr); }
  .mistake-card { background: #0d0d1a; padding: 1.5rem; }
  .mistake-icon { font-size: 1.5rem; margin-bottom: 0.6rem; display: block; }
  .mistake-title { font-size: 0.7rem; font-weight: 700; margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.4rem; }
  .badge-wrong { font-size: 0.55rem; color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3); padding: 0.1rem 0.4rem; }
  .badge-right { font-size: 0.55rem; color: #4eff91; border: 1px solid rgba(78,255,145,0.3); padding: 0.1rem 0.4rem; }
  .mistake-desc { font-size: 0.68rem; color: rgba(255,255,255,0.35); line-height: 1.5; }

  .quiz-section { border: 1px solid rgba(255,255,255,0.07); background: #0d0d1a; padding: 2rem; margin-bottom: 2rem; }
  .quiz-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 800; color: white; margin-bottom: 0.4rem; }
  .quiz-question { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-bottom: 1.5rem; }
  .quiz-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .quiz-option { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 1rem 1.2rem; font-family: 'Space Mono', monospace; font-size: 0.75rem; color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s; text-align: left; display: flex; align-items: center; gap: 0.7rem; }
  .quiz-option:hover { border-color: rgba(255,255,255,0.25); color: white; }
  :global(.quiz-option.correct) { border-color: #4eff91; background: rgba(78,255,145,0.08); color: #4eff91; }
  :global(.quiz-option.wrong)   { border-color: #ff6b6b; background: rgba(255,107,107,0.08); color: #ff6b6b; }
  .option-emoji { font-size: 1.4rem; }
  .quiz-result { margin-top: 1rem; font-size: 0.72rem; min-height: 1.5rem; }
  :global(.result-correct) { color: #4eff91; }
  :global(.result-wrong)   { color: #ff6b6b; }

  .lesson-controls { display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; }
  .btn-lesson { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); font-family: 'Space Mono', monospace; font-size: 0.72rem; letter-spacing: 0.08em; padding: 0.7rem 1.5rem; cursor: pointer; transition: all 0.2s; text-transform: uppercase; }
  .btn-lesson:hover { border-color: rgba(255,255,255,0.35); color: white; }
  .btn-lesson.primary { border-color: #00f5ff; color: #00f5ff; }
  .btn-lesson.primary:hover { background: #00f5ff; color: #070710; }
  .btn-lesson:disabled { opacity: 0.3; pointer-events: none; }

  .all-done { text-align: center; padding: 12rem 2rem 5rem; position: relative; z-index: 1; max-width: 900px; margin: 0 auto; animation: fadeInLesson 0.5s ease; }
  .done-emoji { font-size: 5rem; display: block; margin-bottom: 1.5rem; animation: handFloat 3s ease-in-out infinite; }
  .done-title { font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 900; letter-spacing: -0.03em; color: white; margin-bottom: 0.75rem; }
  .accent { color: #00f5ff; }
  .done-sub { font-size: 0.8rem; color: rgba(255,255,255,0.35); margin-bottom: 2.5rem; line-height: 1.7; }
  .done-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  .btn-done { display: inline-block; padding: 0.9rem 2rem; font-family: 'Space Mono', monospace; font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
  .btn-done.primary   { background: #00f5ff; color: #070710; box-shadow: 0 0 30px rgba(0,245,255,0.3); }
  .btn-done.primary:hover { box-shadow: 0 0 50px rgba(0,245,255,0.5); }
  .btn-done.secondary { background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.15); }

  @media (max-width: 700px) {
    nav { padding: 1rem 1.5rem; }
    .tabs-wrapper, .lessons-container { padding: 0 1.5rem; }
    .lessons-container { padding-bottom: 4rem; }
    .tutorial-hero { padding: 8rem 1.5rem 3rem; }
    .lesson-body { grid-template-columns: 1fr; }
    .lesson-header { flex-direction: column; gap: 1rem; }
    .lesson-number { font-size: 3.5rem; }
    .mistakes-grid, .hover-grid { grid-template-columns: 1fr; }
    .quiz-options { grid-template-columns: 1fr; }
  }
</style>
