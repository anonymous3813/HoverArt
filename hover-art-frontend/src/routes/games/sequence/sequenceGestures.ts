import { classifyGesture } from '$lib/whiteboard/gestures.ts';

type Landmark = { x: number; y: number; z?: number };

function isExtended(landmarks: Landmark[], tip: number, pip: number): boolean {
	return landmarks[tip].y < landmarks[pip].y - 0.02;
}

function isThumbExtended(landmarks: Landmark[]): boolean {
	const thumbTip = landmarks[4];
	const thumbIp = landmarks[3];
	const thumbMcp = landmarks[2];
	const indexPip = landmarks[6];
	const sideways = Math.abs(thumbTip.x - thumbMcp.x) > 0.05;
	const notThumbUp =
		indexPip.y < thumbTip.y + 0.02 || landmarks[8].y < landmarks[6].y;
	return sideways && thumbTip.y < thumbIp.y + 0.04 && notThumbUp;
}

/** Count raised fingers on one hand (1–5). */
export function countHandFingers(landmarks: Landmark[]): number {
	if (!landmarks || landmarks.length < 21) return 0;

	let count = 0;
	if (isExtended(landmarks, 8, 6)) count++;
	if (isExtended(landmarks, 12, 10)) count++;
	if (isExtended(landmarks, 16, 14)) count++;
	if (isExtended(landmarks, 20, 18)) count++;
	if (isThumbExtended(landmarks)) count++;

	return count;
}

/** Sum fingers across both hands (1–10), capped by caller. */
export function countAllFingers(hands: Landmark[][]): number {
	return hands.reduce((sum, hand) => sum + countHandFingers(hand), 0);
}

export function isThumbsUp(landmarks: Landmark[]): boolean {
	return classifyGesture(landmarks) === 'thumb_up';
}

/** Peace sign ✌️ — switch board spot */
export function isSwitchGesture(landmarks: Landmark[]): boolean {
	const g = classifyGesture(landmarks);
	return g === 'color-select' || g === 'open-palm';
}

export class StableValue {
	private current = 0;
	private candidate = 0;
	private candidateSince = 0;
	constructor(private holdMs = 350) {}

	update(value: number, now: number): number {
		if (value !== this.candidate) {
			this.candidate = value;
			this.candidateSince = now;
		}
		if (value > 0 && now - this.candidateSince >= this.holdMs) {
			this.current = value;
		}
		if (value === 0) {
			this.current = 0;
		}
		return this.current;
	}

	reset() {
		this.current = 0;
		this.candidate = 0;
		this.candidateSince = 0;
	}
}

export class GestureEdge {
	private active = false;
	private cooldownUntil = 0;

	trigger(isActive: boolean, now: number, cooldownMs = 700): boolean {
		if (now < this.cooldownUntil) {
			this.active = isActive;
			return false;
		}
		const fired = isActive && !this.active;
		this.active = isActive;
		if (fired) this.cooldownUntil = now + cooldownMs;
		return fired;
	}

	reset() {
		this.active = false;
		this.cooldownUntil = 0;
	}
}
