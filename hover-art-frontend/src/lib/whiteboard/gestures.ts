export const PINCH_THRESHOLD = 0.06;
export const FIST_THRESHOLD = 0.12;

export function classifyGesture(landmarks: any[]): string {
	if (!landmarks || landmarks.length < 21) return 'none';

	const thumbTip = landmarks[4];
	const thumbIp = landmarks[3];
	const thumbMcp = landmarks[2];

	const indexTip = landmarks[8];
	const indexPip = landmarks[6];
	const indexMcp = landmarks[5];

	const middleTip = landmarks[12];
	const middlePip = landmarks[10];

	const ringTip = landmarks[16];
	const ringPip = landmarks[14];

	const pinkyTip = landmarks[20];
	const pinkyPip = landmarks[18];

	const wrist = landmarks[0];

	const dist = (a: any, b: any) =>
		Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);

	const pinchDist = dist(thumbTip, indexTip);
	if (pinchDist < PINCH_THRESHOLD) return 'erase';

	const indexExtended = indexTip.y < indexPip.y;
	const middleExtended = middleTip.y < middlePip.y;
	const ringExtended = ringTip.y < ringPip.y;
	const pinkyExtended = pinkyTip.y < pinkyPip.y;

	const middleCurled = middleTip.y > middlePip.y;
	const ringCurled = ringTip.y > ringPip.y;
	const pinkyCurled = pinkyTip.y > pinkyPip.y;

	const thumbUp =
		thumbTip.y < thumbIp.y - 0.02 &&
		indexTip.y > indexPip.y &&
		middleCurled &&
		ringCurled &&
		pinkyCurled;

	if (thumbUp) return 'thumb_up';

	const thumbDown =
		thumbTip.y > thumbIp.y + 0.02 &&
		indexTip.y > indexPip.y &&
		middleCurled &&
		ringCurled &&
		pinkyCurled;

	if (thumbDown) return 'thumb_down';

	const thumbOutSideways = Math.abs(thumbTip.x - thumbMcp.x) > 0.08;
	const indexPointingUp = indexTip.y < indexMcp.y - 0.06;
	if (thumbOutSideways && indexPointingUp && middleCurled && ringCurled && pinkyCurled) {
		return 'l_shape';
	}

	const indexBelowWrist = indexTip.y > wrist.y + 0.05;
	const indexSpansDown = Math.abs(indexTip.y - indexPip.y) > 0.04;
	if (indexBelowWrist && indexSpansDown && middleCurled && ringCurled && pinkyCurled) {
		return 'point_down';
	}

	if (indexExtended && middleExtended && ringExtended && pinkyExtended) return 'open-palm';

	if (indexExtended && middleExtended && ringCurled && pinkyCurled) return 'color-select';

	if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
		return indexTip.y < wrist.y ? 'draw' : 'point_up';
	}

	const pinkyUp =
		pinkyTip.y < pinkyPip.y &&
		indexTip.y > indexPip.y &&
		middleTip.y > middlePip.y &&
		ringTip.y > ringPip.y;

	const quietCoyote =
		pinkyTip.y < pinkyPip.y &&
		indexTip.y < indexPip.y &&
		middleTip.y > middlePip.y &&
		ringTip.y > ringPip.y;

	if (quietCoyote) return 'quiet_coyote';
	else if (pinkyUp) return 'pinky_up';

	return 'none';
}
