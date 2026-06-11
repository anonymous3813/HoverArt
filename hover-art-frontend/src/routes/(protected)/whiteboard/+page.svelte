<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, clearAuth } from '$lib/auth.svelte.ts';
	import { getBackendUrl } from '$lib/backendUrl';
	import { initHandLandmarker } from '$lib/mediapipe.ts';
	import { createSharedState } from '$lib/whiteboard/sharedMemory.ts';

	import { createScene } from '$lib/whiteboard/scene.svelte.ts';
	import { screenToWorld, zoomAround, pan as panTransform } from '$lib/whiteboard/transform.ts';
	import { createPinchDetector, twoFingerState } from '$lib/whiteboard/pinch.ts';
	import { hitTestToolbar, getToolbarLayout } from '$lib/whiteboard/toolbar';
	import type { ToolbarLayout } from '$lib/whiteboard/toolbar';
	import {
		TOOLS,
		TOOL_ICONS,
		TOOL_LABELS,
		DEFAULT_TRANSFORM,
		type Tool,
		type CanvasObject,
		type StrokeObject,
		type RectObject,
		type LineObject,
		type TextObject
	} from '$lib/whiteboard/types.ts';
	import { createRoomStore } from '$lib/stores/room.svelte';
	import { createNotebookStore } from '$lib/stores/notebook.svelte';
	import WhiteboardTopBar from '$lib/components/whiteboard/WhiteboardTopBar.svelte';
	import WhiteboardToolbar from '$lib/components/whiteboard/WhiteboardToolbar.svelte';
	import WhiteboardGestureHud from '$lib/components/whiteboard/WhiteboardGestureHud.svelte';
	import WhiteboardNotebookSidebar from '$lib/components/whiteboard/WhiteboardNotebookSidebar.svelte';
	import WhiteboardCollabPopover from '$lib/components/whiteboard/WhiteboardCollabPopover.svelte';
	import WhiteboardShareModal from '$lib/components/whiteboard/WhiteboardShareModal.svelte';
	import WhiteboardPerformanceOverlay from '$lib/components/whiteboard/WhiteboardPerformanceOverlay.svelte';

	const BACKEND_URL = getBackendUrl();

	// ── Performance metrics ───────────────────────────────────────────────────
	let fps = $state(0);
	let frameTimeMs = $state(0);
	let handInferenceMs = $state(0);
	let handsDetected = $state(0);

	let _lastFrameTime = 0;
	let _frameCount = 0;
	let _lastFpsFlush = performance.now();

	// ── Canvas / worker ───────────────────────────────────────────────────────
	let canvasEl: HTMLCanvasElement;
	let worker: Worker;

	// ── Scene ─────────────────────────────────────────────────────────────────
	const scene = createScene();

	/**
	 * COLD PATH — send full object list.
	 * Call only when objects actually change (commit, undo, redo, peer event,
	 * page switch, clear). Do NOT call during pan/zoom/drawing frames.
	 *
	 * $state proxies are not structured-cloneable, so we must unwrap them with
	 * $state.snapshot() before handing to postMessage.
	 */
	function syncObjects() {
		worker?.postMessage({ type: 'objects', objects: $state.snapshot(scene.objects) });
	}

	/**
	 * HOT PATH — send transform only (~24 bytes, no object serialisation).
	 * Call every frame during pan and zoom.
	 */
	function syncTransform() {
		const t = scene.transform;
		// Plain object literal — no proxy, safe to clone
		worker?.postMessage({ type: 'transform', transform: { x: t.x, y: t.y, scale: t.scale } });
	}

	// ── Tool state ────────────────────────────────────────────────────────────
	let activeTool = $state<Tool>('draw');
	let hoveredTool = $state<Tool | null>(null);
	let brushColor = $state('#00f5ff');
	let brushSize = $state(4);

	const PRESET_COLORS = [
		'#ffffff',
		'#00f5ff',
		'#ff4ecd',
		'#ffdd57',
		'#4eff91',
		'#ff6b35',
		'#a78bfa',
		'#f87171'
	];

	// ── Toolbar layout cache ───────────────────────────────────────────────────
	// getBoundingClientRect is a forced layout — cache it and only refresh on
	// resize, never inside the camera loop.
	let toolbarEl: HTMLDivElement;
	let toolbarLayout: ToolbarLayout | null = null;

	// Called by ResizeObserver and once after mount — never from cameraLoop
	function refreshToolbarLayout() {
		if (toolbarEl) toolbarLayout = getToolbarLayout(toolbarEl);
	}

	// ── Room store ────────────────────────────────────────────────────────────
	const room = createRoomStore();
	let showCollab = $state(false);
	let copied = $state(false);

	async function copyCode() {
		await navigator.clipboard.writeText(room.roomCode);
		copied = true;
		setTimeout(() => (copied = false), 1800);
	}

	// ── Notebook store ────────────────────────────────────────────────────────
	const notebook = createNotebookStore({
		onPageLoad(objects, transform) {
			scene.loadPage(objects, transform);
			syncObjects();
			syncTransform();
		},
		getSnapshot() {
			return { objects: scene.objects, transform: scene.transform, thumbnail: captureThumbnail() };
		}
	});

	function captureThumbnail(): string {
		try {
			const W = 120,
				H = 80;
			const tmp = document.createElement('canvas');
			tmp.width = W;
			tmp.height = H;
			const ctx = tmp.getContext('2d')!;
			ctx.fillStyle = '#0a0a14';
			ctx.fillRect(0, 0, W, H);
			const t = scene.transform;
			const sx = W / window.innerWidth,
				sy = H / window.innerHeight;
			ctx.save();
			ctx.translate(t.x * sx, t.y * sy);
			ctx.scale(t.scale * sx, t.scale * sy);
			for (const obj of scene.objects) {
				if (obj.kind === 'stroke' && obj.points.length >= 2) {
					ctx.beginPath();
					ctx.strokeStyle = obj.color;
					ctx.lineWidth = obj.width;
					ctx.lineCap = 'round';
					ctx.moveTo(obj.points[0].x, obj.points[0].y);
					for (let i = 1; i < obj.points.length; i++) ctx.lineTo(obj.points[i].x, obj.points[i].y);
					ctx.stroke();
				} else if (obj.kind === 'rect') {
					ctx.strokeStyle = obj.color;
					ctx.lineWidth = obj.strokeWidth;
					ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
				} else if (obj.kind === 'line') {
					ctx.beginPath();
					ctx.strokeStyle = obj.color;
					ctx.lineWidth = obj.width;
					ctx.moveTo(obj.x1, obj.y1);
					ctx.lineTo(obj.x2, obj.y2);
					ctx.stroke();
				}
			}
			ctx.restore();
			return tmp.toDataURL('image/webp', 0.6);
		} catch {
			return '';
		}
	}

	// ── Gesture state machine ─────────────────────────────────────────────────

	type GesturePhase = 'idle' | 'drawing' | 'panning' | 'two-finger' | 'shaping' | 'erasing';
	let phase = $state<GesturePhase>('idle');

	let shapeAnchor: { x: number; y: number } | null = null;
	let panAnchor: { x: number; y: number; tx: number; ty: number } | null = null;
	let twoFingerPrev: { mid: { x: number; y: number }; dist: number } | null = null;

	let textInput = $state('');
	let textPlacing = $state(false);
	let textPos = $state({ x: 0, y: 0 });
	let textWorldPos = { x: 0, y: 0 };
	let textInputEl: HTMLInputElement | null = null;

	const uid = () => Math.random().toString(36).slice(2);

	// ── Camera loop ───────────────────────────────────────────────────────────
	let video: HTMLVideoElement;
	let handLandmarker: Awaited<ReturnType<typeof initHandLandmarker>>;
	let shared: ReturnType<typeof createSharedState>;
	let pinchDetector: ReturnType<typeof createPinchDetector>;

	function cameraLoop() {
		const frameStart = performance.now();

		// FPS tracking
		_frameCount++;
		const elapsed = frameStart - _lastFpsFlush;
		if (elapsed >= 500) {
			fps = Math.round((_frameCount / elapsed) * 1000);
			_frameCount = 0;
			_lastFpsFlush = frameStart;
		}
		frameTimeMs = frameStart - _lastFrameTime;
		_lastFrameTime = frameStart;

		const inferStart = performance.now();
		const results = handLandmarker.detectForVideo(video, frameStart);
		handInferenceMs = performance.now() - inferStart;

		handsDetected = results.landmarks?.length ?? 0;

		if (!results.landmarks || results.landmarks.length === 0) {
			if (phase === 'drawing') commitStroke();
			if (phase === 'shaping') cancelShape();
			if (phase === 'panning') {
				phase = 'idle';
				panAnchor = null;
			}
			if (phase === 'two-finger') {
				phase = 'idle';
				twoFingerPrev = null;
			}
			shared.gestures[1] = 0;
			worker?.postMessage({ type: 'cursor', x: -1, y: -1, pinching: false, toolbarHit: false });
			requestAnimationFrame(cameraLoop);
			return;
		}

		const hand = results.landmarks[0];
		hand.map((pt) => (pt.x = 1 - pt.x));

		shared.gestures[1] = 1;

		// Write landmarks to SharedArrayBuffer — zero-copy, no postMessage
		let idx = 0;
		for (const pt of hand) {
			shared.landmarks[idx++] = pt.x;
			shared.landmarks[idx++] = pt.y;
			shared.landmarks[idx++] = pt.z;
		}

		const W = window.innerWidth,
			H = window.innerHeight;

		// ── Two-finger pan+zoom ───────────────────────────────────────────────
		const indexUp = hand[8].y < hand[5].y - 0.04;
		const middleUp = hand[12].y < hand[9].y - 0.04;
		const ringDown = hand[16].y > hand[13].y - 0.01;
		const pinkyDown = hand[20].y > hand[17].y - 0.01;

		if (indexUp && middleUp && ringDown && pinkyDown && activeTool !== 'text') {
			const tf = twoFingerState(hand, W, H);
			if (twoFingerPrev) {
				let t = panTransform(
					scene.transform,
					tf.mid.x - twoFingerPrev.mid.x,
					tf.mid.y - twoFingerPrev.mid.y
				);
				t = zoomAround(t, tf.mid, tf.dist / twoFingerPrev.dist);
				scene.setTransform(t);
				syncTransform(); // HOT PATH — transform only, no objects
			}
			twoFingerPrev = { mid: tf.mid, dist: tf.dist };
			phase = 'two-finger';
			worker?.postMessage({
				type: 'cursor',
				x: tf.mid.x,
				y: tf.mid.y,
				pinching: false,
				toolbarHit: false
			});
			requestAnimationFrame(cameraLoop);
			return;
		}
		twoFingerPrev = null;
		if (phase === 'two-finger') phase = 'idle';

		// ── Single-finger pinch ───────────────────────────────────────────────
		const { fingerPos, pinchJustDown, pinchJustUp, pinching } = pinchDetector.detect(hand);

		// Toolbar hit-test uses the cached layout — no DOM read here
		const { hoveredTool: ht } = toolbarLayout
			? hitTestToolbar(fingerPos.x, fingerPos.y, toolbarLayout)
			: { hoveredTool: null };
		hoveredTool = ht;

		worker?.postMessage({
			type: 'cursor',
			x: fingerPos.x,
			y: fingerPos.y,
			pinching,
			toolbarHit: ht !== null
		});

		// ── Pinch down ────────────────────────────────────────────────────────
		if (pinchJustDown) {
			if (ht !== null) {
				activeTool = ht;
				phase = 'idle';
			} else {
				const world = screenToWorld(fingerPos, scene.transform);
				switch (activeTool) {
					case 'pan':
						phase = 'panning';
						panAnchor = {
							x: fingerPos.x,
							y: fingerPos.y,
							tx: scene.transform.x,
							ty: scene.transform.y
						};
						break;
					case 'draw':
						phase = 'drawing';
						_strokePoints = [world];
						worker?.postMessage({ type: 'stroke_begin', color: brushColor, width: brushSize });
						worker?.postMessage({ type: 'stroke_point', x: world.x, y: world.y });
						break;
					case 'rect':
					case 'line':
					case 'arrow':
						phase = 'shaping';
						shapeAnchor = world;
						break;
					case 'text':
						textPos = { x: fingerPos.x, y: fingerPos.y };
						textWorldPos = world;
						textInput = '';
						textPlacing = true;
						tick().then(() => textInputEl?.focus());
						break;
					case 'erase':
						phase = 'erasing';
						eraseAt(fingerPos);
						break;
				}
			}
		}

		// ── Pinch held ────────────────────────────────────────────────────────
		if (pinching && phase !== 'idle') {
			const world = screenToWorld(fingerPos, scene.transform);
			switch (phase) {
				case 'drawing':
					// HOT PATH: one point only — worker appends to its buffer, we mirror locally
					_strokePoints.push(world);
					worker?.postMessage({ type: 'stroke_point', x: world.x, y: world.y });
					break;

				case 'panning':
					if (panAnchor) {
						scene.setTransform({
							...scene.transform,
							x: panAnchor.tx + (fingerPos.x - panAnchor.x),
							y: panAnchor.ty + (fingerPos.y - panAnchor.y)
						});
						syncTransform(); // HOT PATH — transform only
					}
					break;

				case 'shaping':
					if (shapeAnchor) updateShapePreview(world);
					break;

				case 'erasing':
					eraseAt(fingerPos);
					break;
			}
		}

		// ── Pinch release ─────────────────────────────────────────────────────
		if (pinchJustUp) {
			switch (phase) {
				case 'drawing':
					commitStroke();
					break;
				case 'shaping':
					commitShape(screenToWorld(fingerPos, scene.transform));
					break;
				case 'panning':
					panAnchor = null;
					break;
			}
			if (phase !== 'idle') phase = 'idle';
		}

		requestAnimationFrame(cameraLoop);
	}

	// ── Commit helpers ────────────────────────────────────────────────────────

	// The worker has been accumulating stroke points locally.
	// We ask it to discard the preview, then add the committed object to the
	// scene and send the full (now updated) object list once.
	function commitStroke() {
		worker?.postMessage({ type: 'stroke_end' });
		// Retrieve the accumulated points from the worker's buffer by re-reading
		// the main thread's own copy (we've been writing world coords there too)
		// — actually we track them here as well for the commit:
		if (_strokePoints.length < 2) {
			_strokePoints = [];
			return;
		}
		const obj: StrokeObject = {
			kind: 'stroke',
			id: uid(),
			points: [..._strokePoints],
			color: brushColor,
			width: brushSize
		};
		scene.addObject(obj);
		syncObjects(); // COLD PATH — objects changed
		room.emitObject(obj);
		_strokePoints = [];
	}

	// Mirror of the worker's stroke buffer on the main thread so commitStroke
	// can read the points without a round-trip message.
	// We populate it alongside the stroke_point messages.
	let _strokePoints: { x: number; y: number }[] = [];

	function makeShape(
		a: { x: number; y: number },
		b: { x: number; y: number },
		id: string
	): CanvasObject | null {
		switch (activeTool) {
			case 'rect':
				return {
					kind: 'rect',
					id,
					x: Math.min(a.x, b.x),
					y: Math.min(a.y, b.y),
					w: Math.abs(b.x - a.x),
					h: Math.abs(b.y - a.y),
					color: brushColor,
					strokeWidth: brushSize,
					fill: null
				} satisfies RectObject;
			case 'line':
				return {
					kind: 'line',
					id,
					x1: a.x,
					y1: a.y,
					x2: b.x,
					y2: b.y,
					color: brushColor,
					width: brushSize,
					arrow: false
				} satisfies LineObject;
			case 'arrow':
				return {
					kind: 'line',
					id,
					x1: a.x,
					y1: a.y,
					x2: b.x,
					y2: b.y,
					color: brushColor,
					width: brushSize,
					arrow: true
				} satisfies LineObject;
			default:
				return null;
		}
	}

	function updateShapePreview(world: { x: number; y: number }) {
		if (!shapeAnchor) return;
		const p = makeShape(shapeAnchor, world, '__preview__');
		if (p) worker?.postMessage({ type: 'preview', object: p });
	}

	function commitShape(world: { x: number; y: number }) {
		worker?.postMessage({ type: 'preview', object: null });
		if (!shapeAnchor) return;
		const obj = makeShape(shapeAnchor, world, uid());
		if (obj) {
			scene.addObject(obj);
			syncObjects();
			room.emitObject(obj);
		}
		shapeAnchor = null;
	}

	function cancelShape() {
		worker?.postMessage({ type: 'preview', object: null });
		shapeAnchor = null;
	}

	function commitText() {
		textPlacing = false;
		if (!textInput.trim()) return;
		const obj: TextObject = {
			kind: 'text',
			id: uid(),
			x: textWorldPos.x,
			y: textWorldPos.y,
			content: textInput,
			fontSize: 18,
			color: brushColor
		};
		scene.addObject(obj);
		syncObjects();
		room.emitObject(obj);
		textInput = '';
	}

	// ── Erase ─────────────────────────────────────────────────────────────────

	const ERASE_RADIUS_SCREEN = 30;

	function eraseAt(screenPos: { x: number; y: number }) {
		const worldPos = screenToWorld(screenPos, scene.transform);
		const worldRadius = ERASE_RADIUS_SCREEN / scene.transform.scale;
		const toRemove = new Set<string>();
		for (const obj of scene.objects) {
			if (objectIntersectsCircle(obj, worldPos, worldRadius)) toRemove.add(obj.id);
		}
		if (toRemove.size > 0) {
			scene.removeObjects(toRemove);
			syncObjects(); // COLD PATH — objects changed
			toRemove.forEach((id) => room.emitRemove(id));
		}
	}

	function objectIntersectsCircle(
		obj: CanvasObject,
		c: { x: number; y: number },
		r: number
	): boolean {
		switch (obj.kind) {
			case 'stroke':
				return obj.points.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < r);
			case 'rect':
				return (
					Math.hypot(obj.x + obj.w / 2 - c.x, obj.y + obj.h / 2 - c.y) <
					r + Math.max(obj.w, obj.h) / 2
				);
			case 'line':
				return distToSegment(c, { x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }) < r;
			case 'text':
				return Math.hypot(obj.x - c.x, obj.y - c.y) < r * 2;
		}
	}

	function distToSegment(
		p: { x: number; y: number },
		a: { x: number; y: number },
		b: { x: number; y: number }
	): number {
		const dx = b.x - a.x,
			dy = b.y - a.y,
			l2 = dx * dx + dy * dy;
		if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
		const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
		return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
	}

	// ── Mouse wheel + middle-button pan ───────────────────────────────────────

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		scene.setTransform(
			zoomAround(scene.transform, { x: e.clientX, y: e.clientY }, e.deltaY < 0 ? 1.08 : 1 / 1.08)
		);
		syncTransform(); // HOT PATH
	}

	let mousePanActive = false;
	let mousePanOrigin = { x: 0, y: 0, tx: 0, ty: 0 };

	function onMouseDown(e: MouseEvent) {
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			mousePanActive = true;
			mousePanOrigin = { x: e.clientX, y: e.clientY, tx: scene.transform.x, ty: scene.transform.y };
			e.preventDefault();
		}
	}
	function onMouseMove(e: MouseEvent) {
		if (!mousePanActive) return;
		scene.setTransform({
			...scene.transform,
			x: mousePanOrigin.tx + (e.clientX - mousePanOrigin.x),
			y: mousePanOrigin.ty + (e.clientY - mousePanOrigin.y)
		});
		syncTransform(); // HOT PATH
	}
	function onMouseUp() {
		mousePanActive = false;
	}

	// ── Share modal ───────────────────────────────────────────────────────────
	let showShare = $state(false);
	let shareEmail = $state('');
	let shareMessage = $state('');
	let shareStatus = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let shareError = $state('');

	function openShare() {
		shareEmail = '';
		shareMessage = '';
		shareStatus = 'idle';
		shareError = '';
		showShare = true;
	}

	async function sendEmail() {
		if (!shareEmail.trim()) return;
		shareStatus = 'sending';
		shareError = '';
		try {
			const res = await fetch(`${BACKEND_URL}/share-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					to: shareEmail.trim(),
					imageData: captureThumbnail(),
					message: shareMessage.trim()
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Unknown error');
			shareStatus = 'sent';
			setTimeout(() => {
				showShare = false;
				shareStatus = 'idle';
			}, 2000);
		} catch (err: any) {
			shareStatus = 'error';
			shareError = err.message;
		}
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	onMount(async () => {
		worker = new Worker(new URL('$lib/workers/renderWorker.ts', import.meta.url), {
			type: 'module'
		});
		const offscreen = canvasEl.transferControlToOffscreen();
		shared = createSharedState();

		worker.postMessage(
			{
				type: 'init',
				canvas: offscreen,
				landmarkBuffer: shared.landmarkBuffer,
				gestureBuffer: shared.gestureBuffer
			},
			[offscreen]
		);
		syncObjects();
		syncTransform();

		// ResizeObserver refreshes toolbar layout (the only place getBoundingClientRect is called)
		const ro = new ResizeObserver((entries) => {
			const e = entries[0];
			worker.postMessage({
				type: 'resize',
				width: e.contentRect.width,
				height: e.contentRect.height
			});
			refreshToolbarLayout();
		});
		ro.observe(canvasEl);

		// Initial toolbar layout after DOM settles
		await tick();
		refreshToolbarLayout();

		handLandmarker = await initHandLandmarker();
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		video.srcObject = stream;
		await video.play();

		pinchDetector = createPinchDetector(
			() => window.innerWidth,
			() => window.innerHeight
		);
		requestAnimationFrame(cameraLoop);

		room.init({
			onPeerObject(obj) {
				scene.addObjectSilent(obj);
				syncObjects();
			},
			onPeerRemove(id) {
				scene.removeObjectSilent(id);
				syncObjects();
			},
			onPeerClear() {
				scene.clearAllSilent();
				syncObjects();
			},
			onPeerScene(objects) {
				scene.loadPage(objects, scene.transform);
				syncObjects();
			}
		});
	});

	onDestroy(() => {
		room.destroy();
		worker?.terminate();
	});
</script>

<svelte:head>
	<title>HoverArt</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<video bind:this={video} autoplay playsinline class="hidden"></video>

<!-- ── CANVAS ────────────────────────────────────────────────────────────── -->
<canvas
	bind:this={canvasEl}
	class="fixed inset-0 z-0 h-full w-full"
	width={window?.innerWidth ?? 1920}
	height={window?.innerHeight ?? 1080}
	onwheel={onWheel}
	onmousedown={onMouseDown}
	onmousemove={onMouseMove}
	onmouseup={onMouseUp}
></canvas>

<WhiteboardTopBar
	{scene}
	{room}
	{notebook}
	onToggleCollab={() => (showCollab = !showCollab)}
	onOpenShare={openShare}
	onClear={() => {
		scene.clearAll();
		syncObjects();
		room.emitClear();
	}}
	onUndo={() => {
		scene.undo();
		syncObjects();
	}}
	onRedo={() => {
		scene.redo();
		syncObjects();
	}}
	onResetView={() => {
		scene.setTransform({ x: 0, y: 0, scale: 1 });
		syncTransform();
	}}
/>

<WhiteboardToolbar
	bind:toolbarEl
	{activeTool}
	{hoveredTool}
	{brushColor}
	{brushSize}
	presetColors={PRESET_COLORS}
	onToolSelect={(tool) => (activeTool = tool)}
	onBrushColorChange={(color) => (brushColor = color)}
	onBrushSizeChange={(size) => (brushSize = size)}
/>

<WhiteboardGestureHud {phase} {activeTool} />

<WhiteboardPerformanceOverlay
	{fps}
	{frameTimeMs}
	{handInferenceMs}
	{handsDetected}
/>

{#if textPlacing}
	<div class="pointer-events-none fixed z-30" style:left="{textPos.x}px" style:top="{textPos.y}px">
		<input
			bind:this={textInputEl}
			bind:value={textInput}
			class="pointer-events-auto min-w-[120px] border-b border-[#00f5ff]/60 bg-transparent px-1 py-0.5 text-white/90 caret-[#00f5ff] outline-none"
			style="font-family:'Space Mono', monospace; font-size: {18 * scene.transform.scale}px;"
			placeholder="Type here…"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === 'Escape') commitText();
			}}
			onblur={commitText}
		/>
	</div>
{/if}

<WhiteboardNotebookSidebar
	{notebook}
	open={notebook.sidebarOpen}
	onClose={() => (notebook.sidebarOpen = false)}
/>

<WhiteboardCollabPopover
	show={showCollab}
	{room}
	{copied}
	onClose={() => (showCollab = false)}
	onCopyCode={copyCode}
/>

<WhiteboardShareModal
	show={showShare}
	bind:shareEmail
	bind:shareMessage
	bind:shareStatus
	bind:shareError
	onClose={() => (showShare = false)}
	onSendEmail={sendEmail}
/>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
	}
	.swatch-active {
		border-color: rgba(255, 255, 255, 0.85);
		outline: 2px solid #00f5ff;
		outline-offset: 1px;
	}
	.brush-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 3px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.1);
		outline: none;
		cursor: pointer;
	}
	.brush-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: #0d0d1a;
		border: 2px solid #00f5ff;
		cursor: pointer;
	}
</style>
