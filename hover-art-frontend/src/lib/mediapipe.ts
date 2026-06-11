import {
    FilesetResolver,
    HandLandmarker
} from '@mediapipe/tasks-vision';

let handLandmarker: HandLandmarker | null = null;

export async function initHandLandmarker(): Promise<HandLandmarker> {
    if (handLandmarker) {
        return handLandmarker;
    }

    const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    handLandmarker = await HandLandmarker.createFromOptions(
        vision,
        {
            baseOptions: {
                modelAssetPath:
                    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
            },

            runningMode: 'VIDEO',

            numHands: 2,

            minHandDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
            minHandPresenceConfidence: 0.7
        }
    );

    return handLandmarker;
}