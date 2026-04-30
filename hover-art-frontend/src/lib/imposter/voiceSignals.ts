export type VoiceSnapshot = {
    t: number;
    rms: number;
    zcr: number;
};
export function createVoiceAnalyzer(stream: MediaStream) {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    src.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    function getSnapshot(t: number): VoiceSnapshot {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++)
            sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        let zcr = 0;
        for (let i = 1; i < data.length; i++) {
            if ((data[i - 1] >= 0) !== (data[i] >= 0))
                zcr++;
        }
        return { t, rms, zcr: zcr / data.length };
    }
    async function close() {
        src.disconnect();
        await ctx.close().catch(() => { });
    }
    return { ctx, getSnapshot, close };
}
export function summarizeVoice(snapshots: VoiceSnapshot[]) {
    if (snapshots.length === 0) {
        return { rmsMean: 0, rmsCv: 0, zcrMean: 0 };
    }
    const rmss = snapshots.map((s) => s.rms);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const rmsMean = mean(rmss);
    const sigma = Math.sqrt(rmss.reduce((acc, x) => acc + (x - rmsMean) ** 2, 0) / Math.max(1, rmss.length));
    const rmsCv = rmsMean > 1e-6 ? sigma / rmsMean : 0;
    const zcrMean = mean(snapshots.map((s) => s.zcr));
    return { rmsMean, rmsCv, zcrMean };
}
const SILENT_RMS = 0.014;
const PAUSE_MIN_MS = 100;
export function analyzeVoiceProsody(snapshots: VoiceSnapshot[]) {
    const base = summarizeVoice(snapshots);
    if (snapshots.length < 2) {
        return {
            ...base,
            pauseCount: 0,
            longestSilenceMs: 0,
            voicedFraction: 1
        };
    }
    const silent = snapshots.map((s) => s.rms < SILENT_RMS);
    let longestSilenceMs = 0;
    let pauseCount = 0;
    let runStart = -1;
    for (let i = 0; i < snapshots.length; i++) {
        if (silent[i]) {
            if (runStart < 0)
                runStart = i;
        }
        else {
            if (runStart >= 0) {
                const dur = snapshots[i - 1].t - snapshots[runStart].t;
                longestSilenceMs = Math.max(longestSilenceMs, dur);
                if (dur >= PAUSE_MIN_MS)
                    pauseCount += 1;
                runStart = -1;
            }
        }
    }
    if (runStart >= 0) {
        const dur = snapshots[snapshots.length - 1].t - snapshots[runStart].t;
        longestSilenceMs = Math.max(longestSilenceMs, dur);
        if (dur >= PAUSE_MIN_MS)
            pauseCount += 1;
    }
    const voicedN = silent.filter((s) => !s).length;
    const voicedFraction = voicedN / silent.length;
    return { ...base, pauseCount, longestSilenceMs, voicedFraction };
}
