/**
 * PoseDetector.js
 * ───────────────
 * Wraps the MediaPipe Pose Landmarker (Vision Tasks API) and emits
 * classified boxing gestures: punchLeft, punchRight, block.
 *
 * Gesture classification is based on wrist velocity + arm extension
 * relative to the shoulder width, which is robust without requiring
 * any ML training beyond the built-in pose model.
 *
 * Usage:
 *   const detector = new PoseDetector(videoElement, {
 *     onGesture(name) { … },   // 'punchLeft'|'punchRight'|'blockStart'|'blockEnd'
 *     onLandmarks(landmarks) { … },  // raw normalised landmarks for overlay drawing
 *   });
 *   await detector.init();
 *   detector.start();
 *   // later…
 *   detector.dispose();
 *
 * Landmark indices (MediaPipe BlazePose 33-point model):
 *   11 = left shoulder,  12 = right shoulder
 *   13 = left elbow,     14 = right elbow
 *   15 = left wrist,     16 = right wrist
 *    0 = nose
 */

// CDN for MediaPipe Vision Tasks — no npm install needed.
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// ── Landmark indices ──────────────────────────────────────────────────────────
const L = {
	NOSE: 0,
	LEFT_SHOULDER: 11,
	RIGHT_SHOULDER: 12,
	LEFT_ELBOW: 13,
	RIGHT_ELBOW: 14,
	LEFT_WRIST: 15,
	RIGHT_WRIST: 16,
	LEFT_HIP: 23,
	RIGHT_HIP: 24
};

// ── Tuning constants ──────────────────────────────────────────────────────────

// Upward wrist velocity (normalized by shoulder-width) required to register a punch.
// Raised from 0.08 — that was way too sensitive and fired on camera jitter.
// 0.20 requires a deliberate upward snap.
const PUNCH_VELOCITY_THRESH = 0.20;

// Arm must be at least this extended (wrist-to-shoulder / shoulder-width) to punch.
// Now actually used (was hardcoded to 0.5 before, ignoring PUNCH_EXTENSION_THRESH).
const PUNCH_EXTENSION_THRESH = 0.9;

// How many frames of velocity history to average before classifying a punch.
// Smooths out single noisy frames that caused false positives.
const VELOCITY_HISTORY_FRAMES = 3;

// Block requires this many consecutive frames with arms crossed (unchanged).
const BLOCK_FRAME_COUNT = 4;

// Block must also un-cross for this many frames before blockEnd fires.
// Prevents flickering in and out of block on a single noisy frame.
const BLOCK_RELEASE_FRAMES = 3;

// Minimum ms between any two gesture events.
// Raised from 400 ms — punches shouldn't fire more than ~2×/sec realistically.
const GESTURE_COOLDOWN_MS = 500;

export class PoseDetector {
	video: HTMLVideoElement;
	onGesture: Function;
	onLandmarks: Function;

	_landmarker: any;
	_rafId: number | null;
	_running: boolean;

	// Velocity history: circular buffer of the last N {x,y} positions per wrist
	_leftHistory: Array<{ x: number; y: number }>;
	_rightHistory: Array<{ x: number; y: number }>;

	_blockFrames: number;
	_blockReleaseFrames: number;
	_blocking: boolean;
	_lastGestureTime: number;

	/**
	 * @param {HTMLVideoElement} video
	 * @param {{ onGesture?: Function, onLandmarks?: Function }} opts
	 */
	constructor(video, opts = {}) {
		this.video = video;
		this.onGesture = opts.onGesture ?? (() => {});
		this.onLandmarks = opts.onLandmarks ?? (() => {});

		this._landmarker = null;
		this._rafId = null;
		this._running = false;

		// Per-wrist position history for smoothed velocity
		this._leftHistory = [];
		this._rightHistory = [];

		// Block state tracking
		this._blockFrames = 0;
		this._blockReleaseFrames = 0;
		this._blocking = false;

		// Gesture debounce
		this._lastGestureTime = 0;
	}

	// ─── Init ──────────────────────────────────────────────────────────────────

	async init() {
		const { PoseLandmarker, FilesetResolver } =
			await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs');

		const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);

