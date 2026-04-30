import express from 'express';
import { planOmniCommand, isOmniPlannerConfigured } from '../services/omniCommandService.js';
import { createOmniSummaryForUser, listOmniSummariesForUser } from '../services/omniSummariesService.js';
import { addOmniProjectArtifact, createOmniProject, ensureOmniProjectByTitle, getOmniArtifactFull, getOmniProjectDetail, importOpenAiWebChat, listOmniProjectsForUser } from '../services/omniProjectsService.js';
import { extractPlainTextFromPdfBuffer } from '../services/omniPdfExtractService.js';
import { requireAuth } from '../middleware/auth.js';
const router = express.Router();
function parseId(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? n : NaN;
}
router.post('/plan', async (req, res) => {
    try {
        if (!isOmniPlannerConfigured()) {
            res.status(503).json({
                success: false,
                error: 'OpenAI is not configured for Omni (missing OPENAI_SECRET in .env).'
            });
            return;
        }
        const command = typeof req.body?.command === 'string' ? req.body.command.trim() : '';
        if (!command) {
            res.status(400).json({ success: false, error: 'Missing "command"' });
            return;
        }
        const rawCtx = req.body.pageContext && typeof req.body.pageContext === 'object' ? req.body.pageContext : {};
        const pageContext = Object.keys(rawCtx).length > 0
            ? {
                url: rawCtx.url,
                title: rawCtx.title,
                textExcerpt: typeof rawCtx.textExcerpt === 'string' ? rawCtx.textExcerpt.slice(0, 12000) : undefined,
                scriptingBlocked: typeof rawCtx.scriptingBlocked === 'boolean' ? rawCtx.scriptingBlocked : undefined,
                textLenApprox: typeof rawCtx.textLenApprox === 'number' ? rawCtx.textLenApprox : undefined,
                hints: Array.isArray(rawCtx.hints) ? rawCtx.hints.slice(0, 20).map(String) : undefined,
                viewerKind: typeof rawCtx.viewerKind === 'string' ? rawCtx.viewerKind.slice(0, 80) : undefined
            }
            : undefined;
        const plan = await planOmniCommand({ command, pageContext });
        res.json({ success: true, plan });
    }
    catch (err) {
        console.error('[omni/plan]', err.message);
        res.status(500).json({ success: false, error: err.message || 'Planner error' });
    }
});
router.get('/health', (_req, res) => {
    res.json({
        planner: isOmniPlannerConfigured(),
        endpoint: 'POST http://HOST:PORT/api/omni/plan',
        shape: '{ "command": "string", "pageContext": {} }',
        summaries: 'JWT required → GET/POST http://HOST:PORT/api/omni/summaries',
        pdfText: 'POST binary application/pdf → /api/omni/pdf-text (returns { text })',
        projects: 'JWT → GET /api/omni/projects • GET /api/omni/projects/:id • POST /projects /projects/from-openai-chat /projects/:id/artifacts • POST summaries may include projectId'
    });
});
router.post('/pdf-text', express.raw({ type: () => true, limit: '35mb' }), async (req, res) => {
    try {
        const buf = req.body;
        if (!(buf instanceof Buffer) || buf.length < 40) {
            res.status(400).json({
                success: false,
                error: 'Send raw PDF bytes (Content-Type application/pdf). Body missing or too small for a PDF file.'
            });
            return;
        }
        if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
            res.status(400).json({ success: false, error: 'Body does not start with a PDF magic header (%PDF).' });
            return;
        }
        const text = await extractPlainTextFromPdfBuffer(buf);
        res.json({
            success: true,
            textLen: text.length,
            text: text.slice(0, 240000),
            clipped: text.length > 240000
        });
    }
    catch (err) {
        console.error('[omni/pdf-text]', err.message);
        res.status(422).json({ success: false, error: err.message || 'PDF parse failed' });
    }
});
router.get('/summaries', requireAuth, async (req, res) => {
    try {
        const rows = await listOmniSummariesForUser(req.user.id, 50, { onlyExtensionJobs: true });
        res.json({ success: true, summaries: rows });
    }
    catch (err) {
        console.error('[omni/summaries]', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to list summaries' });
    }
});
router.post('/summaries', requireAuth, async (req, res) => {
    try {
        if (String(req.body?.sourceChannel || '').trim().toLowerCase() !== 'extension') {
            res.status(403).json({
                success: false,
                error: 'Summaries on the HoverArt website are synced from the Omni browser extension only — use Omni to summarize a page.'
            });
            return;
        }
        const row = await createOmniSummaryForUser(req.user.id, {
            ...(req.body ?? {}),
            sourceChannel: 'extension'
        });
        res.status(201).json({ success: true, summary: row });
    }
    catch (err) {
        const msg = err.message || String(err);
        const badInput = /OPENAI_SECRET|nothing to summarize|provide body text/i.test(msg);
        res.status(badInput ? 400 : 500).json({ success: false, error: msg });
    }
});
router.get('/projects', requireAuth, async (req, res) => {
    try {
        const rows = await listOmniProjectsForUser(req.user.id);
        res.json({ success: true, projects: rows });
    }
    catch (err) {
        console.error('[omni/projects list]', err.message);
        res.status(500).json({ success: false, error: err.message || 'Failed to list projects' });
    }
});
router.post('/projects', requireAuth, async (req, res) => {
    try {
        const row = await createOmniProject(req.user.id, req.body ?? {});
        res.status(201).json({ success: true, project: row });
    }
    catch (err) {
        const msg = err.message || String(err);
        const badInput = /required|invalid/i.test(msg);
        res.status(badInput ? 400 : 500).json({ success: false, error: msg });
    }
});
router.post('/projects/ensure', requireAuth, async (req, res) => {
    try {
        const title = typeof req.body?.title === 'string'
            ? req.body.title.trim()
            : '';
        const id = await ensureOmniProjectByTitle(req.user.id, title, 'ensure');
        res.json({ success: true, projectId: id });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'ensure failed' });
    }
});
router.post('/projects/from-openai-chat', requireAuth, async (req, res) => {
    try {
        const out = await importOpenAiWebChat(req.user.id, req.body ?? {});
        res.status(201).json(out);
    }
    catch (err) {
        const msg = err.message || String(err);
        const badInput = /no chat transcript|too short|OpenAI_SECRET|nothing to summarize|paste/i.test(msg);
        res.status(badInput ? 400 : 500).json({ success: false, error: msg });
    }
});
router.get('/projects/:projectId', requireAuth, async (req, res) => {
    const pid = parseId(req.params.projectId);
    if (Number.isNaN(pid)) {
        res.status(400).json({ success: false, error: 'Invalid project id' });
        return;
    }
    try {
        const detail = await getOmniProjectDetail(req.user.id, pid);
        res.json({ success: true, ...detail });
    }
    catch (err) {
        const nf = err.message === 'Project not found.';
        res.status(nf ? 404 : 500).json({ success: false, error: err.message });
    }
});
router.get('/projects/:projectId/artifacts/:artifactId', requireAuth, async (req, res) => {
    const pid = parseId(req.params.projectId);
    const aid = parseId(req.params.artifactId);
    if (Number.isNaN(pid) || Number.isNaN(aid)) {
        res.status(400).json({ success: false, error: 'Invalid ids' });
        return;
    }
    try {
        const artifact = await getOmniArtifactFull(req.user.id, pid, aid);
        res.json({ success: true, artifact });
    }
    catch (err) {
        const nf = /not found/i.test(err.message || '');
        res.status(nf ? 404 : 500).json({ success: false, error: err.message });
    }
});
router.post('/projects/:projectId/artifacts', requireAuth, async (req, res) => {
    const pid = parseId(req.params.projectId);
    if (Number.isNaN(pid)) {
        res.status(400).json({ success: false, error: 'Invalid project id' });
        return;
    }
    try {
        const row = await addOmniProjectArtifact(req.user.id, {
            ...(req.body ?? {}),
            projectId: pid
        });
        res.status(201).json({ success: true, artifact: row });
    }
    catch (err) {
        const msg = err.message || String(err);
        const badInput = /required|Invalid project|Artifact kind|does not exist/i.test(msg);
        res.status(badInput ? 400 : 500).json({ success: false, error: msg });
    }
});
export default router;
