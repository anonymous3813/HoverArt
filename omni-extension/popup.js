console.log('Omni popup loaded');
let skills = [];
let commandBusy = false;
let lastDedupeCmd = '';
let lastDedupeAt = 0;
let recognition = null;
let voiceListening = false;
const EXAMPLE_COMMANDS = [
    'Summarize this page',
    'Take a screenshot',
    'Analyze this page',
    'Bookmark this page',
    'Read page content aloud',
    'Extract all links',
    'Scroll to the bottom',
    'Mute this tab',
    'Duplicate this tab',
    'Close duplicate tabs',
    'Go to Wikipedia',
    'Download this image',
    'Clear site cookies',
    'Show browsing history',
    'Capture full page screenshot',
    'Fill the search box',
    'Click submit',
    'Translate selection to Spanish',
    'Hide banner ads',
    'Enable reader focus mode'
];
document.addEventListener('DOMContentLoaded', async () => {
    renderExampleTicker();
    await loadSkills();
    updateSkillCount();
    chrome.runtime.sendMessage({ type: 'SYNC_HOVERART_JWT_FROM_TAB' }, () => void chrome.runtime?.lastError);
    initSpeechRecognitionIfPossible();
    attachEventListeners();
});
function initSpeechRecognitionIfPossible() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById('voiceBtn');
    if (!SpeechRecognition) {
        if (btn) {
            btn.disabled = true;
            updateStatus('Speech recognition unavailable in this browser.');
        }
        return;
    }
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang =
        navigator.language && /^en/i.test(navigator.language) ? navigator.language : 'en-US';
    recognition.onstart = () => {
        voiceListening = true;
        if (btn)
            btn.classList.add('active');
        updateStatus('Listening…');
    };
    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        transcript = transcript.trim();
        if (transcript)
            displayTranscript(transcript);
        const last = event.results[event.results.length - 1];
        if (last?.isFinal && transcript) {
            const now = Date.now();
            if (transcript !== lastDedupeCmd || now - lastDedupeAt > 900) {
                lastDedupeCmd = transcript;
                lastDedupeAt = now;
                executeCommand(transcript);
            }
        }
    };
    recognition.onerror = (event) => {
        voiceListening = false;
        if (btn)
            btn.classList.remove('active');
        let code = event.error || 'unknown';
        if (code === 'aborted')
            return;
        updateStatus(voiceErrorLabel(code));
    };
    recognition.onend = () => {
        voiceListening = false;
        if (btn)
            btn.classList.remove('active');
        if (!commandBusy)
            updateStatus('Tap the mic to speak');
    };
}
async function primeMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia)
        return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return true;
    }
    catch (e) {
        const name = e && e.name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            updateStatus('Microphone denied — open chrome://extensions, find Omni → Details, allow Microphone (or Site settings → Mic → Allow for this extension).');
            return false;
        }
        if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            updateStatus('No microphone detected — plug in or enable a mic and try again.');
            return false;
        }
        console.warn('primeMicrophone getUserMedia (non-fatal):', name || e);
        return true;
    }
}
async function toggleVoice() {
    if (!recognition) {
        updateStatus('Speech recognition not available.');
        return;
    }
    if (voiceListening) {
        recognition.stop();
        return;
    }
    updateStatus('Allowing microphone…');
    const ok = await primeMicrophone();
    if (!ok)
        return;
    updateStatus('Starting…');
    try {
        recognition.start();
    }
    catch (err) {
        console.error(err);
        if (err?.name === 'InvalidStateError') {
            recognition.stop();
            setTimeout(() => {
                try {
                    recognition.start();
                }
                catch (e2) {
                    updateStatus('Mic busy — tap again.');
                }
            }, 140);
            return;
        }
        updateStatus('Could not start listening.');
    }
}
function voiceErrorLabel(code) {
    if (!code)
        return 'Voice error';
    if (code === 'not-allowed')
        return 'Microphone denied — allow mic for Omni in browser settings.';
    if (code === 'no-speech')
        return 'No speech heard — try again';
    if (code === 'network')
        return 'Speech service unreachable — check connection';
    if (code === 'service-not-allowed')
        return 'Voice service blocked for this popup — check browser flags / settings.';
    return 'Voice: ' + code;
}
function renderExampleTicker() {
    const segA = document.getElementById('tickerSegA');
    const segB = document.getElementById('tickerSegB');
    fillTickerSegment(segA);
    fillTickerSegment(segB);
}
function fillTickerSegment(el) {
    el.innerHTML = '';
    EXAMPLE_COMMANDS.forEach((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        el.appendChild(span);
        const dot = document.createElement('span');
        dot.className = 'ticker-dot';
        dot.textContent = ' • ';
        el.appendChild(dot);
    });
}
async function loadSkills() {
    const data = await chrome.storage.local.get('skills');
    skills = data.skills || [];
}
function updateSkillCount() {
    document.getElementById('skillNumber').textContent = String(skills.length);
}
function attachEventListeners() {
    document.getElementById('voiceBtn')?.addEventListener('click', () => toggleVoice());
    document.querySelectorAll('.action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            if (action)
                await executeQuickAction(action);
        });
    });
    document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    });
    document.getElementById('viewTreeLink').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('tree.html') });
    });
}
function updateStatus(text) {
    document.getElementById('statusText').textContent = text;
}
function displayTranscript(text) {
    document.getElementById('transcript').textContent = text || '…';
}
function dedupeRepeatedParagraphs(blob) {
    const chunks = String(blob || '').split(/\n\s*\n/);
    const out = [];
    let prev = '';
    for (const chunk of chunks) {
        const t = chunk.trim();
        if (!t)
            continue;
        if (t === prev)
            continue;
        prev = t;
        out.push(t);
    }
    return out.join('\n\n');
}
function formatResultForPopup(r) {
    if (!r || typeof r !== 'object')
        return '';
    const parts = [];
    if (r.assistantNote)
        parts.push(String(r.assistantNote));
    if (typeof r.summary === 'string' && r.summary.trim())
        parts.push(r.summary.trim());
    if (typeof r.content === 'string' && r.content.trim())
        parts.push(r.content.trim());
    if (typeof r.message === 'string' && r.message.trim())
        parts.push(r.message.trim());
    if (typeof r.screenshotSavedAs === 'string' && r.screenshotSavedAs.trim()) {
        parts.push(`Saved PNG as: ${r.screenshotSavedAs.trim()}`);
    }
    if (typeof r.downloadedAs === 'string' && r.downloadedAs.trim()) {
        parts.push(`Saved document: ${r.downloadedAs.trim()}`);
    }
    if (r.analysis && typeof r.analysis === 'object') {
        const a = r.analysis;
        const line = [
            a.title ? `Title: ${a.title}` : '',
            a.url ? `URL: ${a.url}` : '',
            typeof a.wordCount === 'number' ? `Words: ${a.wordCount}` : '',
            typeof a.linkCount === 'number' ? `Links: ${a.linkCount}` : ''
        ]
            .filter(Boolean)
            .join('\n');
        if (line)
            parts.push(line);
    }
    if (Array.isArray(r.lines) && r.lines.length) {
        parts.push(r.lines.filter(Boolean).join('\n'));
    }
    if (typeof r.suggestedUrl === 'string' && r.suggestedUrl.trim()) {
        parts.push(`Open HoverArt summaries: ${r.suggestedUrl.trim()}`);
    }
    if (typeof r.hoverartProjectUrl === 'string' && r.hoverartProjectUrl.trim()) {
        parts.push(`HoverArt project: ${r.hoverartProjectUrl.trim()}`);
    }
    if (r.usedSkill && parts.length === 0)
        parts.push(`Re-used skill "${r.usedSkill}".`);
    return dedupeRepeatedParagraphs(parts.join('\n\n').trim());
}
async function executeCommand(command) {
    const cmd = (command || '').trim();
    if (!cmd || commandBusy)
        return;
    commandBusy = true;
    updateStatus('Running…');
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab?.id;
        const response = await chrome.runtime.sendMessage({
            type: 'EXECUTE_TASK',
            task: cmd,
            data: {},
            tabId
        });
        const lastErr = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : null;
        if (lastErr?.message) {
            updateStatus(lastErr.message);
            return;
        }
        if (!response) {
            updateStatus('No response — reload Omni in chrome://extensions');
            return;
        }
        const r = response.result;
        if (response.success) {
            updateStatus('Done');
            if (r && r.usedSkill)
                speak('Used saved skill.');
            await loadSkills();
            updateSkillCount();
            const text = formatResultForPopup(r);
            if (text)
                displayTranscript(text.slice(0, 4500));
            else
                displayTranscript('Omni ran but returned no displayable text.');
        }
        else {
            updateStatus('Failed: ' + (response.error || 'unknown'));
            const failText = formatResultForPopup(r);
            if (failText)
                displayTranscript(failText.slice(0, 4500));
        }
    }
    catch (error) {
        console.error('executeCommand:', error);
        updateStatus('Error: ' + (error.message || String(error)));
    }
    finally {
        commandBusy = false;
    }
}
async function executeQuickAction(action) {
    let task = '';
    switch (action) {
        case 'summarize':
            task = 'Summarize this page';
            break;
        case 'read':
            task = 'Read the content of this page';
            break;
        case 'extract':
            task = 'Extract text from this page';
            break;
        case 'screenshot':
            task = 'Take a screenshot';
            break;
        default:
            return;
    }
    await executeCommand(task);
}
function speak(text) {
    try {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.volume = 0.9;
        speechSynthesis.speak(utterance);
    }
    catch (_) { }
}
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault();
        toggleVoice();
    }
});
