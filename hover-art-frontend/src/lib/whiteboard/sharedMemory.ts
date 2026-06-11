/**
 * SharedArrayBuffer-based channel for zero-copy landmark + gesture data.
 *
 * Layout
 * ──────
 * landmarkBuffer  Float32Array  21 landmarks × 3 floats (x, y, z)  = 63 floats = 252 bytes
 * gestureBuffer   Uint8Array    [0] reserved  [1] handVisible (0|1)  = 2 bytes
 *
 * The main thread writes; the render worker reads.
 * Because these are SharedArrayBuffers the worker sees updates instantly
 * without any postMessage overhead for landmark data.
 *
 * Cross-origin isolation requirement
 * ───────────────────────────────────
 * SharedArrayBuffer requires COOP/COEP headers:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: credentialless   ← use credentialless, not require-corp,
 *                                                     so CDN-hosted MediaPipe WASM still loads
 *
 * Set these in vite.config.ts (dev) and your deployment server (prod):
 *
 *   // vite.config.ts
 *   server: {
 *     headers: {
 *       'Cross-Origin-Opener-Policy': 'same-origin',
 *       'Cross-Origin-Embedder-Policy': 'credentialless',
 *     }
 *   }
 */

export const HAND_LANDMARK_COUNT = 21;
export const FLOATS_PER_LANDMARK = 3;   // x, y, z
export const LANDMARK_FLOAT_COUNT = HAND_LANDMARK_COUNT * FLOATS_PER_LANDMARK;  // 63

// Gesture buffer byte indices
export const GESTURE_IDX_TYPE    = 0;  // reserved for future named-gesture byte
export const GESTURE_IDX_VISIBLE = 1;  // 1 = hand detected, 0 = no hand

export interface SharedState {
    landmarkBuffer: SharedArrayBuffer;
    gestureBuffer:  SharedArrayBuffer;
    /** Float32Array view — write landmark x/y/z here on the main thread */
    landmarks:      Float32Array;
    /** Uint8Array view — write visibility flag here on the main thread */
    gestures:       Uint8Array;
}

export function createSharedState(): SharedState {
    const landmarkBuffer = new SharedArrayBuffer(LANDMARK_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT);
    const gestureBuffer  = new SharedArrayBuffer(2 * Uint8Array.BYTES_PER_ELEMENT);

    return {
        landmarkBuffer,
        gestureBuffer,
        landmarks: new Float32Array(landmarkBuffer),
        gestures:  new Uint8Array(gestureBuffer),
    };
}