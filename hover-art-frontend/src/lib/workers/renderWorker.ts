import type { WorkerInbound, CanvasObject, Transform, Point } from '../whiteboard/types';
import { LANDMARK_FLOAT_COUNT } from '../whiteboard/sharedMemory';
import { drawObject, drawCursor, drawPreview } from '../whiteboard/renderer';

// ── Canvas / context ──────────────────────────────────────────────────────────
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let landmarks: Float32Array;
let gestures: Uint8Array;

// ── Scene state ───────────────────────────────────────────────────────────────
let objects: CanvasObject[] = [];
let transform: Transform = { x: 0, y: 0, scale: 1 };
let preview: CanvasObject | null = null;

// ── Incremental stroke preview ────────────────────────────────────────────────
// Instead of receiving the full growing point array every frame, the main
// thread sends stroke_begin once, then one stroke_point per frame.
// We build the array here and draw it directly — zero redundant serialisation.
let strokePreviewPoints: Point[] = [];
let strokePreviewColor = '#00f5ff';
let strokePreviewWidth = 4;
let strokePreviewActive = false;

// ── Cursor state ──────────────────────────────────────────────────────────────
let cursorX = -1;
let cursorY = -1;
let pinching = false;
let toolbarHit = false;

// ── Render loop ───────────────────────────────────────────────────────────────

function drawFrame() {
	const W = canvas.width,
		H = canvas.height;
	ctx.clearRect(0, 0, W, H);

	// ── World-space objects ───────────────────────────────────────────────────
	ctx.save();
	ctx.translate(transform.x, transform.y);
	ctx.scale(transform.scale, transform.scale);

	for (const obj of objects) drawObject(ctx, obj);

	// In-progress freehand stroke (incremental, built here in the worker)
	if (strokePreviewActive && strokePreviewPoints.length >= 2) {
		ctx.beginPath();
		ctx.strokeStyle = strokePreviewColor;
		ctx.lineWidth = strokePreviewWidth;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.moveTo(strokePreviewPoints[0].x, strokePreviewPoints[0].y);
		for (let i = 1; i < strokePreviewPoints.length; i++) {
			ctx.lineTo(strokePreviewPoints[i].x, strokePreviewPoints[i].y);
		}
		ctx.stroke();
	}

	// In-progress shape preview (dashed)
	if (preview) drawPreview(ctx, preview);

	ctx.restore();

	// ── Hand landmarks (screen space, read directly from SharedArrayBuffer) ───
	if (gestures?.[1] > 0) {
		const count = LANDMARK_FLOAT_COUNT / 3;

		// All dots — single path
		ctx.beginPath();
		for (let i = 0; i < count * 3; i += 3) {
			const lx = landmarks[i] * W;
			const ly = landmarks[i + 1] * H;
			ctx.moveTo(lx + 3, ly);
			ctx.arc(lx, ly, 3, 0, Math.PI * 2);
		}
		ctx.fillStyle = 'rgba(0,245,255,0.2)';
		ctx.fill();

		// Thumb tip
		const tx = landmarks[4 * 3] * W;
		const ty = landmarks[4 * 3 + 1] * H;
		ctx.beginPath();
		ctx.arc(tx, ty, 5, 0, Math.PI * 2);
		ctx.fillStyle = pinching ? '#00f5ff' : 'rgba(0,245,255,0.35)';
		ctx.fill();
	}

	// ── Cursor (screen space) ─────────────────────────────────────────────────
	if (cursorX >= 0) drawCursor(ctx, cursorX, cursorY, pinching, toolbarHit, '#00f5ff');

	requestAnimationFrame(drawFrame);
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<WorkerInbound>) => {
	const msg = event.data;

	switch (msg.type) {
		// ── Setup ─────────────────────────────────────────────────────────────
		case 'init':
			canvas = msg.canvas;
			ctx = canvas.getContext('2d')!;
			landmarks = new Float32Array(msg.landmarkBuffer);
			gestures = new Uint8Array(msg.gestureBuffer);
			drawFrame();
			break;

		case 'resize':
			if (canvas) {
				canvas.width = msg.width;
				canvas.height = msg.height;
			}
			break;

		// ── Cold path — full scene ─────────────────────────────────────────────
		case 'objects':
			objects = msg.objects;
			break;

		// ── Hot path — transform only ──────────────────────────────────────────
		case 'transform':
			transform = msg.transform;
			break;

		// ── Hot path — incremental stroke preview ──────────────────────────────
		case 'stroke_begin':
			strokePreviewPoints = [];
			strokePreviewColor = msg.color;
			strokePreviewWidth = msg.width;
			strokePreviewActive = true;
			break;

		case 'stroke_point':
			strokePreviewPoints.push({ x: msg.x, y: msg.y });
			break;

		case 'stroke_end':
			strokePreviewActive = false;
			strokePreviewPoints = [];
			break;

		// ── Hot path — shape preview ───────────────────────────────────────────
		case 'preview':
			preview = msg.object;
			break;

		// ── Hot path — cursor ──────────────────────────────────────────────────
		case 'cursor':
			cursorX = msg.x;
			cursorY = msg.y;
			pinching = msg.pinching;
			toolbarHit = msg.toolbarHit;
			break;
	}
};
