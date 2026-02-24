export const PINCH_THRESHOLD = 0.06;
export const FIST_THRESHOLD = 0.12;

export function classifyGesture(landmarks: any[]) {
	const thumbTip = landmarks[4];
	const indexTip = landmarks[8];
	const indexPip = landmarks[6];
	const middleTip = landmarks[12];
	const middlePip = landmarks[10];
	const ringTip = landmarks[16];
	const ringPip = landmarks[14];
	const pinkyTip = landmarks[20];
	const pinkyPip = landmarks[18];

	const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

	const pinchDist = dist(thumbTip, indexTip);
	if (pinchDist < PINCH_THRESHOLD) return 'erase';

	const indexExtended = indexTip.y < indexPip.y;
	const middleCurled = middleTip.y > middlePip.y;
	const ringCurled = ringTip.y > ringPip.y;
	const pinkyCurled = pinkyTip.y > pinkyPip.y;

	if (indexExtended && middleCurled && ringCurled && pinkyCurled) return 'draw';

	return 'none';
}


