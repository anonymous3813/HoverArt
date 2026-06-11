import { PINCH_THRESHOLD } from '$lib/whiteboard/gestures.ts';

export interface HandCursor {
	x: number;
	y: number;
	pinching: boolean;
	visible: boolean;
}

export interface HitTarget {
	id: string;
	rect: DOMRect;
	meta?: Record<string, unknown>;
}

const PINCH_COOLDOWN_MS = 450;

export function landmarksToCursor(landmarks: { x: number; y: number; z?: number }[]): HandCursor {
	const indexTip = landmarks[8];
	const thumbTip = landmarks[4];
	const pinchDist = Math.hypot(
		indexTip.x - thumbTip.x,
		indexTip.y - thumbTip.y,
		((indexTip.z ?? 0) - (thumbTip.z ?? 0)) * 0.5
	);
	return {
		x: 1 - indexTip.x,
		y: indexTip.y,
		pinching: pinchDist < PINCH_THRESHOLD,
		visible: true
	};
}

export function cursorToScreen(cursor: HandCursor, width: number, height: number) {
	return { x: cursor.x * width, y: cursor.y * height };
}

export function findHitTarget(
	cursor: HandCursor,
	width: number,
	height: number,
	targets: HitTarget[]
): HitTarget | null {
	const { x, y } = cursorToScreen(cursor, width, height);
	for (const t of targets) {
		const r = t.rect;
		if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
	}
	return null;
}

export class PinchDetector {
	private wasPinching = false;
	private lastPinchTime = 0;

	check(cursor: HandCursor): boolean {
		const now = performance.now();
		const triggered = cursor.pinching && !this.wasPinching && now - this.lastPinchTime > PINCH_COOLDOWN_MS;
		if (triggered) this.lastPinchTime = now;
		this.wasPinching = cursor.pinching;
		return triggered;
	}
}

export function collectRects(root: HTMLElement, selector: string): HitTarget[] {
	const els = root.querySelectorAll<HTMLElement>(selector);
	return Array.from(els).map((el) => ({
		id: el.dataset.hitId ?? el.id,
		rect: el.getBoundingClientRect(),
		meta: { ...el.dataset }
	}));
}
