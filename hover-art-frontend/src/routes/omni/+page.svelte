<svelte:head>
  <title>Omni — Skill tree &amp; browser extension</title>
</svelte:head>

<script lang="ts">import { onMount } from 'svelte';
import SkillTree from '$lib/components/SkillTree.svelte';
import type { Skill } from '$lib/types/skill';
import { auth } from '$lib/auth.svelte.ts';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
let omniPane: 'home' | 'summaries' | 'projects' = $state('home');
type SummaryRow = {
    id: number;
    title: string | null;
    source_url: string | null;
    status: string;
    ai_summary: string | null;
    error_detail: string | null;
    project_id: number | null;
    created_at: string;
};
type ProjectBrief = {
    id: number;
    title: string;
    source_kind: string | null;
    source_url: string | null;
    created_at: string;
    updated_at: string;
    artifact_count: number;
    summary_count: number;
};
type ArtifactRow = {
    id: number;
    kind: string;
    title: string | null;
    body_text_preview: string;
    body_length: number;
    source_url: string | null;
    created_at: string;
};
let projList = $state<ProjectBrief[]>([]);
let projLoading = $state(false);
let projErr = $state('');
let selProjectId = $state<number | null>(null);
let projArtifacts = $state<ArtifactRow[]>([]);
let projSummaries = $state<SummaryRow[]>([]);
let projDetailLoading = $state(false);
let projDetailMeta = $state<{
    title: string;
} | null>(null);
let sumError = $state('');
let sumList = $state<SummaryRow[]>([]);
let sumLoadPending = $state(false);
let skills: Skill[] = [];
async function refreshSummaries() {
    sumError = '';
    if (!auth.token) {
        sumList = [];
        return;
    }
    sumLoadPending = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/omni/summaries`, {
            headers: { Authorization: `Bearer ${auth.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            sumError = data.error || 'Could not load summaries.';
            sumList = [];
            return;
        }
        sumList = Array.isArray(data.summaries) ? data.summaries : [];
    }
    catch {
        sumError = 'Network error loading summaries.';
    }
    finally {
        sumLoadPending = false;
    }
}
async function refreshProjects() {
    projErr = '';
    if (!auth.token) {
        projList = [];
        return;
    }
    projLoading = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/omni/projects`, {
            headers: { Authorization: `Bearer ${auth.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            projErr = data.error || 'Could not load projects.';
            projList = [];
            return;
        }
        projList = Array.isArray(data.projects) ? data.projects : [];
    }
    catch {
        projErr = 'Network error loading projects.';
    }
    finally {
        projLoading = false;
    }
}
async function loadProjectDetail(id: number) {
    projErr = '';
    if (!auth.token)
        return;
    selProjectId = id;
    projDetailLoading = true;
    projArtifacts = [];
    projSummaries = [];
    projDetailMeta = null;
    try {
        const res = await fetch(`${BACKEND_URL}/api/omni/projects/${id}`, {
            headers: { Authorization: `Bearer ${auth.token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            projErr = data.error || 'Failed to load project.';
            return;
        }
        projDetailMeta = data.project ? { title: data.project.title } : null;
        projArtifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
        projSummaries = Array.isArray(data.summaries) ? data.summaries : [];
    }
    catch {
        projErr = 'Network error.';
    }
    finally {
        projDetailLoading = false;
    }
}
function openProjectsTab() {
    omniPane = 'projects';
    selProjectId = null;
    projDetailMeta = null;
    projArtifacts = [];
    projSummaries = [];
    void refreshProjects();
}
onMount(async () => {
    if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        const tab = sp.get('tab');
        const pid = sp.get('project');
        if (tab === 'summaries')
            omniPane = 'summaries';
        if (tab === 'projects') {
            omniPane = 'projects';
            await refreshProjects();
            const n = pid ? Number(pid) : NaN;
            if (Number.isFinite(n) && n >= 1)
                await loadProjectDetail(n);
        }
    }
    loadSkills();
    await refreshSummaries();
});
function openSummariesTab() {
    omniPane = 'summaries';
    void refreshSummaries();
}
function loadSkills() {
    const stored = localStorage.getItem('omni-skills');
    if (stored) {
        skills = JSON.parse(stored);
    }
    else {
        skills = getInitialSkills();
        saveSkills();
    }
}
function saveSkills() {
    localStorage.setItem('omni-skills', JSON.stringify(skills));
}
function getInitialSkills(): Skill[] {
    return [
        {
            id: 'root',
            name: 'Omni Core',
            description: 'The foundation of all capabilities',
            level: 0,
            children: ['file', 'web', 'system'],
            unlocked: true,
            color: '#00f5ff'
        },
        {
            id: 'file',
            name: 'File Operations',
            description: 'Create, read, and manage files',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: true,
            color: '#ff4ecd'
        },
        {
            id: 'web',
            name: 'Web Actions',
            description: 'Navigate and interact with websites',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: true,
            color: '#a78bfa'
        },
        {
            id: 'system',
            name: 'System Control',
            description: 'Control system functions',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: false,
            color: '#fbbf24'
        }
    ];
}
function resetSkillTree() {
    if (confirm('Reset the demo skill tree for this site? (Voice commands and learned skills live in the Omni extension, not here.)')) {
        skills = getInitialSkills();
        saveSkills();
    }
}
const extensionFolderPath = '/omni-extension/';
</script>

<div class="omni-container">
  <div class="omni-bg">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
  </div>

  <header class="omni-header">
    <a href="/" class="back-btn">← Back</a>
    <div class="omni-header-center">
      <div class="omni-logo">
        <span class="logo-icon">◈</span>
        <span>Omni</span>
      </div>
      <nav class="omni-tabstrip" aria-label="Omni panels">
        <button
          type="button"
          class="tab-pill"
          class:active={omniPane === 'home'}
          on:click={() => {
            omniPane = 'home';
          }}
        >
          Extension &amp; tree
        </button>
        <button type="button" class="tab-pill" class:active={omniPane === 'summaries'} on:click={openSummariesTab}>
          Summaries
        </button>
        <button type="button" class="tab-pill" class:active={omniPane === 'projects'} on:click={openProjectsTab}>
          Projects
        </button>
      </nav>
    </div>
    {#if omniPane === 'home'}
      <button type="button" class="reset-btn" on:click={resetSkillTree}>Reset demo tree</button>
    {:else}
      <div class="header-spacer" aria-hidden="true"></div>
    {/if}
  </header>

  {#if omniPane === 'summaries'}
    <main class="summaries-main omni-scroll">
      <section class="summaries-panel">
        <div class="summaries-actions">
          <h2 class="summaries-heading summaries-heading-inline">Extension summaries</h2>
          {#if auth.token}
            <button type="button" class="summaries-refresh-btn" on:click={refreshSummaries} disabled={sumLoadPending}>
              {sumLoadPending ? 'Refreshing…' : 'Refresh'}
            </button>
          {/if}
        </div>
        <p class="summaries-lede">
          These jobs are queued from the Omni browser extension (for example “summarize this page”). There is nothing to
          paste here: the extension sends the captured tab body and HoverArt summarizes it against your account.
        </p>

        {#if !auth.token}
          <p class="summaries-auth-hint">
            <a href="/login" class="link-cyan">Sign in</a> or <a href="/register" class="link-cyan">create an account</a>
            to see your summaries.
          </p>
        {:else}
          <p class="summaries-signed">
            Signed in as <strong>{auth.user?.username ?? 'user'}</strong>
          </p>

          {#if sumError}<p class="summaries-error">{sumError}</p>{/if}

          <h3 class="summaries-list-title">Recent extension jobs</h3>
          {#if sumLoadPending}
            <p class="summaries-muted">Loading…</p>
          {:else if sumList.length === 0}
            <p class="summaries-muted">
              Nothing yet — trigger a summarize from the Omni extension on a webpage; completed text appears here when
              ready.
            </p>
          {:else}
            <ul class="summaries-list">
              {#each sumList as row (row.id)}
                <li class="summary-card">
                  <div class="summary-card-meta">
                    <span class="summary-title">{row.title || 'Untitled'}</span>
                    <span class="summary-status" data-status={row.status}>{row.status}</span>
                    <time datetime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
                  </div>
                  {#if row.project_id != null}
                    <div class="summary-project-chip">
                      <a class="link-cyan" href="/omni?tab=projects&project={row.project_id}"
                        >Project #{row.project_id}</a
                      >
                    </div>
                  {/if}
                  {#if row.source_url}
                    <div class="summary-url"><a href={row.source_url} class="link-cyan">{row.source_url}</a></div>
                  {/if}
                  {#if row.ai_summary}
                    <pre class="summary-body">{row.ai_summary}</pre>
                  {:else if row.error_detail}
                    <p class="summaries-error">{row.error_detail}</p>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </section>
    </main>
  {:else if omniPane === 'projects'}
    <main class="projects-main omni-scroll">
      <section class="projects-panel">
        <h2 class="projects-heading">Projects — ChatGPT, PDFs &amp; extension saves</h2>
        <p class="projects-lede">
          When you export a thread from ChatGPT/OpenAI via the Omni extension, HoverArt creates a <strong
            >project</strong
          >
          containing the transcript and a backend AI digest linked to your account. You can also stash diagrams or long
          write-ups via voice commands (“save this Mermaid diagram to HoverArt project &lt;topic&gt;”) when the Omni
          planner runs.
        </p>

        {#if !auth.token}
          <p class="summaries-auth-hint">
            <a href="/login" class="link-cyan">Sign in</a> to list projects or
            <a href="/register" class="link-cyan">register</a>.
          </p>
        {:else}
          <p class="summaries-signed">
            Signed in as <strong>{auth.user?.username ?? 'user'}</strong>
          </p>

          {#if projErr}<p class="summaries-error">{projErr}</p>{/if}

          <div class="projects-split">
            <div class="projects-list-col">
              <h3 class="summaries-list-title">Your projects</h3>
              {#if projLoading}
                <p class="summaries-muted">Loading…</p>
              {:else if projList.length === 0}
                <p class="summaries-muted">
                  No projects yet — when you export a ChatGPT thread or save artifacts via the Omni extension against
                  this account, they will show here.
                </p>
              {:else}
                <ul class="projects-list">
                  {#each projList as p (p.id)}
                    <li>
                      <button
                        type="button"
                        class="project-row-btn"
                        class:active-project={selProjectId === p.id}
                        on:click={() => loadProjectDetail(p.id)}
                      >
                        <span class="project-row-title">{p.title}</span>
                        <span class="project-row-meta">{p.artifact_count} artifacts · {p.summary_count} summaries</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="projects-detail-col">
              {#if selProjectId == null}
                <p class="summaries-muted">Select a project to view transcripts, notes, diagrams, and digests.</p>
              {:else if projDetailLoading}
                <p class="summaries-muted">Loading project…</p>
              {:else}
                <h3 class="project-detail-title">{projDetailMeta?.title ?? `Project #${selProjectId}`}</h3>
                <p class="detail-sub">
                  Artifacts logged from the browser; summaries queued on the HoverArt backend.
                </p>

                <h4 class="artifacts-title">Artifacts</h4>
                {#if projArtifacts.length === 0}
                  <p class="summaries-muted">None yet.</p>
                {:else}
                  <ul class="artifact-list">
                    {#each projArtifacts as a (a.id)}
                      <li class="artifact-card">
                        <div class="artifact-meta">
                          <span class="artifact-kind">{a.kind}</span>
                          {#if a.title}<span class="artifact-t">{a.title}</span>{/if}
                          <time datetime={a.created_at}>{new Date(a.created_at).toLocaleString()}</time>
                        </div>
                        {#if a.body_length && a.body_length > (a.body_text_preview?.length ?? 0)}
                          <span class="artifact-trunc-note">Showing preview ({a.body_length.toLocaleString()} chars total).</span>
                        {/if}
                        <pre class="artifact-preview">{a.body_text_preview}</pre>
                      </li>
                    {/each}
                  </ul>
                {/if}

                <h4 class="artifacts-title linked-sums">Digest summaries</h4>
                {#if projSummaries.length === 0}
                  <p class="summaries-muted">No linked summaries.</p>
                {:else}
                  <ul class="summaries-sublist">
                    {#each projSummaries as s (s.id)}
                      <li>
                        <strong>{s.title || 'Untitled'}</strong>
                        <span class="project-sum-status">{s.status}</span>
                        {#if s.ai_summary}
                          <pre class="summary-body small-summary">{s.ai_summary}</pre>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </div>
          </div>
        {/if}
      </section>
    </main>
  {:else}
  <div class="omni-main omni-scroll">
    <section class="extension-panel" aria-labelledby="extension-heading">
      <h2 id="extension-heading">Use Omni with voice — in the browser extension</h2>
      <p class="extension-lede">
        Voice commands, tasks, and the live skill graph run inside the Chrome / Edge extension. This page shows a
        <strong>preview skill tree</strong> stored in your browser for HoverArt only, plus how to install the extension.
        For PDF or locked viewers the extension may instead queue a summarize job to your HoverArt account (see Summaries).
        Use <strong>Projects</strong> on this page to browse transcripts, notes, or diagrams Omni has saved while you stay
        signed in here.
      </p>

      <div class="extension-card">
        <h3>Install (load unpacked)</h3>
        <ol class="install-steps">
          <li>Clone or download this project and open the <code>omni-extension</code> folder on your machine.</li>
          <li>
            In Chrome or Edge, go to <code>chrome://extensions</code> (or <code>edge://extensions</code>).
          </li>
          <li>Enable <strong>Developer mode</strong>.</li>
          <li>Click <strong>Load unpacked</strong> and select the <code>omni-extension</code> folder.</li>
          <li>Pin Omni from the extensions menu and speak from the extension popup — not from this webpage.</li>
        </ol>
        <p class="icon-note">
          If the loader complains about missing icons, add PNGs at <code>omni-extension/icons/icon16.png</code> …
          <code>icon128.png</code>, then reload the extension.
        </p>
        <div class="path-hint">
          <span class="path-label">Folder in repo</span>
          <code class="path-value">{extensionFolderPath}</code>
        </div>
      </div>
    </section>

    <section class="skill-section" aria-labelledby="skill-heading">
      <div class="panel-header">
        <h2 id="skill-heading">Skill tree (preview)</h2>
        <div class="tree-stats">
          <span class="stat">
            <span class="stat-value">{skills.filter((s) => s.unlocked).length}</span>
            <span class="stat-label">Unlocked</span>
          </span>
          <span class="stat">
            <span class="stat-value">{Math.max(...skills.map((s) => s.level), 0)}</span>
            <span class="stat-label">Max level</span>
          </span>
        </div>
      </div>
      <div class="tree-wrap">
        <SkillTree {skills} />
      </div>
    </section>
  </div>
  {/if}
</div>

<style>
  :global(body) {
    overflow: hidden;
  }

  .omni-container {
    position: fixed;
    inset: 0;
    background: #070710;
    color: #e0e0f0;
    font-family: 'Space Mono', monospace;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .omni-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  .omni-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    animation: drift 12s ease-in-out infinite;
  }

  .orb-1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(0, 245, 255, 0.15) 0%, transparent 70%);
    top: -100px;
    left: -100px;
  }

  .orb-2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(255, 78, 205, 0.12) 0%, transparent 70%);
    bottom: -100px;
    right: -100px;
    animation-delay: -4s;
  }

  .orb-3 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.1) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -8s;
  }

  @keyframes drift {
    0%,
    100% {
      transform: translate(0, 0);
    }
    33% {
      transform: translate(30px, -30px);
    }
    66% {
      transform: translate(-30px, 20px);
    }
  }

  .omni-header {
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(7, 7, 16, 0.95);
    backdrop-filter: blur(12px);
    flex-shrink: 0;
  }

  .omni-header-center {
    justify-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
  }

  .omni-tabstrip {
    display: flex;
    gap: 0.4rem;
  }

  .tab-pill {
    font-family: 'Syne', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.45rem 0.95rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition:
      border-color 0.2s,
      color 0.2s;
  }

  .tab-pill:hover {
    border-color: rgba(0, 245, 255, 0.4);
    color: #fff;
  }

  .tab-pill.active {
    border-color: #00f5ff;
    color: #00f5ff;
    background: rgba(0, 245, 255, 0.06);
  }

  .header-spacer {
    justify-self: end;
    width: 1px;
    height: 1px;
  }

  .back-btn {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    transition: color 0.2s;
  }

  .back-btn:hover {
    color: #00f5ff;
  }

  .omni-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: 'Syne', sans-serif;
    font-size: 1.8rem;
    font-weight: 900;
    color: white;
  }

  .logo-icon {
    color: #00f5ff;
    font-size: 2rem;
  }

  .reset-btn {
    font-size: 0.75rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    justify-self: end;
  }

  .reset-btn:hover {
    border-color: #ff4ecd;
    color: #ff4ecd;
  }

  .omni-main {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .extension-panel {
    flex-shrink: 0;
    padding: 1.25rem 2rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(13, 13, 26, 0.5);
    max-width: 920px;
  }

  #extension-heading {
    font-family: 'Syne', sans-serif;
    font-size: 1.15rem;
    font-weight: 800;
    color: #fff;
    margin: 0 0 0.5rem;
  }

  .extension-lede {
    margin: 0 0 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.55);
    max-width: 70ch;
  }

  .extension-lede strong {
    color: rgba(255, 255, 255, 0.85);
  }

  .extension-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(0, 245, 255, 0.15);
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }

  .extension-card h3 {
    margin: 0 0 0.75rem;
    font-family: 'Syne', sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    color: #00f5ff;
  }

  .install-steps {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.78rem;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.75);
  }

  .install-steps li {
    margin-bottom: 0.35rem;
  }

  .install-steps code {
    font-size: 0.92em;
    background: rgba(255, 255, 255, 0.06);
    padding: 0.1em 0.35em;
    border-radius: 3px;
  }

  .icon-note {
    margin: 0.85rem 0 0;
    font-size: 0.72rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
  }

  .path-hint {
    margin-top: 0.85rem;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  .path-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.35);
  }

  .path-value {
    font-size: 0.75rem;
    color: rgba(0, 245, 255, 0.85);
    background: rgba(0, 245, 255, 0.06);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .skill-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: rgba(7, 7, 16, 0.6);
  }

  .panel-header {
    padding: 1rem 2rem 0.75rem;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .panel-header h2 {
    font-family: 'Syne', sans-serif;
    font-size: 1.35rem;
    font-weight: 800;
    color: white;
    margin-bottom: 0.5rem;
  }

  .tree-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-value {
    font-family: 'Syne', sans-serif;
    font-size: 1.5rem;
    font-weight: 900;
    color: #00f5ff;
  }

  .stat-label {
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.3);
  }

  .tree-wrap {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .summaries-main {
    padding: 1.75rem 2rem 4rem;
    max-width: 880px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .summaries-panel {
    background: rgba(13, 13, 26, 0.45);
    border: 1px solid rgba(0, 245, 255, 0.12);
    border-radius: 10px;
    padding: 1.5rem 1.65rem;
  }

  .summaries-heading {
    font-family: 'Syne', sans-serif;
    font-size: 1.35rem;
    font-weight: 800;
    color: white;
    margin: 0 0 0.75rem;
  }

  .summaries-lede {
    margin: 0 0 1.35rem;
    font-size: 0.82rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.62);
    max-width: 70ch;
  }

  .summaries-lede code {
    font-size: 0.92em;
    background: rgba(255, 255, 255, 0.07);
    padding: 0.1em 0.35em;
    border-radius: 4px;
  }

  .summaries-auth-hint,
  .summaries-signed {
    font-size: 0.82rem;
    margin: 0 0 1.25rem;
  }

  .link-cyan {
    color: #00f5ff;
    text-decoration: none;
  }

  .link-cyan:hover {
    text-decoration: underline;
  }

  .summaries-form label {
    display: block;
    font-size: 0.74rem;
    color: rgba(255, 255, 255, 0.55);
    margin-bottom: 1rem;
  }

  .summaries-form input,
  .summaries-form textarea {
    display: block;
    width: 100%;
    margin-top: 0.35rem;
    box-sizing: border-box;
    padding: 0.55rem 0.65rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e0e0f0;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .summaries-form textarea {
    resize: vertical;
    min-height: 180px;
  }

  .summaries-error {
    color: #f87171;
    font-size: 0.8rem;
    margin: 0.25rem 0 1rem;
  }

  .summaries-submit {
    padding: 0.65rem 1.35rem;
    border-radius: 8px;
    border: none;
    background: #00f5ff;
    color: #070710;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .summaries-submit:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .summaries-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.85rem;
  }

  .summaries-heading-inline {
    margin: 0 !important;
  }

  .summaries-refresh-btn {
    font-family: 'Syne', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.45rem 0.95rem;
    border-radius: 8px;
    border: 1px solid rgba(0, 245, 255, 0.35);
    background: rgba(0, 245, 255, 0.06);
    color: #00f5ff;
    cursor: pointer;
  }

  .summaries-refresh-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .summaries-list-title {
    font-family: 'Syne', sans-serif;
    font-size: 1rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.9);
    margin: 2rem 0 0.85rem;
  }

  .summaries-muted {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  .summaries-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary-card {
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 1rem 1.1rem;
    font-size: 0.78rem;
  }

  .summary-card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    margin-bottom: 0.5rem;
  }

  .summary-title {
    font-weight: 800;
    color: white;
    font-family: 'Syne', sans-serif;
  }

  .summary-status {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.62rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.65);
  }

  .summary-status[data-status='done'] {
    border-color: rgba(52, 211, 153, 0.5);
    color: #34d399;
  }

  .summary-status[data-status='failed'] {
    border-color: rgba(248, 113, 113, 0.5);
    color: #fca5a5;
  }

  .summary-url {
    margin-bottom: 0.65rem;
    word-break: break-all;
    font-size: 0.7rem;
  }

  .summary-card time {
    margin-left: auto;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.38);
    white-space: nowrap;
  }

  .summary-body {
    white-space: pre-wrap;
    margin: 0;
    font-size: 0.74rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.82);
  }

  .summary-project-chip {
    margin-bottom: 0.55rem;
    font-size: 0.74rem;
  }

  .projects-main {
    padding: 1.75rem 2rem 4rem;
    max-width: 1100px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .projects-heading {
    font-family: 'Syne', sans-serif;
    font-size: 1.35rem;
    font-weight: 800;
    color: white;
    margin: 0 0 0.75rem;
  }

  .projects-lede {
    margin: 0 0 1.35rem;
    font-size: 0.82rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.62);
    max-width: 78ch;
  }

  .projects-panel {
    background: rgba(13, 13, 26, 0.45);
    border: 1px solid rgba(167, 139, 250, 0.2);
    border-radius: 10px;
    padding: 1.5rem 1.65rem;
  }

  .projects-split {
    display: grid;
    grid-template-columns: minmax(200px, 320px) 1fr;
    gap: 1.5rem;
    align-items: start;
    margin-top: 0.5rem;
  }

  .projects-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .project-row-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    width: 100%;
    text-align: left;
    padding: 0.65rem 0.75rem;
    margin-bottom: 0.45rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.28);
    color: #e0e0f0;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
  }

  .project-row-btn:hover {
    border-color: rgba(0, 245, 255, 0.25);
  }

  .project-row-btn.active-project {
    border-color: rgba(0, 245, 255, 0.45);
    box-shadow: 0 0 0 1px rgba(0, 245, 255, 0.08);
  }

  .project-row-title {
    font-weight: 600;
  }

  .project-row-meta {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .projects-detail-col {
    min-width: 0;
  }

  .project-detail-title {
    margin: 0 0 0.35rem;
    font-family: 'Syne', sans-serif;
    font-size: 1.08rem;
    color: white;
  }

  .detail-sub {
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.45);
    margin: 0 0 1.25rem;
  }

  .artifacts-title {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.45);
    margin: 1.25rem 0 0.6rem;
  }

  .artifacts-title.linked-sums {
    margin-top: 2rem;
  }

  .artifact-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .artifact-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.75rem 0.85rem;
    margin-bottom: 0.65rem;
    background: rgba(0, 0, 0, 0.2);
  }

  .artifact-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
    margin-bottom: 0.45rem;
  }

  .artifact-kind {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #a78bfa;
    font-weight: 700;
  }

  .artifact-trunc-note {
    display: block;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 0.35rem;
  }

  .artifact-preview {
    margin: 0;
    white-space: pre-wrap;
    font-size: 0.72rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.8);
    max-height: 240px;
    overflow: auto;
  }

  .summaries-sublist {
    margin: 0;
    padding: 0 0 0 1rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.78);
    line-height: 1.5;
  }

  .summaries-sublist li {
    margin-bottom: 0.85rem;
  }

  .project-sum-status {
    margin-left: 0.35rem;
    font-size: 0.62rem;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .small-summary {
    margin-top: 0.35rem;
    font-size: 0.7rem !important;
    max-height: 160px;
    overflow: auto;
  }

  @media (max-width: 768px) {
    .projects-split {
      grid-template-columns: 1fr;
    }

    .extension-panel {
      padding: 1rem 1rem 0.75rem;
    }

    .panel-header {
      padding: 0.75rem 1rem;
    }

    #extension-heading {
      font-size: 1rem;
    }
  }
</style>
