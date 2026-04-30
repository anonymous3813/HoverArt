import { summarizeFace, type FaceSample } from '../imposter/faceSignals.js';
import { analyzeVoiceProsody, type VoiceSnapshot } from '../imposter/voiceSignals.js';
export function phase1FaceLieSignal(samples: FaceSample[]): {
    score: number;
    detail: Record<string, number>;
} {
    const f = summarizeFace(samples);
    const tension = Math.min(1, 0.5 * f.avgBrow + 0.5 * f.avgSquint);
    const jitter = Math.min(1, f.jawStdev * 5);
    const calm = Math.min(1, f.avgSmile * 1.1);
    const score = Math.max(0, Math.min(100, Math.round(28 + 38 * tension + 34 * jitter - 22 * calm)));
    return {
        score,
        detail: { avgBrow: f.avgBrow, jawStdev: f.jawStdev, avgSmile: f.avgSmile, avgSquint: f.avgSquint }
    };
}
export function phase2VoiceLieSignal(snapshots: VoiceSnapshot[]): {
    score: number;
    detail: Record<string, number>;
} {
    const p = analyzeVoiceProsody(snapshots);
    const cvN = Math.min(1, p.rmsCv * 2.5);
    const pauseN = Math.min(1, p.pauseCount / 6);
    const gapN = Math.min(1, p.longestSilenceMs / 900);
    const thinVoice = p.rmsMean < 0.02 ? 0.25 : 0;
    const unvoiced = Math.min(1, 1 - p.voicedFraction);
    const score = Math.max(0, Math.min(100, Math.round(22 + 28 * cvN + 18 * pauseN + 16 * gapN + 14 * unvoiced + 12 * thinVoice)));
    return {
        score,
        detail: {
            rmsMean: p.rmsMean,
            rmsCv: p.rmsCv,
            zcrMean: p.zcrMean,
            pauseCount: p.pauseCount,
            longestSilenceMs: p.longestSilenceMs,
            voicedFraction: p.voicedFraction
        }
    };
}
