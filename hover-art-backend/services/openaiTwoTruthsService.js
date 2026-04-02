const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function getOpenAiKey() {
  const candidates = [
    process.env.OPENAI_SECRET,
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_KEY
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const k = raw.trim();
      if (k.length > 0) return k;
    }
  }
  return null;
}

export function isOpenAiConfigured() {
  return getOpenAiKey() !== null;
}

export async function analyzeTwoTruthsLie({ phrases }) {
  const key = getOpenAiKey();
  if (!key) {
    throw new Error(
      'No OpenAI API key found. Put OPENAI_SECRET=sk-... in hover-art-backend/.env, save the file ' +
        '(unsaved editor tabs are not read), then restart the backend with npm start in that folder.'
    );
  }

  const userPayload = {
    instructions:
      'The player recorded three short spoken statements. Exactly two are true and one is a lie, but you do not know which. You receive (1) rough face-motion heuristics per clip, (2) rough voice/pause heuristics per clip — these are noisy and NOT biometric truth data. (3) Your job is NLP: plausibility, internal consistency, timeline impossibilities, and whether a claim sounds fabricated or extremely rare.',
    phrases
  };

  const system = `You are helping with a party game "two truths and a lie". 
You must respond with valid JSON only, no markdown. Schema:
{
  "estimatedLieCount": number (usually 1 for this game format),
  "likelyLieIndices": number[] (0-based indices of statements most likely to be the lie; may be 1 or 2 entries if uncertain),
  "confidence": "low" | "medium" | "high" (how confident you are in your ranking — keep honest; usually low/medium),
  "phase3PerPhrase": [
    { "index": 0, "nlpNote": "short string", "implausibilityScore": 0-100 }
  ],
  "synthesis": "one paragraph combining NLP view with the caveat that face/voice numbers are toys",
  "disclaimer": "For entertainment only; not a lie detector."
}
Rules:
- Never claim scientific lie detection.
- If transcripts are empty or too short, say so in synthesis and widen uncertainty.
- Prefer semantic analysis (dates, logic, contradictions between phrases) over the numeric heuristics.`;

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) }
      ]
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText || 'OpenAI request failed';
    throw new Error(msg);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('OpenAI returned non-JSON');
  }
}
