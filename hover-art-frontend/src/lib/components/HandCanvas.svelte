<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    HandLandmarker,
    FilesetResolver,
    DrawingUtils
  } from '@mediapipe/tasks-vision';

  // --- Props ---
  let {
    brushColor = $bindable('#ffffff'),
    brushSize = $bindable(4),
    onGestureChange = (gesture: string) => {}
  } = $props();

  // --- State ---
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let gesture = $state('none');
  let fps = $state(0);
  let handsDetected = $state(0);

  // --- Refs ---
  let videoEl: HTMLVideoElement;
  let canvasEl: HTMLCanvasElement;
  let overlayEl: HTMLCanvasElement;

  // --- Internal ---
  let handLandmarker: HandLandmarker;
  let animFrameId: number;
  let stream: MediaStream;
  let lastTimestamp = -1;
  let lastFpsTime = performance.now();
  let frameCount = 0;

  let isDrawing = false;
  let currentStroke: { x: number; y: number }[] = [];
  let strokes: { points: { x: number; y: number }[]; color: string; width: number }[] = [];

  const SMOOTH_SAMPLES = 5;
  let posBuffer: { x: number; y: number }[] = [];

  const PINCH_THRESHOLD = 0.06;
  const FIST_THRESHOLD  = 0.12;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(async () => {
    try {
      await initMediaPipe();
      await initCamera();
      isLoading = false;
      renderLoop();
    } catch (e: any) {
      error = e.message;
      isLoading = false;
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(animFrameId);
    stream?.getTracks().forEach(t => t.stop());
    handLandmarker?.close();
  });

  // ---------------------------------------------------------------------------
  // MediaPipe init
  // ---------------------------------------------------------------------------
  async function initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
  }

  async function initCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' }
    });
    videoEl.srcObject = stream;
    await new Promise<void>((res) => (videoEl.onloadedmetadata = () => res()));
    await videoEl.play();

    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    canvasEl.width = w;
    canvasEl.height = h;
    overlayEl.width = w;
    overlayEl.height = h;
  }

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------
  function renderLoop() {
    animFrameId = requestAnimationFrame(renderLoop);

    const now = performance.now();
    if (videoEl.readyState < 2) return;

    frameCount++;
    if (now - lastFpsTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastFpsTime = now;
    }

    if (now === lastTimestamp) return;
    lastTimestamp = now;

    const result = handLandmarker.detectForVideo(videoEl, now);
    processResult(result, now);
  }

  // ---------------------------------------------------------------------------
  // Process landmarks
  // ---------------------------------------------------------------------------
  function processResult(result: any, _timestamp: number) {
    const overlayCtx = overlayEl.getContext('2d')!;
    const drawCtx    = canvasEl.getContext('2d')!;
    const drawingUtils = new DrawingUtils(overlayCtx);

    overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
    handsDetected = result.landmarks.length;

    if (result.landmarks.length === 0) {
      if (isDrawing) finishStroke();
      gesture = 'none';
      onGestureChange('none');
      return;
    }

    const landmarks = result.landmarks[0];

    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: '#00f5ff44',
      lineWidth: 1
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: '#00f5ffaa',
      fillColor: '#00f5ff33',
      lineWidth: 1,
      radius: 3
    });

    const detectedGesture = classifyGesture(landmarks);
    if (detectedGesture !== gesture) {
      gesture = detectedGesture;
      onGestureChange(detectedGesture);
      if (gesture !== 'draw') finishStroke();
    }

    const tip = landmarks[8];
    const rawX = (1 - tip.x) * canvasEl.width;
    const rawY = tip.y * canvasEl.height;

    posBuffer.push({ x: rawX, y: rawY });
    if (posBuffer.length > SMOOTH_SAMPLES) posBuffer.shift();
    const smoothed = posBuffer.reduce(
      (acc, p) => ({ x: acc.x + p.x / posBuffer.length, y: acc.y + p.y / posBuffer.length }),
      { x: 0, y: 0 }
    );

    if (gesture === 'draw') {
      drawAt(drawCtx, smoothed.x, smoothed.y);
    } else if (gesture === 'erase') {
      eraseAt(drawCtx, smoothed.x, smoothed.y);
    }

    drawCursor(overlayCtx, smoothed.x, smoothed.y);
  }

  // ---------------------------------------------------------------------------
  // Gesture classification
  // ---------------------------------------------------------------------------
  function classifyGesture(landmarks: any[]) {
    const thumbTip  = landmarks[4];
    const indexTip  = landmarks[8];
    const indexPip  = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip   = landmarks[16];
    const ringPip   = landmarks[14];
    const pinkyTip  = landmarks[20];
    const pinkyPip  = landmarks[18];

    const dist = (a: any, b: any) =>
      Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

    const pinchDist = dist(thumbTip, indexTip);
    if (pinchDist < PINCH_THRESHOLD) return 'erase';

    const indexExtended = indexTip.y < indexPip.y;
    const middleCurled  = middleTip.y > middlePip.y;
    const ringCurled    = ringTip.y > ringPip.y;
    const pinkyCurled   = pinkyTip.y > pinkyPip.y;

    if (indexExtended && middleCurled && ringCurled && pinkyCurled) return 'draw';

    return 'none';
  }

  // ---------------------------------------------------------------------------
  // Canvas drawing
  // ---------------------------------------------------------------------------
  function drawAt(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!isDrawing) {
      isDrawing = true;
      currentStroke = [{ x, y }];
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      currentStroke.push({ x, y });
      ctx.lineTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  function eraseAt(ctx: CanvasRenderingContext2D, x: number, y: number) {
    finishStroke();
    ctx.clearRect(x - 20, y - 20, 40, 40);
  }

  function finishStroke() {
    if (isDrawing && currentStroke.length > 1) {
      strokes.push({ points: currentStroke, color: brushColor, width: brushSize });
    }
    isDrawing = false;
    currentStroke = [];
  }

  function clearCanvas() {
    const ctx = canvasEl.getContext('2d')!;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    strokes = [];
  }

  function exportCanvas() {
    const link = document.createElement('a');
    link.download = 'hoverart.png';
    link.href = canvasEl.toDataURL('image/png');
    link.click();
  }

  export { clearCanvas, exportCanvas, strokes };

  // ---------------------------------------------------------------------------
  // Cursor overlay
  // ---------------------------------------------------------------------------
  function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle =
      gesture === 'draw'  ? '#00f5ff' :
      gesture === 'erase' ? '#ff4444' :
                            '#ffffff44';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
</script>

<!-- Root -->
<div class="relative w-full bg-[#0a0a0f] rounded-xl overflow-hidden font-mono">

  <!-- Loading overlay -->
  {#if isLoading}
    <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-white text-sm backdrop-blur-sm">
      <div class="spinner"></div>
      <p class="m-0">Loading MediaPipe…</p>
    </div>
  {/if}

  <!-- Error overlay -->
  {#if error}
    <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-red-400 text-sm backdrop-blur-sm text-center">
      <p class="m-0">⚠ {error}</p>
      <small class="text-red-400/70">Check camera permissions and try again.</small>
    </div>
  {/if}

  <!-- Status bar -->
  <div class="absolute top-3 left-3 right-3 z-10 flex justify-between items-center pointer-events-none">
    <span class="gesture-badge" data-gesture={gesture}>
      {gesture === 'draw'  ? '✏ Drawing'  :
       gesture === 'erase' ? '⬜ Erasing' :
                             '✋ Hovering'}
    </span>
    <span class="text-xs text-white/25">
      {handsDetected} hand{handsDetected !== 1 ? 's' : ''} · {fps} fps
    </span>
  </div>

  <!-- Canvas stack -->
  <div class="relative w-full aspect-video">
    <!-- Hidden video feed -->
    <video
      bind:this={videoEl}
      class="absolute w-px h-px opacity-0 pointer-events-none"
      muted
      playsinline
    ></video>

    <!-- Drawing layer -->
    <canvas
      bind:this={canvasEl}
      class="absolute inset-0 w-full h-full -scale-x-100 bg-[#0d0d14]"
    ></canvas>

    <!-- Skeleton overlay -->
    <canvas
      bind:this={overlayEl}
      class="absolute inset-0 w-full h-full -scale-x-100 pointer-events-none"
    ></canvas>
  </div>

  <!-- Legend -->
  <div class="absolute bottom-3 right-3 z-10 flex flex-col gap-1 pointer-events-none">
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">☝ Index up</span>
      <span>Draw</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">🤏 Pinch</span>
      <span>Erase</span>
    </div>
    <div class="flex gap-2.5 text-[0.7rem] text-white/35">
      <span class="text-white/55 min-w-[90px]">✋ Other</span>
      <span>Hover / Pause</span>
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