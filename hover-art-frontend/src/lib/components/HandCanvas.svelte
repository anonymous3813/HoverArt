<script lang="ts">import { onMount, onDestroy } from 'svelte';
import { classifyGesture } from '$lib/gestures.ts';
import { blendGet, blendshapeTable } from '$lib/face/blendshapeTable.ts';
import { HandLandmarker, FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
type Point = {
    x: number;
    y: number;
};
type Stroke = {
    points: Point[];
    color: string;
    width: number;
};
let { brushColor = $bindable('#ffffff'), brushSize = $bindable(4), moodState = $bindable<'joyful' | 'neutral'>('neutral'), onGestureChange = (_gesture: string) => { }, onStrokeComplete = (_stroke: Stroke) => { }, onClear = () => { } } = $props();
let isLoading = $state(true);
let error = $state<string | null>(null);
let gesture = $state('none');
let gesture1 = $state('none');
let fps = $state(0);
let handsDetected = $state(0);
let videoEl: HTMLVideoElement;
let canvasEl: HTMLCanvasElement;
let overlayEl: HTMLCanvasElement;
let handLandmarker: HandLandmarker;
let faceLandmarker: FaceLandmarker;
let animFrameId: number;
let stream: MediaStream;
let lastTimestamp = -1;
let lastFpsTime = performance.now();
let frameCount = 0;
type HandState = {
    isDrawing: boolean;
    currentStroke: Point[];
    posBuffer: Point[];
    gesture: string;
};
const handStates: HandState[] = [
    { isDrawing: false, currentStroke: [], posBuffer: [], gesture: 'none' },
    { isDrawing: false, currentStroke: [], posBuffer: [], gesture: 'none' }
];
let strokes: Stroke[] = [];
let pendingWheelColor = $state('#ffffff');
let lastSmileCheck = 0;
const CLEAR_HOLD_MS = 1500;
let bothPalmsStart = 0;
const SMOOTH_SAMPLES = 5;
const width = 1280;
const height = 720;
onMount(async () => {
    try {
        await initMediaPipe();
        await initCamera();
        isLoading = false;
        renderLoop();
    }
    catch (e: any) {
        error = e.message;
        isLoading = false;
    }
});
onDestroy(() => {
    cancelAnimationFrame(animFrameId);
    stream?.getTracks().forEach(t => t.stop());
    handLandmarker?.close();
    faceLandmarker?.close();
});
async function initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.5
    });
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
}
async function initCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
        video: { width: width, height: height, facingMode: 'user' }
    });
    videoEl.srcObject = stream;
    await new Promise<void>((res) => (videoEl.onloadedmetadata = () => res()));
    await videoEl.play();
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    overlayEl.width = videoEl.videoWidth;
    overlayEl.height = videoEl.videoHeight;
}
function renderLoop() {
    animFrameId = requestAnimationFrame(renderLoop);
    const now = performance.now();
    if (videoEl.readyState < 2)
        return;
    frameCount++;
    if (now - lastFpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
    }
    if (now === lastTimestamp)
        return;
    lastTimestamp = now;
    const handResult = handLandmarker.detectForVideo(videoEl, now);
    if (now - lastSmileCheck > 200) {
        lastSmileCheck = now;
        const faceResult = faceLandmarker.detectForVideo(videoEl, now);
        if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
            const sym = blendshapeTable(faceResult.faceBlendshapes[0].categories);
            const smileL = blendGet(sym, 'mouthSmileLeft');
            const smileR = blendGet(sym, 'mouthSmileRight');
            const detected = (smileL + smileR) / 2 > 0.28 ? 'joyful' : 'neutral';
            if (detected !== moodState)
                moodState = detected;
        }
    }
    processResult(handResult);
}
function processResult(result: any) {
    const overlayCtx = overlayEl.getContext('2d')!;
    const drawCtx = canvasEl.getContext('2d')!;
    const drawingUtils = new DrawingUtils(overlayCtx);
    overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
    handsDetected = result.landmarks.length;
    for (let i = 0; i < 2; i++) {
        if (i >= result.landmarks.length) {
            if (handStates[i].isDrawing)
                finishHandStroke(i);
            if (i === 0 && handStates[0].gesture === 'color-select')
                brushColor = pendingWheelColor;
            handStates[i].gesture = 'none';
            handStates[i].posBuffer = [];
            if (i === 0) {
                gesture = 'none';
                onGestureChange('none');
            }
            if (i === 1)
                gesture1 = 'none';
            continue;
        }
        const landmarks = result.landmarks[i];
        drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
            color: i === 0 ? '#00f5ff44' : '#ff4ecd44',
            lineWidth: 1
        });
        drawingUtils.drawLandmarks(landmarks, {
            color: i === 0 ? '#00f5ffaa' : '#ff4ecdaa',
            fillColor: i === 0 ? '#00f5ff33' : '#ff4ecd33',
            lineWidth: 1,
            radius: 3
        });
        const hs = handStates[i];
        const detectedGesture = classifyGesture(landmarks);
        if (detectedGesture !== hs.gesture) {
            const prev = hs.gesture;
            hs.gesture = detectedGesture;
            if (i === 0) {
                gesture = detectedGesture;
                onGestureChange(detectedGesture);
                if (prev === 'color-select')
                    brushColor = pendingWheelColor;
            }
            else {
                gesture1 = detectedGesture;
            }
            if (detectedGesture !== 'draw')
                finishHandStroke(i);
        }
        const tip = landmarks[8];
        const rawX = tip.x * canvasEl.width;
        const rawY = tip.y * canvasEl.height;
        hs.posBuffer.push({ x: rawX, y: rawY });
        if (hs.posBuffer.length > SMOOTH_SAMPLES)
            hs.posBuffer.shift();
        const smoothed = hs.posBuffer.reduce((acc, p) => ({ x: acc.x + p.x / hs.posBuffer.length, y: acc.y + p.y / hs.posBuffer.length }), { x: 0, y: 0 });
        if (hs.gesture === 'draw') {
            drawHandSegment(drawCtx, smoothed, i);
        }
        else if (hs.gesture === 'erase') {
            finishHandStroke(i);
            drawCtx.clearRect(smoothed.x - 20, smoothed.y - 20, 40, 40);
        }
        else if (hs.gesture === 'color-select' && i === 0) {
            drawColorStrip(overlayCtx, smoothed.x);
        }
        drawCursor(overlayCtx, smoothed.x, smoothed.y, hs.gesture);
    }
    const bothOpen = handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm';
    if (bothOpen) {
        if (bothPalmsStart === 0)
            bothPalmsStart = performance.now();
        const progress = Math.min(1, (performance.now() - bothPalmsStart) / CLEAR_HOLD_MS);
        drawClearIndicator(overlayCtx, progress);
        if (progress >= 1) {
            bothPalmsStart = 0;
            clearCanvas();
            onClear();
        }
    }
    else {
        bothPalmsStart = 0;
    }
}
function drawHandSegment(ctx: CanvasRenderingContext2D, pos: Point, handIndex: number) {
    const hs = handStates[handIndex];
    if (!hs.isDrawing) {
        hs.isDrawing = true;
        hs.currentStroke = [{ ...pos }];
    }
    else {
        const prev = hs.currentStroke[hs.currentStroke.length - 1];
        hs.currentStroke.push({ ...pos });
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
}
function finishHandStroke(handIndex: number) {
    const hs = handStates[handIndex];
    if (hs.isDrawing && hs.currentStroke.length > 1) {
        const stroke: Stroke = { points: hs.currentStroke, color: brushColor, width: brushSize };
        strokes.push(stroke);
        onStrokeComplete(stroke);
    }
    hs.isDrawing = false;
    hs.currentStroke = [];
}
function drawColorStrip(ctx: CanvasRenderingContext2D, handX: number) {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const stripX = 60;
    const stripW = cw - 120;
    const stripY = ch - 80;
    const stripH = 40;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(stripX - 16, stripY - 44, stripW + 32, stripH + 60, 18);
    ctx.fill();
    const grad = ctx.createLinearGradient(stripX, 0, stripX + stripW, 0);
    for (let i = 0; i <= 12; i++) {
        grad.addColorStop(i / 12, `hsl(${(i / 12) * 360}, 100%, 60%)`);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(stripX, stripY, stripW, stripH, 10);
    ctx.fill();
    const clampedX = Math.max(stripX, Math.min(stripX + stripW, handX));
    const hue = ((clampedX - stripX) / stripW) * 360;
    pendingWheelColor = `hsl(${hue.toFixed(0)}, 100%, 60%)`;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(clampedX, stripY - 2);
    ctx.lineTo(clampedX, stripY + stripH + 2);
    ctx.stroke();
    ctx.fillStyle = pendingWheelColor;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(clampedX, stripY - 14, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u270C Move hand across strip \u00B7 Lower index finger to apply', cw / 2, stripY - 34);
    ctx.restore();
}
function drawClearIndicator(ctx: CanvasRenderingContext2D, progress: number) {
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2;
    const r = 72;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff18';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🖐 🖐', cx, cy - 12);
    ctx.fillText('Hold to clear', cx, cy + 14);
    ctx.restore();
}
function clearCanvas() {
    const ctx = canvasEl.getContext('2d')!;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    strokes = [];
    handStates.forEach(hs => { hs.isDrawing = false; hs.currentStroke = []; });
}
function exportCanvas() {
    const link = document.createElement('a');
    link.download = 'hoverart.png';
    link.href = canvasEl.toDataURL('image/png');
    link.click();
}
function getCanvasDataUrl(): string {
    return canvasEl.toDataURL('image/png');
}
function drawPeerStroke(stroke: Stroke) {
    const ctx = canvasEl.getContext('2d')!;
    if (stroke.points.length < 2)
        return;
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[i - 1].x, stroke.points[i - 1].y);
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    strokes.push(stroke);
}
function clearFromPeer() {
    clearCanvas();
}
export { clearCanvas, exportCanvas, getCanvasDataUrl, strokes, drawPeerStroke, clearFromPeer };
function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, g: string) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle =
        g === 'draw' ? '#00f5ff' :
            g === 'erase' ? '#ff4444' :
                g === 'color-select' ? pendingWheelColor :
                    '#ffffff44';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}