		this._landmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numPoses: 1,
			minPoseDetectionConfidence: 0.5,
			minPosePresenceConfidence: 0.5,
			minTrackingConfidence: 0.5
		});
	}

	// ─── Camera ────────────────────────────────────────────────────────────────

	async start() {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { width: 640, height: 480, facingMode: 'user' },
			audio: false
		});
		this.video.srcObject = stream;
		await new Promise((resolve) => {
			this.video.onloadeddata = resolve;
		});
		this.video.play();

		this._running = true;
		this._loop();
	}

	stop() {
		this._running = false;
		cancelAnimationFrame(this._rafId);

		const stream = this.video.srcObject;
		stream?.getTracks().forEach((t) => t.stop());
		this.video.srcObject = null;
	}

	dispose() {
		this.stop();
		this._landmarker?.close();
	}

	// ─── Detection loop ────────────────────────────────────────────────────────

	_loop() {
		if (!this._running) return;
		this._rafId = requestAnimationFrame(() => this._loop());

		if (this.video.readyState < 2) return;

		const results = this._landmarker.detectForVideo(this.video, performance.now());
		if (!results.landmarks?.length) return;

		const lm = results.landmarks[0];
		this.onLandmarks(lm);
		this._classify(lm);
	}

	// ─── Gesture classification ────────────────────────────────────────────────

	_classify(lm) {
		const lw = lm[L.LEFT_WRIST];
		const rw = lm[L.RIGHT_WRIST];
		const ls = lm[L.LEFT_SHOULDER];
		const rs = lm[L.RIGHT_SHOULDER];
		const le = lm[L.LEFT_ELBOW];
		const re = lm[L.RIGHT_ELBOW];

		if (!lw || !rw || !ls || !rs || !le || !re) return;

		const shoulderWidth = Math.abs(ls.x - rs.x);
		if (shoulderWidth < 0.01) return;

		// ---------------- BLOCK DETECTION ----------------
		// X-cross: left wrist over right shoulder AND right wrist over left shoulder.
		const leftAboveOpposite = lw.y < rs.y;
		const rightAboveOpposite = rw.y < ls.y;
		const wristsCross = lw.x > rw.x;
		const isXPose = leftAboveOpposite && rightAboveOpposite && wristsCross;

		if (isXPose) {
			this._blockReleaseFrames = 0;
			this._blockFrames++;
			if (this._blockFrames >= BLOCK_FRAME_COUNT && !this._blocking) {
				this._blocking = true;
				this._emit('blockStart');
			}
		} else {
			if (this._blocking) {
				// Require several consecutive non-blocking frames before releasing.
				// This prevents a single noisy frame from ending the block early.
				this._blockReleaseFrames++;
				if (this._blockReleaseFrames >= BLOCK_RELEASE_FRAMES) {
					this._blocking = false;
					this._blockFrames = 0;
					this._emit('blockEnd');
				}
			} else {
				this._blockFrames = 0;
				this._blockReleaseFrames = 0;
			}
		}

		// ---------------- PUNCH DETECTION ----------------
		if (this._blocking) {
			// Don't register punches while blocking; still record positions
			// so history doesn't produce a spurious spike when block ends.
			this._pushHistory(lw, rw);
			return;
		}

		this._pushHistory(lw, rw);

		// Need at least VELOCITY_HISTORY_FRAMES samples before classifying
		if (
			this._leftHistory.length < VELOCITY_HISTORY_FRAMES ||
			this._rightHistory.length < VELOCITY_HISTORY_FRAMES
		) {
			return;
		}

		// Smoothed upward velocity = displacement over the history window, normalized.
		// Using oldest vs newest position averages out single-frame noise.
		const leftVelY = this._smoothedVelY(this._leftHistory, shoulderWidth);
		const rightVelY = this._smoothedVelY(this._rightHistory, shoulderWidth);

		// Arm extension: wrist must be far from shoulder (fully extended arm)
		const leftExt = dist2D(lw, ls) / shoulderWidth;
		const rightExt = dist2D(rw, rs) / shoulderWidth;

		if (leftVelY > PUNCH_VELOCITY_THRESH && leftExt > PUNCH_EXTENSION_THRESH) {
			this._emit('punchLeft');
		}
		if (rightVelY > PUNCH_VELOCITY_THRESH && rightExt > PUNCH_EXTENSION_THRESH) {
			this._emit('punchRight');
		}
	}

	/**
	 * Push current wrist positions into history buffers,
	 * keeping only the last VELOCITY_HISTORY_FRAMES entries.
	 */
	_pushHistory(lw, rw) {
		this._leftHistory.push({ x: lw.x, y: lw.y });
		this._rightHistory.push({ x: rw.x, y: rw.y });
		if (this._leftHistory.length > VELOCITY_HISTORY_FRAMES) {
			this._leftHistory.shift();
		}
		if (this._rightHistory.length > VELOCITY_HISTORY_FRAMES) {
			this._rightHistory.shift();
		}
	}

	/**
	 * Upward velocity (positive = moving up) averaged over the history window.
	 * "Up" = decreasing Y in normalized coords.
	 *
	 * @param {Array<{x,y}>} history
	 * @param {number} shoulderWidth  - normalization factor
	 * @returns {number}
	 */
	_smoothedVelY(history, shoulderWidth) {
		const oldest = history[0];
		const newest = history[history.length - 1];
		// Positive when wrist moved upward (y decreased) over the window
		return (oldest.y - newest.y) / shoulderWidth;
	}

	_emit(gesture) {
		const now = Date.now();
		if (now - this._lastGestureTime < GESTURE_COOLDOWN_MS) return;
		this._lastGestureTime = now;
		this.onGesture(gesture);
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dist2D(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

// ── Landmark overlay helper ───────────────────────────────────────────────────

/**
 * Draw pose skeleton onto a 2D canvas overlay.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} landmarks  - normalised [{x,y,z,visibility}]
 * @param {number} w         - canvas width
 * @param {number} h         - canvas height
 */
export function drawPoseSkeleton(ctx, landmarks, w, h) {
	if (!landmarks?.length) return;

	ctx.clearRect(0, 0, w, h);

	const CONNECTIONS = [
		[11, 12],
		[11, 13],
		[13, 15],
		[12, 14],
		[14, 16],
		[11, 23],
		[12, 24],
		[23, 24]
	];

	ctx.strokeStyle = 'rgba(251,191,36,0.8)';
	ctx.lineWidth = 2;

	for (const [a, b] of CONNECTIONS) {
		const pa = landmarks[a];
		const pb = landmarks[b];
		if (!pa || !pb) continue;
		ctx.beginPath();
		ctx.moveTo((1 - pa.x) * w, pa.y * h);
		ctx.lineTo((1 - pb.x) * w, pb.y * h);
		ctx.stroke();
	}

	for (const idx of [15, 16]) {
		const p = landmarks[idx];
		if (!p) continue;
		ctx.fillStyle = idx === 15 ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)';
		ctx.beginPath();
		ctx.arc((1 - p.x) * w, p.y * h, 6, 0, Math.PI * 2);
		ctx.fill();
	}
}