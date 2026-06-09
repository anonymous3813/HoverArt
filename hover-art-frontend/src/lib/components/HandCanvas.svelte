<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { classifyGesture } from '$lib/whiteboard/gestures.ts';
	import { blendGet, blendshapeTable } from '$lib/face/blendshapeTable.ts';
	import PerformanceOverlay from './PerformanceOverlay.svelte';
	import {
		HandLandmarker,
		FaceLandmarker,
		FilesetResolver,
		DrawingUtils
	} from '@mediapipe/tasks-vision';
	import {
		drawColorStrip,
		drawClearIndicator,
		drawCursor,
		drawPeerStroke as drawPeerStrokeHelper
	} from '$lib/whiteboard/handCanvasUtils';

	type Point = { x: number; y: number };
	type Stroke = { points: Point[]; color: string; width: number };

	let {
		brushColor = $bindable('#ffffff'),
		brushSize = $bindable(4),
		moodState = $bindable<'joyful' | 'neutral'>('neutral'),
		onGestureChange = (_gesture: string) => {},
		onStrokeComplete = (_stroke: Stroke) => {},
		onClear = () => {}
	} = $props();

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

	let drawingUtils: DrawingUtils;

	const SMOOTH_SAMPLES = 5;
	const width = 1280;
	const height = 720;

	//Performance stats
	let handInferenceMs = $state(0);
	let faceInferenceMs = $state(0);
	let frameTimeMs = $state(0);

	type HandState = {
		isDrawing: boolean;
		currentStroke: Point[];
		xBuffer: Float32Array;
		yBuffer: Float32Array;
		bufferIndex: number;
		bufferCount: number;
		gesture: string;
	};

	const handStates: HandState[] = [
		{
			isDrawing: false,
			currentStroke: [],
			xBuffer: new Float32Array(SMOOTH_SAMPLES),
			yBuffer: new Float32Array(SMOOTH_SAMPLES),
			bufferIndex: 0,
			bufferCount: 0,
			gesture: 'none'
		},
		{
			isDrawing: false,
			currentStroke: [],
			xBuffer: new Float32Array(SMOOTH_SAMPLES),
			yBuffer: new Float32Array(SMOOTH_SAMPLES),
			bufferIndex: 0,
			bufferCount: 0,
			gesture: 'none'
		}
	];

	let strokes: Stroke[] = [];
	let pendingWheelColor = $state('#ffffff');
	let lastSmileCheck = 0;

	const CLEAR_HOLD_MS = 1500;
	let bothPalmsStart = 0;

	onMount(() => {
		drawingUtils = new DrawingUtils(overlayEl.getContext('2d')!);
	});

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
		stream?.getTracks().forEach((t) => t.stop());
		handLandmarker?.close();
		faceLandmarker?.close();
	});
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
			numHands: 2,
			minHandDetectionConfidence: 0.6,
			minHandPresenceConfidence: 0.6,
			minTrackingConfidence: 0.5
		});
		faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
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

		if (videoEl.readyState < 2) return;
		frameCount++;
		if (now - lastFpsTime >= 1000) {
			fps = frameCount;
			frameCount = 0;
			lastFpsTime = now;
		}
		if (now === lastTimestamp) return;
		lastTimestamp = now;
		const handDetectStart = performance.now();
		const handResult = handLandmarker.detectForVideo(videoEl, now);
		handInferenceMs = performance.now() - handDetectStart; 
		
		if (now - lastSmileCheck > 200) {
			lastSmileCheck = now;

			const faceDetectStart = performance.now();
			const faceResult = faceLandmarker.detectForVideo(videoEl, now);
			faceInferenceMs = performance.now() - faceDetectStart;

			if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
				const sym = blendshapeTable(faceResult.faceBlendshapes[0].categories);
				const smileL = blendGet(sym, 'mouthSmileLeft');
				const smileR = blendGet(sym, 'mouthSmileRight');
				const detected = (smileL + smileR) / 2 > 0.28 ? 'joyful' : 'neutral';
				if (detected !== moodState) moodState = detected;
			}
		}

		processResult(handResult);
	}
	function processResult(result: any) {
		const overlayCtx = overlayEl.getContext('2d')!;
		const drawCtx = canvasEl.getContext('2d')!;
		//const drawingUtils = new DrawingUtils(overlayCtx);
		overlayCtx.clearRect(0, 0, overlayEl.width, overlayEl.height);
		handsDetected = result.landmarks.length;
		for (let i = 0; i < 2; i++) {
			if (i >= result.landmarks.length) {
				if (handStates[i].isDrawing) finishHandStroke(i);
				if (i === 0 && handStates[0].gesture === 'color-select') brushColor = pendingWheelColor;
				handStates[i].gesture = 'none';
				handStates[i].bufferCount = 0;
				handStates[i].bufferIndex = 0;
				if (i === 0) {
					gesture = 'none';
					onGestureChange('none');
				}
				if (i === 1) gesture1 = 'none';
				continue;
			}

			const landmarks = result.landmarks[i];
			const mirroredLandmarks = landmarks.map((lm) => ({ ...lm, x: 1 - lm.x }));

			drawingUtils.drawConnectors(mirroredLandmarks, HandLandmarker.HAND_CONNECTIONS, {
				color: i === 0 ? '#00f5ff44' : '#ff4ecd44',
				lineWidth: 1
			});
			drawingUtils.drawLandmarks(mirroredLandmarks, {
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
					if (prev === 'color-select') brushColor = pendingWheelColor;
				} else {
					gesture1 = detectedGesture;
				}
				if (detectedGesture !== 'draw') finishHandStroke(i);
			}

			const tip = landmarks[8];
			const rawX = (1 - tip.x) * canvasEl.width;
			const rawY = tip.y * canvasEl.height;

			hs.xBuffer[hs.bufferIndex] = rawX;
			hs.yBuffer[hs.bufferIndex] = rawY;
			hs.bufferIndex = (hs.bufferIndex + 1) % SMOOTH_SAMPLES;
			if (hs.bufferCount < SMOOTH_SAMPLES) hs.bufferCount++;

			let sumX = 0;
			let sumY = 0;
			for (let j = 0; j < hs.bufferCount; j++) {
				sumX += hs.xBuffer[j];
				sumY += hs.yBuffer[j];
			}
			const smoothed = { x: sumX / hs.bufferCount, y: sumY / hs.bufferCount };

			if (hs.gesture === 'draw') {
				drawHandSegment(drawCtx, smoothed, i);
			} else if (hs.gesture === 'erase') {
				finishHandStroke(i);
				drawCtx.clearRect(smoothed.x - 20, smoothed.y - 20, 40, 40);
			} else if (hs.gesture === 'color-select' && i === 0) {
				pendingWheelColor = drawColorStrip(overlayCtx, smoothed.x);
			}

			drawCursor(
				overlayCtx,
				smoothed.x,
				smoothed.y,
				hs.gesture,
				brushSize,
				brushColor,
				pendingWheelColor
			);
		}
		const bothOpen = handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm';
		if (bothOpen) {
			if (bothPalmsStart === 0) bothPalmsStart = performance.now();
			const progress = Math.min(1, (performance.now() - bothPalmsStart) / CLEAR_HOLD_MS);
			drawClearIndicator(overlayCtx, progress);
			if (progress >= 1) {
				bothPalmsStart = 0;
				clearCanvas();
				onClear();
			}
		} else {
			bothPalmsStart = 0;
		}
	}
	function drawHandSegment(ctx: CanvasRenderingContext2D, pos: Point, handIndex: number) {
		const hs = handStates[handIndex];
		if (!hs.isDrawing) {
			hs.isDrawing = true;
			hs.currentStroke = [pos];
		} else {
			const prev = hs.currentStroke[hs.currentStroke.length - 1];
			hs.currentStroke.push(pos);
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
	// ── Public API ──────────────────────────────────────────────────────────────

	/**
	 * Clear the drawing canvas.
	 * @param emit  When false, skips calling onClear() — used for silent page switches.
	 */
	function clearCanvas(emit = true) {
		const ctx = canvasEl.getContext('2d')!;
		ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		strokes = [];
		handStates.forEach((hs) => {
			hs.isDrawing = false;
			hs.currentStroke = [];
		});
		if (emit) onClear();
	}

	/** Restore a previously saved page snapshot onto the canvas. */
	function loadSnapshot(dataUrl: string) {
		const ctx = canvasEl.getContext('2d')!;
		const img = new Image();
		img.onload = () => ctx.drawImage(img, 0, 0);
		img.src = dataUrl;
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
		drawPeerStrokeHelper(canvasEl, stroke);
		strokes.push(stroke);
	}

	function clearFromPeer() {
		clearCanvas(false); // don't re-broadcast
	}

	export {
		clearCanvas,
		loadSnapshot,
		exportCanvas,
		getCanvasDataUrl,
		strokes,
		drawPeerStroke,
		clearFromPeer
	};

	// ── Badge derivations ───────────────────────────────────────────────────────

	// drawCursor moved to handCanvasUtils
	let badgeLabel = $derived(
		handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm'
			? '🖐 🖐 Hold to Clear'
			: gesture === 'draw' && gesture1 === 'draw'
				? '✏ Drawing ×2'
				: gesture === 'draw'
					? '✏ Drawing'
					: gesture === 'erase'
						? '⬜ Erasing'
						: gesture === 'color-select'
							? '✌ Picking Color'
							: gesture === 'open-palm'
								? '🖐 Open Palm'
								: gesture === 'l_shape'
									? '︻ Hold for Sidebar…'
									: gesture === 'thumb_up'
										? '☝ Prev Page'
										: gesture === 'thumb_down'
											? '👇 Next Page'
											: gesture === 'pinky_up'
												? '☝ Pinky Up'
												: gesture === 'quiet_coyote'
													? '🤘  Quiet Coyote'
													: gesture1 === 'draw'
														? '✏ Drawing (hand 2)'
														: '✋ Hovering'
	);

	let badgeGesture = $derived(
		handStates[0].gesture === 'open-palm' && handStates[1].gesture === 'open-palm'
			? 'clear'
			: gesture !== 'none'
				? gesture
				: gesture1
	);
</script>

<div class="relative w-full overflow-hidden rounded-xl bg-[#0a0a0f] font-mono">
	{#if isLoading}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-sm text-white backdrop-blur-sm"
		>
			<div class="spinner"></div>
			<p class="m-0">Loading MediaPipe…</p>
		</div>
	{/if}

	{#if error}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0fcc] text-center text-sm text-red-400 backdrop-blur-sm"
		>
			<p class="m-0">⚠ {error}</p>
			<small class="text-red-400/70">Check camera permissions and try again.</small>
		</div>
	{/if}

	<div
		class="pointer-events-none absolute top-3 right-3 left-3 z-10 flex items-center justify-between"
	>
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

	<PerformanceOverlay {fps} {frameTimeMs} {handInferenceMs} {faceInferenceMs} {handsDetected} />

	<div class="relative aspect-video w-full">
		<video
			bind:this={videoEl}
			class="pointer-events-none absolute h-px w-px opacity-0"
			muted
			playsinline
		></video>

		<canvas bind:this={canvasEl} class="absolute inset-0 h-full w-full bg-[#0d0d14]"></canvas>

		<canvas bind:this={overlayEl} class="pointer-events-none absolute inset-0 h-full w-full"
		></canvas>
	</div>

	<div class="pointer-events-none absolute right-3 bottom-3 z-10 flex flex-col gap-1">
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">☝ Index up</span>
			<span>Draw</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">✌ Peace sign</span>
			<span>Pick Color</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">🤏 Pinch</span>
			<span>Erase</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">✋ Other</span>
			<span>Hover / Pause</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">🖐 🖐 Both palms</span>
			<span>Hold to Clear</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">︻ L-shape</span>
			<span>Hold 2s · Sidebar</span>
		</div>
		<div class="flex gap-2.5 text-[0.7rem] text-white/35">
			<span class="min-w-[90px] text-white/55">☝↑ / 👇↓</span>
			<span>Prev / Next page</span>
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
		transition:
			background 0.2s,
			color 0.2s,
			border-color 0.2s;
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

	.gesture-badge[data-gesture='l_shape'] {
		background: #ffdd5722;
		border-color: #ffdd5766;
		color: #ffdd57;
	}

	.gesture-badge[data-gesture='point_up'],
	.gesture-badge[data-gesture='point_down'] {
		background: #4eff9122;
		border-color: #4eff9166;
		color: #4eff91;
	}

	.mood-badge {
		padding: 3px 10px;
		border-radius: 99px;
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		background: #ffffff08;
		border: 1px solid #ffffff15;
		color: #aaa;
		transition:
			background 0.4s,
			color 0.4s,
			border-color 0.4s;
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
		to {
			transform: rotate(360deg);
		}
	}
</style>
