<svelte:head>
  <title>HoverArt — Skribbl Mode</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
</svelte:head>

<script lang="ts">import { onMount, onDestroy, tick } from 'svelte';
interface Player {
    id: string;
    name: string;
    score: number;
    isAI: boolean;
    guessedThisRound: boolean;
}
interface ChatMsg {
    playerId: string;
    playerName: string;
    text: string;
    correct: boolean;
    ts: number;
    isSystem?: boolean;
}
type Phase = 'lobby' | 'countdown' | 'wordpick' | 'drawing' | 'roundend' | 'gameover';
type GestureMode = 'hover' | 'draw' | 'erase';
const WORD_BANK = [
    'cat', 'dog', 'sun', 'tree', 'house', 'fish', 'bird', 'car', 'star', 'moon',
    'hat', 'cup', 'key', 'hand', 'cloud', 'pizza', 'guitar', 'rocket', 'whale',
    'castle', 'robot', 'cactus', 'bridge', 'laptop', 'clock', 'flower', 'snake',
    'crown', 'sword', 'planet', 'umbrella', 'mountain', 'volcano', 'airplane',
    'diamond', 'candle', 'anchor', 'flag', 'ghost', 'heart', 'lightning', 'tornado'
];
const COLORS = [
    '#00f5ff', '#ff4ecd', '#a78bfa', '#4eff91',
    '#ffd600', '#ff6b6b', '#ffffff', '#ff9500',
    '#00c3ff', '#ff4500', '#39ff14', '#f5a623',
];
let phase = $state<Phase>('lobby');
let players = $state<Player[]>([
    { id: 'p1', name: 'Player 1', score: 0, isAI: false, guessedThisRound: false }
]);
let newName = $state('');
let drawerIdx = $state(0);
let round = $state(1);
let totalRounds = $state(3);
let roundDuration = $state(60);
let secretWord = $state('');
let wordChoices = $state<string[]>([]);
let timerSec = $state(80);
let countdown = $state(3);
let chat = $state<ChatMsg[]>([]);
let guessInput = $state('');
let roundWordReveal = $state('');
let canvas = $state<HTMLCanvasElement>(null!);
let videoEl = $state<HTMLVideoElement>(null!);
let previewEl = $state<HTMLVideoElement>(null!);
let cursorEl: HTMLDivElement;
let ctx = $state<CanvasRenderingContext2D | null>(null);
let brushColor = $state('#00f5ff');
let brushSize = $state(6);
let gestureMode = $state<GestureMode>('hover');
let prevX: number | null = null;
let prevY: number | null = null;
let cursorPos = $state<{
    x: number;
    y: number;
} | null>(null);
let handsReady = $state(false);
let camActive = $state(false);
let aiThinking = $state(false);
let timerIv: ReturnType<typeof setInterval> | null = null;
let cdIv: ReturnType<typeof setInterval> | null = null;
let aiIv: ReturnType<typeof setInterval> | null = null;
let handsInst: any = null;
const drawer = $derived(players[drawerIdx]);
const isDrawer = $derived(drawer?.id === 'p1');
const ranked = $derived([...players].sort((a, b) => b.score - a.score));
const wordMask = $derived(secretWord.split('').map((c) => (c === ' ' ? '  ' : '_')).join(' '));
const allGuessed = $derived(players.filter(p => p.id !== drawer?.id).every(p => p.guessedThisRound));
function loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            res();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.crossOrigin = 'anonymous';
        s.onload = () => res();
        s.onerror = rej;
        document.head.appendChild(s);
    });
}
let mediaStream = $state<MediaStream | null>(null);
let rafId: number | null = null;
async function initMediaPipe() {
    if (handsReady)
        return;
    try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
        const Hands = (window as any).Hands;
        handsInst = new Hands({
            locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`
        });
        handsInst.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.72,
            minTrackingConfidence: 0.6,
        });
        handsInst.onResults(onHandResults);
        await handsInst.initialize();
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        videoEl.srcObject = mediaStream;
        await videoEl.play();
        if (previewEl) {
            previewEl.srcObject = mediaStream;
            previewEl.play().catch(() => { });
        }
        camActive = true;
        handsReady = true;
        async function processFrame() {
            if (!handsInst || !videoEl || videoEl.readyState < 2) {
                rafId = requestAnimationFrame(processFrame);
                return;
            }
            await handsInst.send({ image: videoEl });
            rafId = requestAnimationFrame(processFrame);
        }
        rafId = requestAnimationFrame(processFrame);
    }
    catch (e) {
        console.error('MediaPipe init failed:', e);
    }
}
function stopMediaPipe() {
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    handsInst?.close();
    handsInst = null;
    mediaStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    mediaStream = null;
    camActive = false;
    handsReady = false;
}
function detectGesture(lm: any[]): GestureMode {
    const thumbTip = lm[4], indexTip = lm[8], indexPip = lm[6];
    const midTip = lm[12], midPip = lm[10];
    const ringTip = lm[16], ringPip = lm[14];
    const pinkyTip = lm[20], pinkyPip = lm[18];
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    if (pinchDist < 0.08)
        return 'erase';
    const idxUp = indexTip.y < indexPip.y;
    const midUp = midTip.y < midPip.y;
    const ringUp = ringTip.y < ringPip.y;
    const pinkyUp = pinkyTip.y < pinkyPip.y;
    if (idxUp && !ringUp && !pinkyUp)
        return 'draw';
    return 'hover';
}
function onHandResults(results: any) {
    if (!canvas || !ctx)
        return;
    if (!results.multiHandLandmarks?.length) {
        gestureMode = 'hover';
        prevX = prevY = null;
        cursorPos = null;
        return;
    }
    const lm = results.multiHandLandmarks[0];
    const mode = detectGesture(lm);
    gestureMode = mode;
    const tip = lm[8];
    const cx = (1 - tip.x) * canvas.width;
    const cy = tip.y * canvas.height;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    cursorPos = { x: cx * scaleX, y: cy * scaleY };
    const _drawer = players[drawerIdx];
    const _isDrawer = _drawer?.id === 'p1';
    if (!_isDrawer || phase !== 'drawing') {
        prevX = prevY = null;
        return;
    }
    if (mode === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, brushSize * 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        prevX = prevY = null;
    }
    else if (mode === 'draw') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (prevX !== null && prevY !== null) {
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        }
        else {
            ctx.beginPath();
            ctx.arc(cx, cy, brushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = brushColor;
            ctx.fill();
        }
        prevX = cx;
        prevY = cy;
    }
    else {
        prevX = prevY = null;
    }
}
function initCanvas() {
    if (!canvas)
        return;
    ctx = canvas.getContext('2d')!;
    clearCanvas();
}
function clearCanvas() {
    if (!ctx || !canvas)
        return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function startGame() {
    round = 1;
    drawerIdx = 0;
    players = players.map(p => ({ ...p, score: 0, guessedThisRound: false }));
    chat = [];
    startRound();
}
function startRound() {
    phase = 'countdown';
    countdown = 3;
    clearCanvas();
    chat = [];
    players = players.map(p => ({ ...p, guessedThisRound: false }));
    cdIv = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            clearInterval(cdIv!);
            beginWordPick();
        }
    }, 1000);
}
function beginWordPick() {
    const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
    wordChoices = shuffled.slice(0, 3);
    phase = 'wordpick';
    if (drawer?.isAI) {
        secretWord = wordChoices[Math.floor(Math.random() * 3)];
        setTimeout(startDrawing, 600);
    }
    else {
        timerIv = setTimeout(() => {
            if (phase === 'wordpick') {
                secretWord = wordChoices[Math.floor(Math.random() * 3)];
                startDrawing();
            }
        }, 10000) as any;
    }
}
function pickWord(w: string) {
    if (phase !== 'wordpick')
        return;
    if (timerIv)
        clearTimeout(timerIv as any);
    secretWord = w;
    startDrawing();
}
function startDrawing() {
    phase = 'drawing';
    timerSec = roundDuration;
    pushSystem(`✏ Round ${round} started — ${drawer?.name} is drawing!`);
    timerIv = setInterval(() => {
        timerSec--;
        if (timerSec <= 0) {
            clearInterval(timerIv!);
            endRound();
        }
    }, 1000);
    const currentDrawer = players[drawerIdx];
    if (currentDrawer?.isAI) {
        setTimeout(() => aiDraw(secretWord), 1200);
    }
    const aiGuessers = players.filter(p => p.isAI && p.id !== currentDrawer?.id);
    if (aiGuessers.length > 0)
        scheduleAIGuess(aiGuessers);
}
const AI_PERSONAS: Record<string, {
    style: string;
    reactions: string[];
}> = {
    '🤖 Claude': {
        style: 'thoughtful and methodical',
        reactions: ['interesting shape...', 'could be...', 'wait I think I see it', 'hmm the lines suggest...']
    },
    '🤖 Gemini': {
        style: 'confident and quick',
        reactions: ['ooh ooh!', 'I got this', 'easy one', 'wait no...']
    },
    '🤖 Copilot': {
        style: 'nerdy and over-analytical',
        reactions: ['processing...', 'running analysis...', 'cross-referencing shapes...', 'statistically speaking...']
    },
};
function getPersona(name: string) {
    return AI_PERSONAS[name] ?? { style: 'curious', reactions: ['hmm...', 'let me think...'] };
}
const aiPriorGuesses: Record<string, string[]> = {};
const BLURT_WORDS = [
    'cat', 'dog', 'house', 'tree', 'car', 'fish', 'bird', 'moon', 'star', 'sun',
    'hat', 'cup', 'hand', 'clock', 'pizza', 'robot', 'snake', 'ghost', 'heart', 'crown'
];
function scheduleAIGuess(ais: Player[]) {
    ais.forEach(ai => {
        aiPriorGuesses[ai.id] = [];
        const persona = getPersona(ai.name);
        const blurtDelay = 1000 + Math.random() * 3000;
        setTimeout(() => {
            if (phase !== 'drawing' || ai.guessedThisRound)
                return;
            const blurt = BLURT_WORDS[Math.floor(Math.random() * BLURT_WORDS.length)];
            aiPriorGuesses[ai.id] = [blurt];
            chat = [...chat, { playerId: ai.id, playerName: ai.name, text: blurt, correct: blurt === secretWord, ts: Date.now() }];
            if (blurt === secretWord) {
                const pts = Math.max(10, Math.floor(timerSec * 1.5));
                const currentDrawer = players[drawerIdx];
                players = players.map(pl => {
                    if (pl.id === ai.id)
                        return { ...pl, score: pl.score + pts, guessedThisRound: true };
                    if (pl.id === currentDrawer?.id)
                        return { ...pl, score: pl.score + 40 };
                    return pl;
                });
                pushSystem(`🎉 ${ai.name} guessed it! +${pts} pts`);
            }
            scrollChat();
        }, blurtDelay);
        const baseDelays = [8000, 20000, 38000];
        baseDelays.forEach(base => {
            const jitter = Math.random() * 4000;
            setTimeout(async () => {
                if (phase !== 'drawing' || ai.guessedThisRound)
                    return;
                await aiGuess(ai);
            }, base + jitter);
        });
    });
}
async function aiGuess(ai: Player) {
    if (phase !== 'drawing' || ai.guessedThisRound)
        return;
    const persona = getPersona(ai.name);
    const prior = aiPriorGuesses[ai.id] ?? [];
    if (prior.length === 0 || Math.random() < 0.5) {
        const reaction = persona.reactions[Math.floor(Math.random() * persona.reactions.length)];
        chat = [...chat, { playerId: ai.id, playerName: ai.name, text: reaction, correct: false, ts: Date.now() }];
        scrollChat();
        await new Promise(r => setTimeout(r, 1200));
        if (phase !== 'drawing')
            return;
    }
    aiThinking = true;
    try {
        const imgData = canvas.toDataURL('image/png').split(',')[1];
        const priorText = prior.length > 0
            ? `You already guessed wrong: ${prior.join(', ')}. Do NOT guess those again.`
            : '';
        const resp = await fetch('http://localhost:3001/claude', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 80,
                messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imgData } },
                            { type: 'text', text: `This is a Skribbl.io drawing game. Someone drew a word using hand gestures and you need to guess it.
You are ${ai.name}, playing as a ${persona.style} guesser.
${priorText}
Study the shapes, lines and overall composition carefully. The drawing could be anything — an animal, object, place, action, food, or concept.
Respond with ONLY one lowercase word. No punctuation, no explanation, just the word.` }
                        ]
                    }]
            })
        });
        const data = await resp.json();
        const raw = data.content?.[0]?.text?.trim().toLowerCase().replace(/[^a-z]/g, '') ?? '';
        if (raw) {
            aiPriorGuesses[ai.id] = [...prior, raw];
            submitChatMsg(ai.id, ai.name, raw, true);
        }
    }
    catch (e) {
        console.error('AI guess failed:', e);
    }
    finally {
        aiThinking = false;
    }
}
async function aiDraw(word: string) {
    if (!ctx || !canvas)
        return;
    aiThinking = true;
    try {
        const resp = await fetch('http://localhost:3001/claude', {
            method: 'POST',
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1200,
                messages: [{
                        role: 'user',
                        content: `You are drawing the word "${word}" on a ${canvas.width}x${canvas.height} canvas for a Skribbl-style game.
Respond with ONLY a JSON array of strokes. Each stroke is an array of {x,y} points.
Keep it simple — 3 to 8 strokes, each with 4 to 16 points. Spread drawings across the full canvas.
Example for "house": [ [{x:300,y:400},{x:450,y:250},{x:600,y:400}], [{x:300,y:400},{x:600,y:400},{x:600,y:600},{x:300,y:600},{x:300,y:400}] ]
Respond with ONLY the JSON array, no explanation.`
                    }]
            })
        });
        const data = await resp.json();
        const raw = data.content?.[0]?.text?.trim() ?? '[]';
        const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
        const strokes: {
            x: number;
            y: number;
        }[][] = JSON.parse(clean);
        for (const stroke of strokes) {
            if (phase !== 'drawing')
                break;
            if (stroke.length < 2)
                continue;
            ctx.beginPath();
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                await new Promise(r => setTimeout(r, 80));
                if (phase !== 'drawing')
                    break;
                ctx.lineTo(stroke[i].x, stroke[i].y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(stroke[i].x, stroke[i].y);
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }
    catch (e) {
        console.error('AI draw failed:', e);
    }
    finally {
        aiThinking = false;
    }
}
function submitChatMsg(pid: string, pname: string, text: string, isAI = false) {
    const correct = text.toLowerCase().trim() === secretWord.toLowerCase();
    chat = [...chat, { playerId: pid, playerName: pname, text, correct, ts: Date.now() }];
    if (correct) {
        const p = players.find(pl => pl.id === pid);
        if (p && !p.guessedThisRound) {
            const pts = Math.max(10, Math.floor(timerSec * 1.5));
            const currentDrawer = players[drawerIdx];
            const updatedPlayers = players.map(pl => {
                if (pl.id === pid)
                    return { ...pl, score: pl.score + pts, guessedThisRound: true };
                if (pl.id === currentDrawer?.id)
                    return { ...pl, score: pl.score + 40 };
                return pl;
            });
            players = updatedPlayers;
            pushSystem(`🎉 ${pname} guessed it! +${pts} pts`);
            const everyoneGuessed = updatedPlayers
                .filter(pl => pl.id !== currentDrawer?.id)
                .every(pl => pl.guessedThisRound);
            if (everyoneGuessed) {
                clearInterval(timerIv!);
                endRound();
            }
        }
    }
    scrollChat();
}
function handleGuessKey(e: KeyboardEvent) {
    if (e.key === 'Enter')
        submitPlayerGuess();
}
function submitPlayerGuess() {
    const text = guessInput.trim();
    if (!text)
        return;
    const me = players.find(p => p.id === 'p1')!;
    guessInput = '';
    if (phase === 'drawing' && !isDrawer && !me.guessedThisRound) {
        submitChatMsg('p1', me.name, text);
    }
    else {
        chat = [...chat, { playerId: 'p1', playerName: me.name, text, correct: false, ts: Date.now() }];
        scrollChat();
    }
}
function pushSystem(msg: string) {
    chat = [...chat, { playerId: '_sys', playerName: '', text: msg, correct: false, ts: Date.now(), isSystem: true }];
    scrollChat();
}
async function scrollChat() {
    await tick();
    const el = document.getElementById('chat-scroll');
    if (el)
        el.scrollTop = el.scrollHeight;
}
function endRound() {
    phase = 'roundend';
    roundWordReveal = secretWord;
    if (timerIv)
        clearInterval(timerIv);
    const currentDrawer = players[drawerIdx];
    const anyoneGuessed = players.some(p => p.id !== currentDrawer?.id && p.guessedThisRound);
    if (!anyoneGuessed && currentDrawer) {
        players = players.map(p => p.id === currentDrawer.id ? { ...p, score: p.score + 20 } : p);
        pushSystem(`⏱ Time's up! Nobody guessed — ${currentDrawer.name} gets a consolation +20 pts`);
    }
    else {
        pushSystem(`⏱ Time's up! The word was "${secretWord}"`);
    }
    setTimeout(() => {
        drawerIdx = (drawerIdx + 1) % players.length;
        if (drawerIdx === 0) {
            round++;
        }
        if (round > totalRounds && drawerIdx === 0) {
            phase = 'gameover';
        }
        else {
            startRound();
        }
    }, 5000);
}
function addHuman() {
    if (!newName.trim() || players.length >= 6)
        return;
    players = [...players, { id: `p${Date.now()}`, name: newName.trim(), score: 0, isAI: false, guessedThisRound: false }];
    newName = '';
}
function addAI() {
    if (players.length >= 6)
        return;
    const aiNames = ['🤖 Claude', '🤖 Gemini', '🤖 Copilot'];
    const aiCount = players.filter(p => p.isAI).length;
    players = [...players, { id: `ai${Date.now()}`, name: aiNames[aiCount] ?? '🤖 AI', score: 0, isAI: true, guessedThisRound: false }];
}
function removePlayer(id: string) {
    if (id === 'p1' || players.length <= 1)
        return;
    players = players.filter(p => p.id !== id);
}
onMount(() => {
});
onDestroy(() => {
    if (timerIv)
        clearInterval(timerIv);
    if (cdIv)
        clearInterval(cdIv);
    if (aiIv)
        clearInterval(aiIv);
    stopMediaPipe();
});
$effect(() => {
    if (canvas && !ctx) {
        ctx = canvas.getContext('2d')!;
        if (ctx) {
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
});
$effect(() => {
    if (previewEl && mediaStream) {
        previewEl.srcObject = mediaStream;
        previewEl.play().catch(() => { });
    }
});
$effect(() => {
    if (phase === 'drawing' && isDrawer && !handsReady) {
        initMediaPipe();
    }
});
</script>


<div class="fixed inset-0 pointer-events-none z-0" style="
  background-image: linear-gradient(rgba(0,245,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,245,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
"></div>


<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
     style="background:rgba(7,7,16,0.9);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.07)">
  <a href="/" class="font-syne text-xl font-black text-white tracking-tight no-underline">
    Hover<span style="color:#00f5ff">Art</span>
    <span class="ml-2 text-xs font-mono" style="color:rgba(0,245,255,0.5);letter-spacing:.15em">// SKRIBBL</span>
  </a>
  <div class="flex items-center gap-6">
    {#if phase === 'drawing'}
      
      <div class="flex items-center gap-2 text-xs font-mono" style="color:rgba(255,255,255,0.4)">
        <span class="w-2 h-2 rounded-full inline-block"
          style="background:{gestureMode==='draw'?'#00f5ff':gestureMode==='erase'?'#ff4ecd':'rgba(255,255,255,0.2)'}"></span>
        {gestureMode.toUpperCase()}
      </div>
    {/if}
    <a href="/" class="text-xs font-mono uppercase tracking-widest no-underline transition-colors"
       style="color:rgba(255,255,255,0.4)" onmouseenter={(e)=>(e.target as HTMLElement).style.color='#00f5ff'}
       onmouseleave={(e)=>(e.target as HTMLElement).style.color='rgba(255,255,255,0.4)'}>← Back</a>
  </div>
</nav>


<main class="min-h-screen pt-16 relative z-10" style="background:#070710;color:#e0e0f0;font-family:'Space Mono',monospace">

  
  <video bind:this={videoEl} autoplay playsinline muted
    style="position:fixed;width:1px;height:1px;top:-9999px;left:-9999px;opacity:0;pointer-events:none"></video>

  
  {#if phase === 'lobby'}
  <div class="max-w-2xl mx-auto px-6 py-20 flex flex-col gap-8">
    <div class="text-center">
      <div class="inline-block text-xs tracking-widest uppercase mb-4 px-4 py-1"
           style="color:#00f5ff;border:1px solid rgba(0,245,255,0.25)">// game_setup</div>
      <h1 class="font-syne text-5xl font-black tracking-tight text-white mb-3">Skribbl<span style="color:#00f5ff">.</span>io</h1>
      <p class="text-xs leading-relaxed" style="color:rgba(255,255,255,0.35)">
        Draw with your hands via MediaPipe. Others guess. Add <span style="color:#a78bfa">🤖 Claude</span> as an AI guesser.
      </p>
    </div>

    
    <div style="border:1px solid rgba(255,255,255,0.07);background:#0d0d1a">
      <div class="px-5 py-3 text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.25);border-bottom:1px solid rgba(255,255,255,0.07)">
        // players — {players.length}/6
      </div>
      <ul class="divide-y" style="--tw-divide-opacity:0.07;border-color:rgba(255,255,255,0.07)">
        {#each players as p}
        <li class="flex items-center justify-between px-5 py-3">
          <div class="flex items-center gap-3">
            <span class="text-base">{p.isAI ? '🤖' : '👤'}</span>
            <span class="text-sm" style="color:{p.id==='p1'?'#00f5ff':p.isAI?'#a78bfa':'rgba(255,255,255,0.7)'}">{p.name}</span>
            {#if p.id === 'p1'}<span class="text-xs ml-1" style="color:rgba(0,245,255,0.4)">(you)</span>{/if}
          </div>
          {#if p.id !== 'p1'}
            <button onclick={() => removePlayer(p.id)}
              class="text-xs px-2 py-1 transition-colors" style="color:rgba(255,107,107,0.5);border:1px solid rgba(255,107,107,0.2)"
              onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.color='#ff6b6b'}
              onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.color='rgba(255,107,107,0.5)'}>
              remove
            </button>
          {/if}
        </li>
        {/each}
      </ul>
      
      <div class="flex gap-2 p-4" style="border-top:1px solid rgba(255,255,255,0.07)">
        <input bind:value={newName} placeholder="Player name…"
          onkeydown={(e)=>e.key==='Enter'&&addHuman()}
          class="flex-1 px-3 py-2 text-sm font-mono outline-none"
          style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e0e0f0"/>
        <button onclick={addHuman} disabled={!newName.trim()||players.length>=6}
          class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all"
          style="border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.6)">+ Add</button>
        <button onclick={addAI} disabled={players.length>=6}
          class="px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all"
          style="border:1px solid rgba(167,139,250,0.35);color:#a78bfa">+ AI</button>
      </div>
    </div>

    
    <div style="border:1px solid rgba(255,255,255,0.07);background:#0d0d1a">
      <div class="px-5 py-3 text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.25);border-bottom:1px solid rgba(255,255,255,0.07)">
        // settings
      </div>
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid rgba(255,255,255,0.05)">
        <span class="text-xs" style="color:rgba(255,255,255,0.5)">Total Rounds</span>
        <div class="flex items-center gap-3">
          {#each [2,3,4,5] as r}
            <button onclick={() => totalRounds = r}
              class="w-8 h-8 text-xs font-mono transition-all"
              style="border:1px solid {totalRounds===r?'#00f5ff':'rgba(255,255,255,0.15)'};
                     color:{totalRounds===r?'#00f5ff':'rgba(255,255,255,0.4)'};
                     background:{totalRounds===r?'rgba(0,245,255,0.08)':'transparent'}">
              {r}
            </button>
          {/each}
        </div>
      </div>
      <div class="flex items-center justify-between px-5 py-4">
        <span class="text-xs" style="color:rgba(255,255,255,0.5)">Round Duration</span>
        <div class="flex items-center gap-3">
          {#each [30, 60, 90] as d}
            <button onclick={() => roundDuration = d}
              class="px-3 h-8 text-xs font-mono transition-all"
              style="border:1px solid {roundDuration===d?'#a78bfa':'rgba(255,255,255,0.15)'};
                     color:{roundDuration===d?'#a78bfa':'rgba(255,255,255,0.4)'};
                     background:{roundDuration===d?'rgba(167,139,250,0.08)':'transparent'}">
              {d}s
            </button>
          {/each}
        </div>
      </div>
    </div>

    <button onclick={startGame} disabled={players.length < 1}
      class="w-full py-4 font-syne font-black text-lg uppercase tracking-wider transition-all"
      style="background:#00f5ff;color:#070710;box-shadow:0 0 30px rgba(0,245,255,0.25)">
      Start Game →
    </button>

    <div class="text-center text-xs" style="color:rgba(255,255,255,0.2)">
      Gesture guide: ☝️ draw &nbsp;·&nbsp; 🤏 erase &nbsp;·&nbsp; ✋ hover
    </div>
  </div>

  
  {:else if phase === 'countdown'}
  <div class="flex flex-col items-center justify-center min-h-screen gap-6">
    <div class="text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.3)">Round {round} of {totalRounds}</div>
    <div class="font-syne font-black text-white" style="font-size:clamp(5rem,15vw,10rem);line-height:1;
      text-shadow:0 0 60px rgba(0,245,255,0.5);color:#00f5ff">{countdown}</div>
    <div class="text-sm" style="color:rgba(255,255,255,0.5)">
      <span style="color:#00f5ff">{drawer?.name}</span> is drawing…
    </div>
  </div>

  
  {:else if phase === 'wordpick'}
  <div class="flex flex-col items-center justify-center min-h-screen gap-8 px-6">
    {#if isDrawer}
      <div class="text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.3)">// choose_your_word</div>
      <h2 class="font-syne font-black text-white text-3xl tracking-tight">Pick a word to draw</h2>
      <div class="flex gap-4 flex-wrap justify-center">
        {#each wordChoices as w}
          <button onclick={() => pickWord(w)}
            class="px-8 py-5 font-syne font-black text-2xl uppercase tracking-wide transition-all"
            style="border:1px solid rgba(0,245,255,0.25);color:#00f5ff;background:rgba(0,245,255,0.05)"
            onmouseenter={(e)=>{(e.currentTarget as HTMLElement).style.background='rgba(0,245,255,0.12)';(e.currentTarget as HTMLElement).style.boxShadow='0 0 30px rgba(0,245,255,0.2)'}}
            onmouseleave={(e)=>{(e.currentTarget as HTMLElement).style.background='rgba(0,245,255,0.05)';(e.currentTarget as HTMLElement).style.boxShadow='none'}}>
            {w}
          </button>
        {/each}
      </div>
      <div class="text-xs" style="color:rgba(255,255,255,0.25)">Auto-picks in 10s if not chosen</div>
    {:else}
      <div class="font-syne font-black text-white text-4xl">
        <span style="color:#00f5ff">{drawer?.name}</span> is choosing…
      </div>
      <div class="flex gap-2">
        {#each [0,1,2] as _}
          <div class="w-3 h-3 rounded-full animate-pulse" style="background:#00f5ff;animation-delay:{_*200}ms"></div>
        {/each}
      </div>
    {/if}
  </div>

  
  {:else if phase === 'drawing' || phase === 'roundend'}

  
  <div class="flex h-screen pt-16 gap-px" style="background:rgba(255,255,255,0.05)">

    
    <aside class="flex flex-col gap-px" style="width:220px;flex-shrink:0">
      
      <div class="flex-1 overflow-y-auto" style="background:#0a0a14">
        <div class="px-4 py-3 text-xs tracking-widest uppercase sticky top-0"
             style="color:rgba(255,255,255,0.25);background:#0a0a14;border-bottom:1px solid rgba(255,255,255,0.07)">
          // scores
        </div>
        {#each ranked as p, i}
          <div class="flex items-center gap-2 px-3 py-2.5"
               style="border-bottom:1px solid rgba(255,255,255,0.04);{p.id===drawer?.id?'background:rgba(0,245,255,0.04)':''}">
            <span class="text-xs w-4 text-center font-mono" style="color:rgba(255,255,255,0.2)">{i+1}</span>
            <span class="text-sm flex-1 truncate"
                  style="color:{p.id===drawer?.id?'#00f5ff':p.isAI?'#a78bfa':p.guessedThisRound?'#4eff91':'rgba(255,255,255,0.7)'}">
              {p.id===drawer?.id?'✏ ':p.guessedThisRound?'✓ ':''}{p.name}
            </span>
            <span class="text-xs font-mono" style="color:rgba(255,255,255,0.5)">{p.score}</span>
          </div>
        {/each}
      </div>

      
      {#if isDrawer && phase === 'drawing'}
      <div class="relative" style="background:#070710;height:150px;border-top:1px solid rgba(255,255,255,0.07)">
        <div class="absolute inset-0 overflow-hidden">
          <video bind:this={previewEl} autoplay playsinline muted
            class="w-full h-full object-cover scale-x-[-1]" style="opacity:0.6"></video>
        </div>
        <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span class="text-xs px-2 py-0.5 font-mono"
            style="background:{gestureMode==='draw'?'rgba(0,245,255,0.2)':gestureMode==='erase'?'rgba(255,78,205,0.2)':'rgba(255,255,255,0.1)'};
                   color:{gestureMode==='draw'?'#00f5ff':gestureMode==='erase'?'#ff4ecd':'rgba(255,255,255,0.4)'}">
            {gestureMode==='draw'?'☝ DRAW':gestureMode==='erase'?'🤏 ERASE':'✋ HOVER'}
          </span>
          {#if !handsReady}
            <span class="text-xs" style="color:rgba(255,165,0,0.7)">loading…</span>
          {/if}
        </div>
      </div>
      {/if}

      
      <div class="px-4 py-3 text-xs font-mono" style="background:#0a0a14;border-top:1px solid rgba(255,255,255,0.07);color:rgba(255,255,255,0.3)">
        Round {round}/{totalRounds}
      </div>
    </aside>

    
    <div class="flex flex-col flex-1 gap-px">

      
      <div class="flex items-center justify-between px-6 py-3" style="background:#0a0a14">
        <div class="font-syne font-black text-xl tracking-widest"
             style="color:{phase==='roundend'?'#4eff91':'#00f5ff'};letter-spacing:.3em">
          {phase === 'roundend' ? roundWordReveal.toUpperCase() : (isDrawer ? secretWord.toUpperCase() : wordMask.toUpperCase())}
        </div>
        <div class="flex items-center gap-4">
          {#if phase === 'drawing'}
            <div class="text-2xl font-syne font-black"
                 style="color:{timerSec<=10?'#ff4ecd':timerSec<=20?'#ffd600':'#00f5ff'}">{timerSec}</div>
          {:else}
            <div class="text-sm" style="color:#4eff91">✓ Round Over</div>
          {/if}
        </div>
      </div>

      
      {#if phase === 'drawing'}
      <div class="h-0.5" style="background:rgba(255,255,255,0.07)">
        <div class="h-full transition-all duration-1000"
          style="width:{(timerSec/roundDuration)*100}%;background:{timerSec<=10?'#ff4ecd':timerSec<=20?'#ffd600':'#00f5ff'};
                 box-shadow:0 0 8px {timerSec<=10?'#ff4ecd':timerSec<=20?'#ffd600':'#00f5ff'}"></div>
      </div>
      {/if}

      
      <div class="relative flex-1 overflow-hidden" style="background:#0a0a14">
        <canvas bind:this={canvas} width={900} height={600}
          class="absolute inset-0 w-full h-full" style="object-fit:contain"></canvas>

        
        {#if cursorPos && isDrawer && phase === 'drawing'}
          <div class="absolute pointer-events-none z-20 transition-none"
               style="left:{cursorPos.x}px;top:{cursorPos.y}px;transform:translate(-50%,-50%)">
            <div class="rounded-full"
              style="width:{brushSize*2+4}px;height:{brushSize*2+4}px;
                     border:2px solid {gestureMode==='draw'?brushColor:gestureMode==='erase'?'#ff4ecd':'rgba(255,255,255,0.3)'};
                     opacity:0.8;box-shadow:0 0 8px {gestureMode==='draw'?brushColor:'transparent'}"></div>
          </div>
        {/if}

        
        {#if phase === 'roundend'}
          <div class="absolute inset-0 flex flex-col items-center justify-center z-30"
               style="background:rgba(7,7,16,0.75);backdrop-filter:blur(4px)">
            <div class="font-syne font-black text-5xl mb-2" style="color:#4eff91">✓</div>
            <div class="font-syne font-black text-3xl text-white mb-1">The word was</div>
            <div class="font-syne font-black text-5xl" style="color:#00f5ff">{roundWordReveal}</div>
            <div class="text-xs mt-4" style="color:rgba(255,255,255,0.3)">Next round starting…</div>
          </div>
        {/if}
      </div>

      
      {#if isDrawer && phase === 'drawing'}
      <div class="flex items-center gap-4 px-4 py-2 flex-wrap" style="background:#0d0d1a;border-top:1px solid rgba(255,255,255,0.07)">
        
        <div class="flex gap-1.5 flex-wrap">
          {#each COLORS as c}
            <button onclick={() => brushColor = c}
              aria-label="Color {c}"
              class="rounded-full transition-all"
              style="width:{brushColor===c?'22px':'18px'};height:{brushColor===c?'22px':'18px'};
                     background:{c};box-shadow:{brushColor===c?`0 0 10px ${c}`:''};
                     outline:{brushColor===c?`2px solid ${c}`:'none'};outline-offset:2px"></button>
          {/each}
        </div>
        <div class="w-px h-6" style="background:rgba(255,255,255,0.1)"></div>
        
        <div class="flex items-center gap-2">
          {#each [3,6,10,16] as s}
            <button onclick={() => brushSize = s}
              aria-label="Brush size {s}"
              class="flex items-center justify-center w-8 h-8 transition-all rounded-full"
              style="border:1px solid {brushSize===s?brushColor:'rgba(255,255,255,0.15)'};
                     background:{brushSize===s?'rgba(255,255,255,0.08)':'transparent'}">
              <div class="rounded-full" style="width:{s}px;height:{s}px;background:{brushSize===s?brushColor:'rgba(255,255,255,0.4)'}"></div>
            </button>
          {/each}
        </div>
        <div class="w-px h-6" style="background:rgba(255,255,255,0.1)"></div>
        
        <button onclick={clearCanvas}
          class="text-xs font-mono px-3 py-1.5 transition-all"
          style="border:1px solid rgba(255,107,107,0.3);color:rgba(255,107,107,0.7)"
          onmouseenter={(e)=>(e.currentTarget as HTMLElement).style.background='rgba(255,107,107,0.1)'}
          onmouseleave={(e)=>(e.currentTarget as HTMLElement).style.background='transparent'}>
          clear ✕
        </button>
        {#if aiThinking}
          <span class="text-xs animate-pulse" style="color:#a78bfa">🤖 Claude is thinking…</span>
        {/if}
      </div>
      {/if}

      
      {#if !isDrawer && phase === 'drawing'}
      <div class="px-4 py-2 text-xs text-center" style="background:#0d0d1a;color:rgba(255,255,255,0.3);border-top:1px solid rgba(255,255,255,0.07)">
        Watching <span style="color:#00f5ff">{drawer?.name}</span> draw — type your guess in the chat!
      </div>
      {/if}
    </div>

    
    <aside class="flex flex-col" style="width:280px;flex-shrink:0;background:#0a0a14">
      <div class="px-4 py-3 text-xs tracking-widest uppercase"
           style="color:rgba(255,255,255,0.25);border-bottom:1px solid rgba(255,255,255,0.07)">
        // chat
      </div>

      <div id="chat-scroll" class="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        {#each chat as msg}
          {#if msg.isSystem}
            <div class="text-xs py-1 text-center" style="color:rgba(255,255,255,0.3)">{msg.text}</div>
          {:else}
            <div class="text-xs px-2 py-1.5 rounded"
                 style="background:{msg.correct?'rgba(78,255,145,0.07)':'rgba(255,255,255,0.03)'};
                        border-left:2px solid {msg.correct?'#4eff91':msg.playerId==='p1'?'#00f5ff':'rgba(255,255,255,0.15)'}">
              <span class="font-bold" style="color:{msg.playerId==='p1'?'#00f5ff':msg.playerId.startsWith('ai')?'#a78bfa':'rgba(255,255,255,0.6)'}">
                {msg.playerName}:
              </span>
              <span class="ml-1" style="color:{msg.correct?'#4eff91':'rgba(255,255,255,0.5)'}">
                {msg.correct ? '✓ ' : ''}{msg.text}
              </span>
            </div>
          {/if}
        {/each}
      </div>

      
      <div class="p-3" style="border-top:1px solid rgba(255,255,255,0.07)">
        {#if !isDrawer && phase === 'drawing' && players.find(p=>p.id==='p1')?.guessedThisRound}
          <div class="mb-2 text-xs text-center" style="color:#4eff91">✓ You got it! Keep chatting…</div>
        {/if}
        <div class="flex gap-2">
          <input bind:value={guessInput} onkeydown={handleGuessKey}
            placeholder={phase === 'drawing' && !isDrawer && !players.find(p=>p.id==='p1')?.guessedThisRound ? "Type your guess…" : "Chat…"}
            autocomplete="off"
            class="flex-1 px-3 py-2 text-xs font-mono outline-none"
            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#e0e0f0;border-radius:2px"/>
          <button onclick={submitPlayerGuess}
            class="px-3 py-2 text-xs font-mono transition-all"
            style="background:#00f5ff;color:#070710">→</button>
        </div>
      </div>
    </aside>
  </div>

  
  {:else if phase === 'gameover'}
  <div class="flex flex-col items-center min-h-screen gap-10 px-6 py-16">
    <div class="text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.25)">// game_over</div>

    
    {#if ranked[0]}
      <div class="text-center">
        <div class="text-5xl mb-3">{ranked[0].isAI ? '🤖' : '🏆'}</div>
        <h1 class="font-syne font-black text-white m-0" style="font-size:clamp(2.5rem,7vw,4.5rem)">
          <span style="color:#ffd600">{ranked[0].name}</span> wins!
        </h1>
        <div class="mt-2 text-sm font-mono" style="color:rgba(255,255,255,0.3)">
          {ranked[0].score} pts · {ranked[0].isAI ? 'AI Player' : 'Human'}
        </div>
      </div>
    {/if}

    
    {#if ranked.length >= 2}
    <div class="flex items-end justify-center gap-3" style="width:100%;max-width:520px">
      
      {#if ranked[1]}
      <div class="flex flex-col items-center gap-2 flex-1">
        <div class="text-xl">{ranked[1].isAI ? '🤖' : '👤'}</div>
        <div class="font-syne font-bold text-sm text-center truncate w-full" style="color:rgba(255,255,255,0.6)">{ranked[1].name}</div>
        <div class="font-syne font-black text-xl" style="color:rgba(255,255,255,0.5)">{ranked[1].score}</div>
        <div class="w-full flex items-center justify-center font-syne font-black text-2xl"
             style="height:80px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4)">2</div>
      </div>
      {/if}
      
      <div class="flex flex-col items-center gap-2 flex-1">
        <div class="text-2xl">{ranked[0].isAI ? '🤖' : '👤'}</div>
        <div class="font-syne font-bold text-sm text-center truncate w-full" style="color:#ffd600">{ranked[0].name}</div>
        <div class="font-syne font-black text-2xl" style="color:#ffd600">{ranked[0].score}</div>
        <div class="w-full flex items-center justify-center font-syne font-black text-3xl"
             style="height:120px;background:rgba(255,214,0,0.08);border:1px solid rgba(255,214,0,0.3);color:#ffd600">1</div>
      </div>
      
      {#if ranked[2]}
      <div class="flex flex-col items-center gap-2 flex-1">
        <div class="text-xl">{ranked[2].isAI ? '🤖' : '👤'}</div>
        <div class="font-syne font-bold text-sm text-center truncate w-full" style="color:rgba(255,149,0,0.8)">{ranked[2].name}</div>
        <div class="font-syne font-black text-xl" style="color:#ff9500">{ranked[2].score}</div>
        <div class="w-full flex items-center justify-center font-syne font-black text-2xl"
             style="height:60px;background:rgba(255,149,0,0.05);border:1px solid rgba(255,149,0,0.2);color:#ff9500">3</div>
      </div>
      {/if}
    </div>
    {/if}

    
    <div style="width:100%;max-width:520px;border:1px solid rgba(255,255,255,0.07);background:#0d0d1a">
      <div class="px-5 py-3 text-xs tracking-widest uppercase" style="color:rgba(255,255,255,0.25);border-bottom:1px solid rgba(255,255,255,0.07)">
        // full standings
      </div>
      {#each ranked as p, i}
        {@const maxScore = ranked[0].score || 1}
        <div class="relative px-5 py-3 overflow-hidden" style="border-bottom:{i<ranked.length-1?'1px solid rgba(255,255,255,0.05)':'none'}">
          
          <div class="absolute inset-0 left-0"
               style="width:{Math.round((p.score/maxScore)*100)}%;
                      background:{i===0?'rgba(255,214,0,0.06)':i===1?'rgba(255,255,255,0.03)':i===2?'rgba(255,149,0,0.04)':'rgba(255,255,255,0.02)'}"></div>
          <div class="relative flex items-center gap-4">
            <span class="font-syne font-black text-lg w-6 text-center"
                  style="color:{i===0?'#ffd600':i===1?'rgba(255,255,255,0.45)':i===2?'#ff9500':'rgba(255,255,255,0.2)'}">
              {i+1}
            </span>
            <span class="text-base">{p.isAI ? '🤖' : '👤'}</span>
            <div class="flex-1 min-w-0">
              <div class="font-syne font-bold text-sm truncate"
                   style="color:{i===0?'#ffd600':i===1?'rgba(255,255,255,0.75)':i===2?'#ff9500':'rgba(255,255,255,0.5)'}">
                {p.name}
              </div>
              <div class="text-xs font-mono" style="color:rgba(255,255,255,0.2)">{p.isAI ? 'AI' : 'Human'}</div>
            </div>
            <div class="text-right">
              <div class="font-syne font-black text-xl"
                   style="color:{i===0?'#ffd600':i===1?'rgba(255,255,255,0.6)':i===2?'#ff9500':'#00f5ff'}">
                {p.score}
              </div>
              <div class="text-xs font-mono" style="color:rgba(255,255,255,0.2)">pts</div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex gap-4 flex-wrap justify-center">
      <button onclick={() => { players = players.map(p=>({...p,score:0,guessedThisRound:false})); startGame(); }}
        class="px-8 py-4 font-syne font-black text-base uppercase tracking-wider transition-all"
        style="background:#00f5ff;color:#070710;box-shadow:0 0 30px rgba(0,245,255,0.2)">
        Play Again →
      </button>
      <button onclick={() => phase = 'lobby'}
        class="px-8 py-4 font-syne font-black text-base uppercase tracking-wider"
        style="border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5)">
        ← Lobby
      </button>
    </div>
  </div>
  {/if}

</main>

<style>
  :global(body) {
    background: #070710;
    color: #e0e0f0;
    font-family: 'Space Mono', monospace;
    overflow-x: hidden;
  }
  .font-syne { font-family: 'Syne', sans-serif; }

  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }

  
  #chat-scroll { scrollbar-width: thin; scrollbar-color: rgba(0,245,255,0.2) transparent; }
  #chat-scroll::-webkit-scrollbar { width: 4px; }
  #chat-scroll::-webkit-scrollbar-track { background: transparent; }
  #chat-scroll::-webkit-scrollbar-thumb { background: rgba(0,245,255,0.2); border-radius: 2px; }

  
  canvas { image-rendering: pixelated; }
</style>