import { query } from './db.js';
import { createOmniSummaryForUser } from './omniSummariesService.js';
export async function assertProjectOwned(userId, projectId) {
    const r = await query(`SELECT id, title, source_kind, source_url, created_at, updated_at
     FROM omni_projects WHERE id = $1 AND user_id = $2`, [projectId, userId]);
    if (!r.rows[0]) {
        throw new Error('Project not found.');
    }
    return r.rows[0];
}
export async function listOmniProjectsForUser(userId, limit = 50) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const result = await query(`
    SELECT p.id, p.title, p.source_kind, p.source_url, p.created_at, p.updated_at,
           (SELECT COUNT(*)::int FROM omni_project_artifacts a WHERE a.project_id = p.id) AS artifact_count,
           (SELECT COUNT(*)::int FROM omni_summaries s WHERE s.project_id = p.id) AS summary_count
    FROM omni_projects p
    WHERE p.user_id = $1
    ORDER BY p.updated_at DESC, p.created_at DESC
    LIMIT $2
    `, [userId, lim]);
    return result.rows;
}
export async function getOmniProjectDetail(userId, projectId) {
    const project = await assertProjectOwned(userId, projectId);
    const arts = await query(`
    SELECT id, kind, title, LEFT(body_text, 80000) AS body_text_preview, source_url, created_at,
           LENGTH(body_text)::int AS body_length
    FROM omni_project_artifacts
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 120
    `, [projectId]);
    const sums = await query(`
    SELECT id, title, source_url, status, ai_summary, error_detail, created_at
    FROM omni_summaries
    WHERE user_id = $1 AND project_id = $2
    ORDER BY created_at DESC
    LIMIT 40
    `, [userId, projectId]);
    return { project, artifacts: arts.rows, summaries: sums.rows };
}
export async function getOmniArtifactFull(userId, projectId, artifactId) {
    await assertProjectOwned(userId, projectId);
    const r = await query(`
    SELECT id, kind, title, body_text, source_url, created_at
    FROM omni_project_artifacts
    WHERE id = $1 AND project_id = $2
    `, [artifactId, projectId]);
    if (!r.rows[0])
        throw new Error('Artifact not found.');
    return r.rows[0];
}
export async function createOmniProject(userId, payload) {
    const title = typeof payload.title === 'string'
        ? payload.title.trim().slice(0, 500)
        : '';
    if (!title)
        throw new Error('Project title is required.');
    const sourceKind = typeof payload.sourceKind === 'string' ? payload.sourceKind.trim().slice(0, 64) : null;
    const sourceUrl = typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim().slice(0, 4096) : null;
    const ins = await query(`
    INSERT INTO omni_projects (user_id, title, source_kind, source_url)
    VALUES ($1, $2, $3, $4)
    RETURNING id, title, source_kind, source_url, created_at, updated_at
    `, [userId, title, sourceKind, sourceUrl]);
    return ins.rows[0];
}
async function bumpProjectTs(projectId) {
    await query(`UPDATE omni_projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
}
export async function ensureOmniProjectByTitle(userId, rawTitle, sourceKind = 'user') {
    const title = String(rawTitle || '').trim().slice(0, 500);
    if (!title)
        throw new Error('Project title is empty.');
    const found = await query(`SELECT id FROM omni_projects WHERE user_id = $1 AND title = $2`, [userId, title]);
    if (found.rows[0])
        return found.rows[0].id;
    const ins = await query(`
    INSERT INTO omni_projects (user_id, title, source_kind)
    VALUES ($1, $2, $3)
    RETURNING id
    `, [userId, title, sourceKind]);
    return ins.rows[0].id;
}
const ARTIFACT_KINDS = new Set(['chat_transcript', 'diagram', 'analysis', 'document', 'note']);
export async function addOmniProjectArtifact(userId, payload) {
    const projectId = Number(payload.projectId);
    if (!(projectId >= 1))
        throw new Error('Invalid project.');
    await assertProjectOwned(userId, projectId);
    const kind = typeof payload.kind === 'string' ? payload.kind.trim().toLowerCase() : '';
    if (!ARTIFACT_KINDS.has(kind)) {
        throw new Error(`Artifact kind must be one of: ${[...ARTIFACT_KINDS].join(', ')}.`);
    }
    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 500) : '';
    let bodyText = typeof payload.bodyText === 'string' ? payload.bodyText.trim() : '';
    if (!bodyText)
        throw new Error('bodyText is required.');
    if (bodyText.length > 1500000)
        bodyText = `${bodyText.slice(0, 1500000)}\n…truncated…`;
    const sourceUrl = typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim().slice(0, 4096) : null;
    const ins = await query(`
    INSERT INTO omni_project_artifacts (project_id, kind, title, body_text, source_url)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, kind, title, source_url, created_at
    `, [projectId, kind, title || null, bodyText, sourceUrl]);
    await bumpProjectTs(projectId);
    return ins.rows[0];
}
export async function importOpenAiWebChat(userId, payload) {
    const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';
    if (!transcript)
        throw new Error('No chat transcript captured — open the thread and retry.');
    if (transcript.length < 80)
        throw new Error('Transcript seems too short to be a conversation.');
    const sourceUrl = typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim().slice(0, 4096) : null;
    let projectTitle = typeof payload.projectTitle === 'string'
        ? payload.projectTitle.trim().slice(0, 500)
        : '';
    if (!projectTitle) {
        const firstLine = transcript.split(/\n/).find((l) => l.trim().length > 10) || '';
        const cleaned = firstLine.replace(/^#\s+|^#{2,}\s+\w+\s*/, '').slice(0, 72);
        projectTitle =
            cleaned.replace(/\s+/g, ' ').trim().slice(0, 140) ||
                `ChatGPT export ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    }
    const projectIns = await query(`
    INSERT INTO omni_projects (user_id, title, source_kind, source_url)
    VALUES ($1, $2, 'openai_chat', $3)
    RETURNING id, title, source_kind, source_url, created_at
    `, [userId, projectTitle, sourceUrl]);
    const project = projectIns.rows[0];
    const pid = project.id;
    await query(`
    INSERT INTO omni_project_artifacts (project_id, kind, title, body_text, source_url)
    VALUES ($1, 'chat_transcript', $2, $3, $4)
    `, [
        pid,
        'Conversation log (exported from browser)',
        transcript,
        sourceUrl
    ]);
    let summaryRow = null;
    let summaryError = null;
    try {
        summaryRow = await createOmniSummaryForUser(userId, {
            title: `${project.title} — conversation digest`,
            sourceUrl,
            bodyText: transcript.slice(0, 140000),
            projectId: pid,
            sourceChannel: 'chat_import'
        });
    }
    catch (err) {
        summaryError = (err.message || String(err)).slice(0, 2000);
        await query(`
      INSERT INTO omni_project_artifacts (project_id, kind, title, body_text, source_url)
      VALUES ($1, 'note', $2, $3, $4)
      `, [
            pid,
            'Conversation digest failed (server summarization)',
            `The transcript was saved, but HoverArt could not run the AI digest yet.\n\n${summaryError}\n\nOpen the Omni extension and ask again to regenerate a digest, or view transcript in Projects.`,
            sourceUrl
        ]);
    }
    await bumpProjectTs(pid);
    return {
        success: true,
        projectId: pid,
        project,
        transcriptChars: transcript.length,
        summary: summaryRow,
        summaryError: summaryError || undefined
    };
}
