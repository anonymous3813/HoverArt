import '../bootstrap-env.js';
import { analyzeTwoTruthsLie, isOpenAiConfigured } from '../services/openaiTwoTruthsService.js';
const phrases = [
    {
        index: 0,
        transcript: 'I have a dog named Max.',
        phase1FaceScore: 40,
        phase2VoiceScore: 35,
        phase1FaceDetail: {},
        phase2VoiceDetail: {}
    },
    {
        index: 1,
        transcript: 'I skydived twice last week.',
        phase1FaceScore: 55,
        phase2VoiceScore: 50,
        phase1FaceDetail: {},
        phase2VoiceDetail: {}
    },
    {
        index: 2,
        transcript: 'I drink coffee every morning.',
        phase1FaceScore: 42,
        phase2VoiceScore: 38,
        phase1FaceDetail: {},
        phase2VoiceDetail: {}
    }
];
if (!isOpenAiConfigured()) {
    console.error('FAIL: No OPENAI_SECRET after loading hover-art-backend/.env');
    process.exit(1);
}
try {
    const result = await analyzeTwoTruthsLie({ phrases });
    console.log('OpenAI OK. Sample fields:');
    console.log(JSON.stringify({
        estimatedLieCount: result.estimatedLieCount,
        likelyLieIndices: result.likelyLieIndices,
        confidence: result.confidence,
        synthesis: typeof result.synthesis === 'string' ? result.synthesis.slice(0, 200) + '…' : result.synthesis
    }, null, 2));
}
catch (err) {
    console.error('FAIL:', err.message);
    process.exit(1);
}