let badgeLabel = $derived(handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm' ? '🖐 🖐 Hold to Clear' :
    gesture === 'draw' && gesture1 === 'draw' ? '✏ Drawing ×2' :
        gesture === 'draw' ? '✏ Drawing' :
            gesture === 'erase' ? '⬜ Erasing' :
                gesture === 'color-select' ? '✌ Picking Color' :
                    gesture === 'open-palm' ? '🖐 Open Palm' :
                        gesture1 === 'draw' ? '✏ Drawing (hand 2)' :
                            '✋ Hovering');
let badgeGesture = $derived(handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm' ? 'clear' :
    gesture !== 'none' ? gesture : gesture1);
</script>

<div class="relative w-full bg-[#0a0a0f] rounded-xl overflow-hidden font-mono">

  {#if isLoading}
    <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-white text-sm backdrop-blur-sm">
      <div class="spinner"></div>
      <p class="m-0">Loading MediaPipe…</p>
    </div>
  {/if}

  {#if error}
    <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-red-400 text-sm backdrop-blur-sm text-center">
      <p class="m-0">⚠ {error}</p>
      <small class="text-red-400/70">Check camera permissions and try again.</small>
    </div>
  {/if}

  <div class="absolute top-3 left-3 right-3 z-10 flex justify-between items-center pointer-events-none">
    <span class="gesture-badge" data-gesture={badgeGesture}>
      {badgeLabel}
    </span>
    <div class="flex items-center gap-2">
      <span class="mood-badge" data-mood={moodState}>
        {moodState === 'joyful' ? '😊 Joyful' : '😐 Neutral'}
      </span>
      <span class="text-xs text-white/25">
        {handsDetected} hand{handsDetected !== 1 ? 's' : ''} · {fps} fps
      </span>
    </div>
  </div>

  <div class="relative w-full aspect-video">
    <video
      bind:this={videoEl}
      class="absolute w-px h-px opacity-0 pointer-events-none"
      muted
      playsinline
    ></video>

    <canvas
      bind:this={canvasEl}
      class="absolute inset-0 w-full h-full -scale-x-100 bg-[#0d0d14]"
    ></canvas>

    <canvas
      bind:this={overlayEl}
      class="absolute inset-0 w-full h-full -scale-x-100 pointer-events-none"
    ></canvas>
  </div>

  <div class="absolute bottom-3 right-3 z-10 flex flex-col gap-1 pointer-events-none">
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">☝ Index up</span>
      <span>Draw</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">✌ Peace sign</span>
      <span>Pick Color</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">🤏 Pinch</span>
      <span>Erase</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">✋ Other</span>
      <span>Hover / Pause</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">🖐 🖐 Both palms</span>
      <span>Hold to Clear</span>
    </div>
  </div>
</div>

<style>
  .gesture-badge {
    padding: 4px 12px;
    border-radius: 99px;
    font-size: 0.8rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    background: #ffffff11;
    border: 1px solid #ffffff22;
    color: #aaa;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }

  .gesture-badge[data-gesture='draw'] {
    background: #00f5ff22;
    border-color: #00f5ff66;
    color: #00f5ff;
  }

  .gesture-badge[data-gesture='erase'] {
    background: #ff444422;
    border-color: #ff444466;
    color: #ff6666;
  }

  .gesture-badge[data-gesture='color-select'] {
    background: #a78bfa22;
    border-color: #a78bfa66;
    color: #a78bfa;
  }

  .gesture-badge[data-gesture='clear'] {
    background: #ff444422;
    border-color: #ff444466;
    color: #ff6666;
  }

  .mood-badge {
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    background: #ffffff08;
    border: 1px solid #ffffff15;
    color: #aaa;
    transition: background 0.4s, color 0.4s, border-color 0.4s;
  }

  .mood-badge[data-mood='joyful'] {
    background: #ffdd5722;
    border-color: #ffdd5755;
    color: #ffdd57;
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid #ffffff22;
    border-top-color: #00f5ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
