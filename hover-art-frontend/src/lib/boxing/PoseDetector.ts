const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
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
const PUNCH_VELOCITY_THRESH = 0.20;
const PUNCH_EXTENSION_THRESH = 0.9;
const VELOCITY_HISTORY_FRAMES = 3;
const BLOCK_FRAME_COUNT = 4;
const BLOCK_RELEASE_FRAMES = 3;
const GESTURE_COOLDOWN_MS = 500;
export class PoseDetector {
    video: HTMLVideoElement;
    onGesture: Function;
    onLandmarks: Function;
    _landmarker: any;
    _rafId: number | null;
    _running: boolean;
    _leftHistory: Array<{
        x: number;
        y: number;
    }>;
    _rightHistory: Array<{
        x: number;
        y: number;
    }>;
    _blockFrames: number;
    _blockReleaseFrames: number;
    _blocking: boolean;
    _lastGestureTime: number;
    constructor(video, opts = {}) {
        this.video = video;
        this.onGesture = opts.onGesture ?? (() => { });
        this.onLandmarks = opts.onLandmarks ?? (() => { });
        this._landmarker = null;
        this._rafId = null;
        this._running = false;
        this._leftHistory = [];
        this._rightHistory = [];
        this._blockFrames = 0;
        this._blockReleaseFrames = 0;
        this._blocking = false;
        this._lastGestureTime = 0;
    }
    async init() {
        const { PoseLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
        this._landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
    }
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
    _loop() {
        if (!this._running)
            return;
        this._rafId = requestAnimationFrame(() => this._loop());
        if (this.video.readyState < 2)
            return;
        const results = this._landmarker.detectForVideo(this.video, performance.now());
        if (!results.landmarks?.length)
            return;
        const lm = results.landmarks[0];
        this.onLandmarks(lm);
        this._classify(lm);
    }
    _classify(lm) {
        const lw = lm[L.LEFT_WRIST];
        const rw = lm[L.RIGHT_WRIST];
        const ls = lm[L.LEFT_SHOULDER];
        const rs = lm[L.RIGHT_SHOULDER];
        const le = lm[L.LEFT_ELBOW];
        const re = lm[L.RIGHT_ELBOW];
        if (!lw || !rw || !ls || !rs || !le || !re)
            return;
        const shoulderWidth = Math.abs(ls.x - rs.x);
        if (shoulderWidth < 0.01)
            return;
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
        }
        else {
            if (this._blocking) {
                this._blockReleaseFrames++;
                if (this._blockReleaseFrames >= BLOCK_RELEASE_FRAMES) {
                    this._blocking = false;
                    this._blockFrames = 0;
                    this._emit('blockEnd');
                }
            }
            else {
                this._blockFrames = 0;
                this._blockReleaseFrames = 0;
            }
        }
        if (this._blocking) {
            this._pushHistory(lw, rw);
            return;
        }
        this._pushHistory(lw, rw);
        if (this._leftHistory.length < VELOCITY_HISTORY_FRAMES ||
            this._rightHistory.length < VELOCITY_HISTORY_FRAMES) {
            return;
        }
        const leftVelY = this._smoothedVelY(this._leftHistory, shoulderWidth);
        const rightVelY = this._smoothedVelY(this._rightHistory, shoulderWidth);
        const leftExt = dist2D(lw, ls) / shoulderWidth;
        const rightExt = dist2D(rw, rs) / shoulderWidth;
        if (leftVelY > PUNCH_VELOCITY_THRESH && leftExt > PUNCH_EXTENSION_THRESH) {
            this._emit('punchLeft');
        }
        if (rightVelY > PUNCH_VELOCITY_THRESH && rightExt > PUNCH_EXTENSION_THRESH) {
            this._emit('punchRight');
        }
    }
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
    _smoothedVelY(history, shoulderWidth) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        return (oldest.y - newest.y) / shoulderWidth;
    }
    _emit(gesture) {
        const now = Date.now();
        if (now - this._lastGestureTime < GESTURE_COOLDOWN_MS)
            return;
        this._lastGestureTime = now;
        this.onGesture(gesture);
    }
}
function dist2D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
export function drawPoseSkeleton(ctx, landmarks, w, h) {
    if (!landmarks?.length)
        return;
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
        if (!pa || !pb)
            continue;
        ctx.beginPath();
        ctx.moveTo((1 - pa.x) * w, pa.y * h);
        ctx.lineTo((1 - pb.x) * w, pb.y * h);
        ctx.stroke();
    }
    for (const idx of [15, 16]) {
        const p = landmarks[idx];
        if (!p)
            continue;
        ctx.fillStyle = idx === 15 ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)';
        ctx.beginPath();
        ctx.arc((1 - p.x) * w, p.y * h, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}
