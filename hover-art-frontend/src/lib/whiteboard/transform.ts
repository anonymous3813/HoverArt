import type { Transform, Point } from './types.ts';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 20;

/** Convert a screen-space point to world space. */
export function screenToWorld(p: Point, t: Transform): Point {
	return {
		x: (p.x - t.x) / t.scale,
		y: (p.y - t.y) / t.scale
	};
}

/** Convert a world-space point to screen space. */
export function worldToScreen(p: Point, t: Transform): Point {
	return {
		x: p.x * t.scale + t.x,
		y: p.y * t.scale + t.y
	};
}

/**
 * Zoom the transform toward a focal point in screen space.
 * focal stays stationary on screen while the world scales around it.
 */
export function zoomAround(t: Transform, focal: Point, factor: number): Transform {
	const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
	const actualFactor = newScale / t.scale;
	return {
		x: focal.x - (focal.x - t.x) * actualFactor,
		y: focal.y - (focal.y - t.y) * actualFactor,
		scale: newScale
	};
}

/** Pan the transform by a screen-space delta. */
export function pan(t: Transform, dx: number, dy: number): Transform {
	return { ...t, x: t.x + dx, y: t.y + dy };
}

/** CSS transform string for the world container div. */
export function transformCSS(t: Transform): string {
	return `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}
