/** Nose / mid-face X in video normalized coords (0=left, 1=right). */
const NOSE_INDICES = [1, 4, 6];

export function faceHorizontalFromLandmarks(
	landmarks: { x: number; y: number; z?: number }[] | undefined
): number | null {
	if (!landmarks?.length) return null;
	let sum = 0;
	let n = 0;
	for (const i of NOSE_INDICES) {
		const p = landmarks[i];
		if (p && typeof p.x === 'number') {
			sum += p.x;
			n++;
		}
	}
	if (n === 0) return null;
	return sum / n;
}

/**
 * Map raw landmark X to paddle position 0..1 (playfield).
 * Mirrored so moving your head left matches a mirrored selfie expectation.
 */
export function paddle01FromFaceX(rawX: number): number {
	return Math.min(1, Math.max(0, 1 - rawX));
}

/** >1 amplifies deviation from center: small head motion reaches paddle edges (webcam FOV is tight). */
export const HEAD_TO_PADDLE_GAIN = 2.85;

/**
 * Like {@link paddle01FromFaceX} but scales around 0.5 so the paddle crosses the screen
 * with less physical head movement; values clamp to [0, 1].
 */
export function paddle01HighSensitivity(rawX: number, gain = HEAD_TO_PADDLE_GAIN): number {
	const p = paddle01FromFaceX(rawX);
	const amplified = (p - 0.5) * gain + 0.5;
	return Math.min(1, Math.max(0, amplified));
}
