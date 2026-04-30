import { query } from './db.js';
import { getOpenAiKey } from './openaiTwoTruthsService.js';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
async function summarizeWithOpenAi(text) {
    const key = getOpenAiKey();
    if (!key) {
        throw new Error('OPENAI_SECRET missing — summaries need the same key as Omni planner.');
    }
    const body = String(text || '').slice(0, 120000);
    if (!body.trim())
        throw new Error('Nothing to summarize.');
    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
                {
                    role: 'system',
                    content: 'You summarize documents for HoverArt Omni. Be concise but complete (bullets ok). No preamble about being an AI.'
                },
                {
                    role: 'user',
                    content: body
                }
            ]
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error?.message || res.statusText || 'OpenAI request failed';
        throw new Error(typeof msg === 'string' ? msg : 'OpenAI failed');
    }
    const out = data?.choices?.[0]?.message?.content;
    if (!out || typeof out !== 'string')
        throw new Error('Empty OpenAI summary');
    return out.trim();
}
export async function createOmniSummaryForUser(userId, payload) {
    const rawCh = typeof payload.sourceChannel === 'string' ? payload.sourceChannel.trim().toLowerCase() : '';
    const allowed = new Set(['extension', 'chat_import', 'legacy_web']);
    let sourceChannel = allowed.has(rawCh) ? rawCh : 'legacy_web';
    const sourceUrl = typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim().slice(0, 4096) : null;
    let title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 500) : '';
    const bodyText = typeof payload.bodyText === 'string' ? payload.bodyText.trim() : '';
    if (!bodyText) {
        throw new Error('Provide body text for summarization.');
    }
    if (!title) {
        title = bodyText.slice(0, 80).replace(/\s+/g, ' ').trim() || 'Untitled';
    }
    let projectId = typeof payload.projectId === 'number' ? payload.projectId : Number(payload.projectId);
    if (!Number.isFinite(projectId) || projectId < 1)
        projectId = null;
    if (projectId != null) {
        const chk = await query(`SELECT id FROM omni_projects WHERE id = $1 AND user_id = $2`, [projectId, userId]);
        if (!chk.rows[0]) {
            throw new Error('Linked project does not exist or belongs to another user.');
        }
    }
    const inserted = await query(`
    INSERT INTO omni_summaries (user_id, title, source_url, body_text, status, project_id, source_channel)
    VALUES ($1, $2, $3, $4, 'pending', $5, $6)
    RETURNING id
    `, [userId, title, sourceUrl, bodyText, projectId, sourceChannel]);
    const id = inserted.rows[0].id;
    try {
        const ai_summary = await summarizeWithOpenAi(bodyText);
        const done = await query(`
      UPDATE omni_summaries
      SET ai_summary = $2, status = 'done', error_detail = NULL
      WHERE id = $1 AND user_id = $3
      RETURNING id, title, source_url, status, ai_summary, project_id, source_channel, created_at
      `, [id, ai_summary, userId]);
        return done.rows[0];
    }
    catch (err) {
        const msg = err.message || String(err);
        await query(`UPDATE omni_summaries SET status = 'failed', error_detail = $2 WHERE id = $1`, [id, msg.slice(0, 2000)]);
        throw err;
    }
}
export async function listOmniSummariesForUser(userId, limit = 50, opts = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const extensionOnly = opts && typeof opts === 'object' && opts.onlyExtensionJobs === true;
    const chanFilter = extensionOnly ? ` AND source_channel = 'extension' ` : '';
    const result = await query(`
    SELECT id, title, source_url, status, ai_summary, error_detail, project_id,
           source_channel, created_at
    FROM omni_summaries
    WHERE user_id = $1
    ${chanFilter}
    ORDER BY created_at DESC
    LIMIT $2
    `, [userId, lim]);
    return result.rows;
}
