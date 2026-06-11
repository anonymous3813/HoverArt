import type { CanvasObject, Transform, Point } from './types.ts';

/** Draw a single canvas object. ctx must already have the world transform applied. */
export function drawObject(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject) {
	switch (obj.kind) {
		case 'stroke':  drawStroke(ctx, obj);  break;
		case 'rect':    drawRect(ctx, obj);    break;
		case 'line':    drawLine(ctx, obj);    break;
		case 'text':    drawText(ctx, obj);    break;
	}
}

function drawStroke(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject & { kind: 'stroke' }) {
	if (obj.points.length < 2) return;
	ctx.beginPath();
	ctx.strokeStyle = obj.color;
	ctx.lineWidth   = obj.width;
	ctx.lineCap     = 'round';
	ctx.lineJoin    = 'round';
	ctx.moveTo(obj.points[0].x, obj.points[0].y);
	for (let i = 1; i < obj.points.length; i++) {
		ctx.lineTo(obj.points[i].x, obj.points[i].y);
	}
	ctx.stroke();
}

function drawRect(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject & { kind: 'rect' }) {
	if (obj.fill) {
		ctx.fillStyle = obj.fill;
		ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
	}
	ctx.strokeStyle = obj.color;
	ctx.lineWidth   = obj.strokeWidth;
	ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
}

function drawLine(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject & { kind: 'line' }) {
	ctx.beginPath();
	ctx.strokeStyle = obj.color;
	ctx.lineWidth   = obj.width;
	ctx.lineCap     = 'round';
	ctx.moveTo(obj.x1, obj.y1);
	ctx.lineTo(obj.x2, obj.y2);
	ctx.stroke();

	if (obj.arrow) {
		drawArrowHead(ctx, obj.x1, obj.y1, obj.x2, obj.y2, obj.color, obj.width);
	}
}

function drawArrowHead(
	ctx: OffscreenCanvasRenderingContext2D,
	x1: number, y1: number, x2: number, y2: number,
	color: string, lineWidth: number,
) {
	const angle  = Math.atan2(y2 - y1, x2 - x1);
	const size   = Math.max(lineWidth * 4, 12);
	const spread = Math.PI / 6;

	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.moveTo(x2, y2);
	ctx.lineTo(x2 - size * Math.cos(angle - spread), y2 - size * Math.sin(angle - spread));
	ctx.lineTo(x2 - size * Math.cos(angle + spread), y2 - size * Math.sin(angle + spread));
	ctx.closePath();
	ctx.fill();
}

function drawText(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject & { kind: 'text' }) {
	ctx.fillStyle = obj.color;
	ctx.font      = `${obj.fontSize}px 'Space Mono', monospace`;
	ctx.fillText(obj.content, obj.x, obj.y);
}

// ─── Cursor overlay (drawn in screen space, outside world transform) ──────────

export function drawCursor(
	ctx: OffscreenCanvasRenderingContext2D,
	x: number, y: number,
	pinching: boolean,
	toolbarHit: boolean,
	color: string,
) {
	const radius = pinching ? 6 : 10;
	const alpha  = pinching ? 0.9 : 0.7;

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.strokeStyle = color;
	ctx.lineWidth   = 2;
	ctx.globalAlpha = alpha;
	ctx.stroke();

	if (pinching) {
		// Filled dot when pinching
		ctx.beginPath();
		ctx.arc(x, y, 4, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
	}

	if (toolbarHit) {
		// Outer ring pulse effect
		ctx.beginPath();
		ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
		ctx.strokeStyle = color;
		ctx.lineWidth   = 1;
		ctx.globalAlpha = 0.3;
		ctx.stroke();
	}

	ctx.globalAlpha = 1;
}

// ─── Preview shape (dashed, in world space, for in-progress rect/line) ───────

export function drawPreview(ctx: OffscreenCanvasRenderingContext2D, obj: CanvasObject) {
	ctx.save();
	ctx.setLineDash([6, 4]);
	ctx.globalAlpha = 0.7;
	drawObject(ctx, obj);
	ctx.restore();
}