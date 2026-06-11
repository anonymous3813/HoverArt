/**
 * Pinch gesture detector.
 *
 * Reads raw MediaPipe landmark arrays and produces:
 * - fingerPos:   screen-space position of index fingertip (lm 8)
 * - thumbPos:    screen-space position of thumb tip (lm 4)
 * - pinching:    whether index+thumb are close enough to constitute a "click"
 * - pinchDelta:  change in pinch distance this frame (for zoom-on-pinch if needed)
 * - twoFingerMid / twoFingerDist: for pan+zoom via index+middle spread
 */

export interface PinchState {
	fingerPos: { x: number; y: number };
	thumbPos: { x: number; y: number };
	pinching: boolean;
	wasPinching: boolean;
	pinchJustDown: boolean; // leading edge this frame
	pinchJustUp: boolean; // trailing edge this frame
	pinchDist: number; // current index-thumb screen distance
}

export interface TwoFingerState {
	mid: { x: number; y: number };
	dist: number;
	valid: boolean;
}

const PINCH_CLOSE_THRESHOLD = 48; // px — enter pinch
const PINCH_OPEN_HYSTERESIS = 64; // px — exit pinch (hysteresis to avoid flicker)

export function createPinchDetector(
	viewW: () => number,
	viewH: () => number
): { detect: (hand: { x: number; y: number; z: number }[]) => PinchState } {
	let wasPinching = false;

	/**
	 * Call once per frame with the raw landmark array for ONE hand
	 * (results.landmarks[0]).
	 * lm[i] has {x, y} in normalised 0-1 space.
	 */
	function detect(hand: { x: number; y: number; z: number }[]): PinchState {
		const W = viewW();
		const H = viewH();

		const fingerPos = { x: hand[8].x * W, y: hand[8].y * H };
		const thumbPos = { x: hand[4].x * W, y: hand[4].y * H };

		const dx = fingerPos.x - thumbPos.x;
		const dy = fingerPos.y - thumbPos.y;
		const pinchDist = Math.hypot(dx, dy);

		const threshold = wasPinching ? PINCH_OPEN_HYSTERESIS : PINCH_CLOSE_THRESHOLD;
		const pinching = pinchDist < threshold;

		const pinchJustDown = pinching && !wasPinching;
		const pinchJustUp = !pinching && wasPinching;
		const prevPinching = wasPinching;
		wasPinching = pinching;

		return {
			fingerPos,
			thumbPos,
			pinching,
			wasPinching: prevPinching,
			pinchJustDown,
			pinchJustUp,
			pinchDist
		};
	}

	return { detect };
}

// ─── Two-finger pan / zoom (index + middle fingertips) ───────────────────────

/**
 * Returns the midpoint and spread between index (lm 8) and middle (lm 12)
 * fingertips on the same hand. Used to drive pan+zoom when both are extended.
 */
export function twoFingerState(
	hand: { x: number; y: number; z: number }[],
	viewW: number,
	viewH: number
): TwoFingerState {
	const a = { x: hand[8].x * viewW, y: hand[8].y * viewH };
	const b = { x: hand[12].x * viewW, y: hand[12].y * viewH };

	return {
		mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
		dist: Math.hypot(b.x - a.x, b.y - a.y),
		valid: true
	};
}