console.log('Omni Enhanced background service worker loaded');
let skillTree = [];
let settings = {};
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Omni extension installed/updated');
    const data = await chrome.storage.local.get(['skills', 'settings']);
    skillTree = data.skills || getInitialSkills();
    settings = { ...getDefaultSettings(), ...(data.settings || {}) };
    await chrome.storage.local.set({ skills: skillTree, settings });
    createContextMenus();
    chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});
chrome.runtime.onStartup.addListener(() => {
    createContextMenus();
});
function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        const menus = [
            { id: 'omni-analyze', title: 'Omni: Analyze page', contexts: ['page'] },
            {
                id: 'omni-export-chatgpt',
                title: 'Omni: Save ChatGPT thread to HoverArt',
                contexts: ['page'],
                documentUrlPatterns: [
                    'https://chat.openai.com/*',
                    'https://chatgpt.com/*',
                    'https://*.chatgpt.com/*'
                ]
            },
            { id: 'omni-summarize', title: 'Omni: Summarize selection', contexts: ['selection'] },
            { id: 'omni-extract', title: 'Omni: Extract data', contexts: ['page'] },
            { id: 'omni-translate', title: 'Omni: Translate', contexts: ['selection'] },
            { id: 'omni-search', title: 'Omni: Search for "%s"', contexts: ['selection'] },
            { id: 'omni-save', title: 'Omni: Save to notes', contexts: ['selection'] },
            { id: 'omni-image', title: 'Omni: Analyze image', contexts: ['image'] },
            { id: 'omni-link', title: 'Omni: Open in background', contexts: ['link'] },
            { id: 'omni-video', title: 'Omni: Download video', contexts: ['video'] }
        ];
        menus.forEach((menu) => chrome.contextMenus.create(menu));
    });
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
    handleContextMenu(info, tab);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    (async () => {
        try {
            let result;
            switch (message.type) {
                case 'EXECUTE_TASK': {
                    let tid = message.tabId ?? sender.tab?.id;
                    if (tid == null) {
                        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
                        tid = active?.id;
                    }
                    result = await handleTask(message.task, message.data, tid);
                    break;
                }
                case 'GET_ALL_TABS':
                    result = await chrome.tabs.query({});
                    break;
                case 'CLOSE_TAB':
                    await chrome.tabs.remove(message.tabId);
                    result = { success: true };
                    break;
                case 'DUPLICATE_TAB':
                    result = await chrome.tabs.duplicate(message.tabId);
                    break;
                case 'PIN_TAB':
                    result = await chrome.tabs.update(message.tabId, { pinned: message.pinned });
                    break;
                case 'MUTE_TAB':
                    result = await chrome.tabs.update(message.tabId, { muted: message.muted });
                    break;
                case 'GROUP_TABS':
                    result = await groupTabs(message.tabIds, message.groupName);
                    break;
                case 'MOVE_TAB':
                    result = await chrome.tabs.move(message.tabId, { index: message.index });
                    break;
                case 'GET_WINDOWS':
                    result = await chrome.windows.getAll({ populate: true });
                    break;
                case 'CREATE_WINDOW':
                    result = await chrome.windows.create(message.options);
                    break;
                case 'CLOSE_WINDOW':
                    await chrome.windows.remove(message.windowId);
                    result = { success: true };
                    break;
                case 'MAXIMIZE_WINDOW':
                    result = await chrome.windows.update(message.windowId, { state: 'maximized' });
                    break;
                case 'MINIMIZE_WINDOW':
                    result = await chrome.windows.update(message.windowId, { state: 'minimized' });
                    break;
                case 'FULLSCREEN_WINDOW':
                    result = await chrome.windows.update(message.windowId, { state: 'fullscreen' });
                    break;
                case 'GET_BOOKMARKS':
                    result = await chrome.bookmarks.getTree();
                    break;
                case 'CREATE_BOOKMARK':
                    result = await chrome.bookmarks.create(message.bookmark);
                    break;
                case 'SEARCH_BOOKMARKS':
                    result = await chrome.bookmarks.search(message.query);
                    break;
                case 'DELETE_BOOKMARK':
                    await chrome.bookmarks.remove(message.bookmarkId);
                    result = { success: true };
                    break;
                case 'EXPORT_BOOKMARKS':
                    result = await exportBookmarks();
                    break;
                case 'GET_HISTORY':
                    result = await chrome.history.search({
                        text: message.query || '',
                        maxResults: message.maxResults || 100,
                        startTime: message.startTime || 0
                    });
                    break;
                case 'DELETE_HISTORY':
                    await chrome.history.deleteUrl({ url: message.url });
                    result = { success: true };
                    break;
                case 'CLEAR_HISTORY':
                    await chrome.history.deleteAll();
                    result = { success: true };
                    break;
                case 'GET_VISITS':
                    result = await chrome.history.getVisits({ url: message.url });
                    break;
                case 'DOWNLOAD_FILE':
                    result = await chrome.downloads.download({
                        url: message.url,
                        filename: message.filename,
                        saveAs: message.saveAs || false
                    });
                    break;
                case 'GET_DOWNLOADS':
                    result = await chrome.downloads.search(message.query || {});
                    break;
                case 'PAUSE_DOWNLOAD':
                    await chrome.downloads.pause(message.downloadId);
                    result = { success: true };
                    break;
                case 'RESUME_DOWNLOAD':
                    await chrome.downloads.resume(message.downloadId);
                    result = { success: true };
                    break;
                case 'CANCEL_DOWNLOAD':
                    await chrome.downloads.cancel(message.downloadId);
                    result = { success: true };
                    break;
                case 'OPEN_DOWNLOAD':
                    await chrome.downloads.open(message.downloadId);
                    result = { success: true };
                    break;
                case 'GET_COOKIES':
                    result = await chrome.cookies.getAll(message.details || {});
                    break;
                case 'SET_COOKIE':
                    result = await chrome.cookies.set(message.details);
                    break;
                case 'DELETE_COOKIE':
                    await chrome.cookies.remove(message.details);
                    result = { success: true };
                    break;
                case 'CLEAR_COOKIES':
                    const cookies = await chrome.cookies.getAll({});
                    for (const cookie of cookies) {
                        await chrome.cookies.remove({
                            url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
                            name: cookie.name
                        });
                    }
                    result = { success: true, count: cookies.length };
                    break;
                case 'COPY_TO_CLIPBOARD':
                    await copyToClipboard(message.text);
                    result = { success: true };
                    break;
                case 'PASTE_FROM_CLIPBOARD':
                    result = await pasteFromClipboard();
                    break;
                case 'SHOW_NOTIFICATION':
                    result = await chrome.notifications.create({
                        type: 'basic',
                        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
                        title: message.title || 'Omni',
                        message: message.message,
                        priority: message.priority || 1
                    });
                    break;
                case 'CLEAR_NOTIFICATIONS':
                    const notifications = await chrome.notifications.getAll();
                    for (const id in notifications) {
                        await chrome.notifications.clear(id);
                    }
                    result = { success: true };
                    break;
                case 'GET_RECENT_CLOSED':
                    result = await chrome.sessions.getRecentlyClosed({ maxResults: message.maxResults || 10 });
                    break;
                case 'RESTORE_SESSION':
                    result = await chrome.sessions.restore(message.sessionId);
                    break;
                case 'GET_TOP_SITES':
                    result = await chrome.topSites.get();
                    break;
                case 'CAPTURE_VISIBLE_TAB':
                    result = await chrome.tabs.captureVisibleTab({ format: message.format || 'png' });
                    break;
                case 'CAPTURE_FULL_PAGE':
                    result = await captureFullPage(message.tabId);
                    break;
                case 'GET_PAGE_CONTENT':
                    result = await getPageContent(message.tabId || sender.tab?.id);
                    break;
                case 'ANALYZE_PAGE':
                    result = await analyzePage(message.tabId || sender.tab?.id);
                    break;
                case 'EXTRACT_IMAGES':
                    result = await extractImages(message.tabId || sender.tab?.id);
                    break;
                case 'EXTRACT_LINKS':
                    result = await extractLinks(message.tabId || sender.tab?.id);
                    break;
                case 'EXTRACT_TABLES':
                    result = await extractTables(message.tabId || sender.tab?.id);
                    break;
                case 'EXTRACT_FORMS':
                    result = await extractForms(message.tabId || sender.tab?.id);
                    break;
                case 'TRANSLATE_TEXT':
                    result = await translateText(message.text, message.targetLang);
                    break;
                case 'SUMMARIZE_TEXT':
                    result = await summarizeText(message.text);
                    break;
                case 'ANALYZE_SENTIMENT':
                    result = await analyzeSentiment(message.text);
                    break;
                case 'EXTRACT_KEYWORDS':
                    result = await extractKeywords(message.text);
                    break;
                case 'GET_SYSTEM_INFO':
                    result = await getSystemInfo();
                    break;
                case 'CHECK_IDLE_STATE':
                    result = await chrome.idle.queryState(message.detectionIntervalInSeconds || 60);
                    break;
                case 'CREATE_ALARM':
                    await chrome.alarms.create(message.name, message.alarmInfo);
                    result = { success: true };
                    break;
                case 'GET_ALARMS':
                    result = await chrome.alarms.getAll();
                    break;
                case 'CLEAR_ALARM':
                    await chrome.alarms.clear(message.name);
                    result = { success: true };
                    break;
                case 'GET_SKILLS':
                    const skills = await chrome.storage.local.get('skills');
                    result = skills.skills || skillTree;
                    break;
                case 'SAVE_SKILL':
                    await saveSkill(message.skill);
                    result = { success: true };
                    break;
                case 'DELETE_SKILL':
                    await deleteSkill(message.skillId);
                    result = { success: true };
                    break;
                case 'EXPORT_SKILLS':
                    result = await exportSkills();
                    break;
                case 'IMPORT_SKILLS':
                    result = await importSkills(message.skills);
                    break;
                case 'UPDATE_SETTINGS':
                    await chrome.storage.local.set({ settings: message.settings });
                    settings = message.settings;
                    result = { success: true };
                    break;
                case 'GET_SETTINGS':
                    const settingsData = await chrome.storage.local.get('settings');
                    result = settingsData.settings || settings;
                    break;
                case 'SYNC_HOVERART_JWT_FROM_TAB':
                    await ensureHoverArtJwtFromOpenTabs();
                    {
                        let h = '';
                        try {
                            h = (await mergeOmniSettings()).hoverArtJwt || '';
                        }
                        catch {
                            h = '';
                        }
                        result = { success: true, hasJwt: String(h).trim().length > 40 };
                    }
                    break;
                default:
                    result = { success: false, error: 'Unknown message type' };
            }
            const logicalFail = result &&
                typeof result === 'object' &&
                Object.prototype.hasOwnProperty.call(result, 'success') &&
                result.success === false;
            if (logicalFail) {
                sendResponse({
                    success: false,
                    error: String(result.message || result.error || 'Task failed'),
                    result
                });
            }
            else {
                sendResponse({ success: true, result });
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
});
async function groupTabs(tabIds, groupName) {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
        title: groupName,
        color: 'cyan'
    });
    return { groupId, success: true };
}
async function copyToClipboard(text) {
    await navigator.clipboard.writeText(text);
}
async function pasteFromClipboard() {
    return await navigator.clipboard.readText();
}
async function captureFullPage(tabId) {
    const tab = await chrome.tabs.get(tabId);
    const screenshots = [];
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.documentElement.scrollHeight
    });
    const pageHeight = result.result;
    const viewportHeight = tab.height;
    const scrolls = Math.ceil(pageHeight / viewportHeight);
    for (let i = 0; i < scrolls; i++) {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (offset) => window.scrollTo(0, offset),
            args: [i * viewportHeight]
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        const screenshot = await chrome.tabs.captureVisibleTab();
        screenshots.push(screenshot);
    }
    return { screenshots, success: true };
}
async function analyzePage(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const analysis = {
                url: window.location.href,
                title: document.title,
                wordCount: document.body.innerText.split(/\s+/).length,
                linkCount: document.querySelectorAll('a').length,
                imageCount: document.querySelectorAll('img').length,
                formCount: document.querySelectorAll('form').length,
                scriptCount: document.querySelectorAll('script').length,
                styleCount: document.querySelectorAll('link[rel="stylesheet"], style').length,
                headings: {
                    h1: document.querySelectorAll('h1').length,
                    h2: document.querySelectorAll('h2').length,
                    h3: document.querySelectorAll('h3').length
                },
                meta: {
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                    author: document.querySelector('meta[name="author"]')?.content || ''
                },
                performance: {
                    loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
                    domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
                }
            };
            return analysis;
        }
    });
    return result.result;
}
async function extractImages(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            return Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt,
                width: img.width,
                height: img.height,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight
            }));
        }
    });
    return result.result;
}
async function extractLinks(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.textContent.trim(),
                title: a.title,
                target: a.target
            }));
        }
    });
    return result.result;
}
async function extractTables(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            return Array.from(document.querySelectorAll('table')).map((table, index) => ({
                index,
                rows: table.rows.length,
                cols: table.rows[0]?.cells.length || 0,
                headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
                data: Array.from(table.querySelectorAll('tr')).map(tr => Array.from(tr.cells).map(cell => cell.textContent.trim()))
            }));
        }
    });
    return result.result;
}
async function extractForms(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            return Array.from(document.querySelectorAll('form')).map((form, index) => ({
                index,
                action: form.action,
                method: form.method,
                inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
                    type: input.type,
                    name: input.name,
                    id: input.id,
                    placeholder: input.placeholder,
                    required: input.required
                }))
            }));
        }
    });
    return result.result;
}
async function translateText(text, targetLang) {
    return {
        original: text,
        translated: `[Translated to ${targetLang}] ${text}`,
        targetLang
    };
}
async function summarizeText(text) {
    const raw = String(text || '').trim();
    let summary = '';
    if (raw) {
        const sentences = raw.match(/[^.!?]+[.!?]+/g);
        summary = sentences && sentences.length
            ? sentences.slice(0, 3).join(' ').trim()
            : raw.slice(0, 1200).trim();
    }
    if (!summary && raw.length > 1200)
        summary = raw.slice(0, 1200).trim();
    const compression = raw.length === 0 ? '0%' : ((summary.length / raw.length) * 100).toFixed(1) + '%';
    return {
        success: true,
        original: raw,
        summary: summary || '(No readable text on this page — it may use heavy scripts or blocked frames.)',
        compression
    };
}
async function analyzeSentiment(text) {
    const positive = ['good', 'great', 'excellent', 'happy', 'love', 'amazing'];
    const negative = ['bad', 'terrible', 'awful', 'hate', 'sad', 'horrible'];
    const words = text.toLowerCase().split(/\s+/);
    const posCount = words.filter(w => positive.includes(w)).length;
    const negCount = words.filter(w => negative.includes(w)).length;
    let sentiment = 'neutral';
    if (posCount > negCount)
        sentiment = 'positive';
    if (negCount > posCount)
        sentiment = 'negative';
    return {
        sentiment,
        score: (posCount - negCount) / words.length,
        positive: posCount,
        negative: negCount
    };
}
async function extractKeywords(text) {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const filtered = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const frequency = {};
    filtered.forEach(w => frequency[w] = (frequency[w] || 0) + 1);
    const keywords = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    return keywords;
}
async function getSystemInfo() {
    const info = {};
    try {
        info.cpu = await chrome.system.cpu.getInfo();
    }
    catch (e) { }
    try {
        info.memory = await chrome.system.memory.getInfo();
    }
    catch (e) { }
    try {
        info.storage = await chrome.system.storage.getInfo();
    }
    catch (e) { }
    try {
        info.display = await chrome.system.display.getInfo();
    }
    catch (e) { }
    return info;
}
async function exportBookmarks() {
    const tree = await chrome.bookmarks.getTree();
    return JSON.stringify(tree, null, 2);
}
async function exportSkills() {
    const data = await chrome.storage.local.get('skills');
    return JSON.stringify(data.skills || [], null, 2);
}
async function importSkills(skillsJson) {
    try {
        const skills = JSON.parse(skillsJson);
        await chrome.storage.local.set({ skills });
        skillTree = skills;
        return { success: true, count: skills.length };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
async function deleteSkill(skillId) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    const filtered = skills.filter(s => s.id !== skillId);
    await chrome.storage.local.set({ skills: filtered });
    skillTree = filtered;
    return { success: true };
}
async function handleContextMenu(info, tab) {
    switch (info.menuItemId) {
        case 'omni-analyze':
            await analyzePage(tab.id);
            break;
        case 'omni-summarize':
            await summarizeText(info.selectionText);
            break;
        case 'omni-translate':
            await translateText(info.selectionText, 'es');
            break;
        case 'omni-search':
            chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(info.selectionText)}` });
            break;
        case 'omni-save':
            await copyToClipboard(info.selectionText);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon128.png'),
                title: 'Saved to Clipboard',
                message: 'Selection saved!'
            });
            break;
        case 'omni-image':
            break;
        case 'omni-link':
            chrome.tabs.create({ url: info.linkUrl, active: false });
            break;
        case 'omni-video':
            chrome.downloads.download({ url: info.srcUrl });
            break;
        case 'omni-export-chatgpt': {
            if (!tab?.id)
                break;
            try {
                await ensureHoverArtJwtFromOpenTabs();
                const omCfg = await mergeOmniSettings();
                const result = await exportOpenAiChatToHoverArt(tab.id, omCfg, undefined);
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
                    title: 'HoverArt — chat exported',
                    message: `Project #${result.projectId}. Opening project page…`
                });
                if (result.hoverartProjectUrl) {
                    await chrome.tabs.create({ url: result.hoverartProjectUrl, active: true }).catch(() => { });
                }
            }
            catch (e) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
                    title: 'Chat export failed',
                    message: String(e?.message || e).slice(0, 280)
                });
            }
            break;
        }
    }
}
async function getPageContent(tabId) {
    if (tabId == null)
        throw new Error('No active tab');
    const [response] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
            title: document.title,
            url: window.location.href,
            text: document.body.innerText,
            html: document.body.innerHTML
        })
    });
    return response.result;
}
const OMNI_PLANNER_TOOLS = new Set([
    'noop',
    'summarize_page',
    'analyze_page_meta',
    'extract_page_text',
    'take_screenshot',
    'bookmark_current_tab',
    'duplicate_active_tab',
    'close_active_tab',
    'mute_active_tab',
    'navigate_browser',
    'google_search',
    'scroll_page_direction',
    'open_new_tab',
    'open_chrome_page',
    'open_deep_link',
    'download_text_document',
    'hoverart_export_openai_chat',
    'hoverart_save_project_artifact'
]);
function sanitizeOmniBackendBase(raw) {
    let base = typeof raw === 'string' ? raw.trim() : '';
    if (!base)
        base = 'http://127.0.0.1:3001';
    try {
        const u = new URL(base.replace(/\/+$/, '') || base);
        const path = (u.pathname || '/').replace(/\/$/, '');
        return path === '' || path === '/' ? u.origin : `${u.origin}${path}`;
    }
    catch {
        return 'http://127.0.0.1:3001';
    }
}
function isOpenAiChatHost(rawUrl) {
    try {
        const h = new URL(String(rawUrl || '').trim())
            .hostname.replace(/^www\./i, '')
            .toLowerCase();
        return h === 'chat.openai.com' || h === 'chatgpt.com';
    }
    catch {
        return false;
    }
}
async function mergeOmniSettings() {
    const data = await chrome.storage.local.get(['settings', 'omniHoverArtJwt']);
    const merged = { ...getDefaultSettings(), ...(data.settings || {}) };
    const topJwt = typeof data.omniHoverArtJwt === 'string' ? data.omniHoverArtJwt.trim() : '';
    const nestedJwt = typeof merged.hoverArtJwt === 'string' ? merged.hoverArtJwt.trim() : '';
    return {
        omniBackendUrl: merged.omniBackendUrl || getDefaultSettings().omniBackendUrl,
        omniUseLlm: merged.omniUseLlm !== false,
        hoverartSiteUrl: merged.hoverartSiteUrl || getDefaultSettings().hoverartSiteUrl,
        hoverArtJwt: topJwt || nestedJwt
    };
}
function sanitizeHoverArtSiteOrigin(raw) {
    const fallback = getDefaultSettings().hoverartSiteUrl || 'http://localhost:5173';
    try {
        const u = new URL(String(raw || fallback).trim());
        return u.origin;
    }
    catch {
        try {
            return new URL(fallback.trim()).origin;
        }
        catch {
            return 'http://localhost:5173';
        }
    }
}
async function syncHoverArtJwtFromTab(tabId, expectedOrigin) {
    try {
        if (tabId == null)
            return false;
        const tabUrl = (await chrome.tabs.get(tabId).catch(() => null))?.url || '';
        if (!/^https?:/i.test(tabUrl))
            return false;
        let tabOrigin;
        try {
            tabOrigin = new URL(tabUrl).origin;
        }
        catch {
            return false;
        }
        if (tabOrigin !== expectedOrigin)
            return false;
        let token = '';
        try {
            const [inj] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => localStorage.getItem('hoverart_token') || ''
            });
            token = String(inj?.result || '').trim();
        }
        catch {
            return false;
        }
        if (token.length < 40)
            return false;
        const stored = await chrome.storage.local.get('settings');
        const prev = stored.settings || {};
        await chrome.storage.local.set({
            omniHoverArtJwt: token,
            settings: { ...prev, hoverArtJwt: token }
        });
        return true;
    }
    catch (err) {
        console.warn('Omni HoverArt JWT sync:', err.message);
        return false;
    }
}
async function ensureHoverArtJwtFromOpenTabs() {
    let omni;
    try {
        omni = await mergeOmniSettings();
    }
    catch {
        omni = { hoverartSiteUrl: getDefaultSettings().hoverartSiteUrl, hoverArtJwt: '' };
    }
    if (String(omni.hoverArtJwt || '').trim().length > 40)
        return;
    let expectedOrigin;
    try {
        expectedOrigin = new URL(omni.hoverartSiteUrl || 'http://localhost:5173').origin;
    }
    catch {
        return;
    }
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
        if (t.id != null && t.url && (await syncHoverArtJwtFromTab(t.id, expectedOrigin)))
            return;
    }
}
function summarizeLikeIntent(trimmed) {
    const s = trimmed.toLowerCase();
    return s.includes('summarize') || s.includes('summary ') || /\btldr\b/i.test(trimmed);
}
async function gatherPageContextForPlanner(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        const tabUrl = tab.url || '';
        const hints = [];
        if (/\.pdf(\?|#|$)/i.test(tabUrl))
            hints.push('url_has_pdf_suffix');
        if (/^chrome-extension:\/\//i.test(tabUrl))
            hints.push('chrome_extension_document_tab');
        if (isOpenAiChatHost(tabUrl))
            hints.push('openai_chat_page');
        try {
            const pc = await getPageContent(tabId);
            const text = (pc.text || '').trim();
            return {
                url: pc.url || tabUrl,
                tabUrl,
                title: pc.title || tab.title || '',
                textExcerpt: text.slice(0, 8000),
                textLenApprox: text.length,
                scriptingBlocked: false,
                hints,
                viewerKind: /^chrome-extension:\/\//i.test(tabUrl) ? 'chrome_extension_viewer' : 'tab_dom'
            };
        }
        catch {
            hints.push('script_execution_failed_maybe_restricted_pdf');
            return {
                url: tabUrl,
                tabUrl,
                title: tab.title || '',
                textExcerpt: '',
                textLenApprox: 0,
                scriptingBlocked: true,
                hints,
                viewerKind: /\.pdf(\?|#|$)/i.test(tabUrl) || /^chrome-extension:\/\//i.test(tabUrl)
                    ? 'blocked_or_pdf_viewer'
                    : 'script_inject_failed'
            };
        }
    }
    catch {
        return {
            tabUrl: '',
            url: '',
            title: '',
            textExcerpt: '',
            textLenApprox: 0,
            scriptingBlocked: true,
            hints: ['tab_unreadable'],
            viewerKind: 'unknown'
        };
    }
}
function shouldDeferPdfOrLockedViewer(ctx) {
    if (!ctx)
        return false;
    const url = String(ctx.tabUrl || ctx.url || '');
    const restrictiveScheme = /^(chrome:|edge:|about:|devtools:|opera:|brave:|moz-extension:|chrome-extension:)/i.test(url);
    const lowBody = Number(ctx.textLenApprox || 0) < 120;
    const pdfSuffix = /\.pdf(\?|#|$)/i.test(url);
    if (ctx.scriptingBlocked && (pdfSuffix || restrictiveScheme || lowBody))
        return true;
    return (pdfSuffix && lowBody) || (/^chrome-extension:\/\//i.test(url) && lowBody);
}
function deferSummarizeHoverArtBlob(ctx, omni) {
    const origin = sanitizeHoverArtSiteOrigin(omni?.hoverartSiteUrl);
    const openUrl = `${origin}/omni?tab=summaries`;
    const summaryLines = [
        'This viewer usually hides real document text from extensions (classic case: Chrome’s built-in PDF). Omni can only scrape the viewer shell—which is why you saw “analyze page meta” instead of paragraphs.',
        '',
        `Open the PDF on a normal https:// tab when possible and say summarize again in Omni. Server-side summaries land on HoverArt → Omni → Summaries (extension only). Visit ${openUrl}`,
        ''
    ];
    if (ctx.tabUrl)
        summaryLines.push(`Tab URL\n${ctx.tabUrl}`);
    return {
        success: true,
        summary: summaryLines.join('\n').trim(),
        assistantNote: 'PDF viewers often block text — Omni will queue summaries when summarize works over https:// tabs.',
        suggestedUrl: openUrl,
        deferToHoverArtSummaries: true
    };
}
const MIN_TAB_TEXT_BEFORE_PDF_FETCH = 140;
function findHttpsPdfCandidates(raw) {
    if (!raw || typeof raw !== 'string')
        return [];
    let dec = raw;
    try {
        dec = decodeURIComponent(raw.replace(/\+/g, '%20'));
    }
    catch (_) {
        dec = raw;
    }
    const re = /https?:\/\/[^\s&#'"<>]+\.pdf(?:\?[^\s&#'"<>]*)?/gi;
    const found = [...dec.matchAll(re)].map((m) => m[0]);
    return [...new Set(found)];
}
function canonicalHttpsPdfUrlFromTabUrl(tabUrl) {
    if (!tabUrl || typeof tabUrl !== 'string')
        return null;
    try {
        const u = new URL(tabUrl);
        if ((u.protocol === 'http:' || u.protocol === 'https:') && /\.pdf(\?|$)/i.test(u.pathname)) {
            return u.href;
        }
        const qpTokens = [];
        ['url', 'file', 'src', 'destination'].forEach((k) => {
            const v = u.searchParams.get(k);
            if (v)
                qpTokens.push(v);
        });
        const fromParams = qpTokens.flatMap(findHttpsPdfCandidates);
        if (fromParams.length)
            return fromParams[fromParams.length - 1];
    }
    catch (_) {
    }
    const blobs = findHttpsPdfCandidates(tabUrl);
    return blobs.length ? blobs[blobs.length - 1] : null;
}
async function fetchPdfTextThroughBackend(canonicalPdfUrl, backendRaw) {
    const baseRoot = sanitizeOmniBackendBase(backendRaw);
    const endpoint = `${baseRoot}/api/omni/pdf-text`;
    try {
        const docRes = await fetch(canonicalPdfUrl, {
            credentials: 'omit',
            redirect: 'follow',
            headers: {
                Accept: 'application/pdf,*/*;q=0.8'
            }
        });
        if (!docRes.ok)
            return '';
        const buf = await docRes.arrayBuffer();
        const pass = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf' },
            body: buf,
            credentials: 'omit'
        });
        const body = await pass.json().catch(() => ({}));
        if (!pass.ok || body.success !== true || typeof body.text !== 'string')
            return '';
        return body.text.trim();
    }
    catch (e) {
        console.warn('Omni pdf fetch:', e.message);
        return '';
    }
}
async function getBestVisibleOrPdfPlainText(tabId, backendRaw) {
    let domTrim = '';
    let tabLink = '';
    try {
        const pc = await getPageContent(tabId);
        domTrim = (pc.text || '').trim();
    }
    catch (_) {
        domTrim = '';
    }
    try {
        const t = await chrome.tabs.get(tabId);
        tabLink = (t.url || '').trim();
    }
    catch (_) {
        tabLink = '';
    }
    const canon = canonicalHttpsPdfUrlFromTabUrl(tabLink);
    if (canon &&
        (domTrim.length < MIN_TAB_TEXT_BEFORE_PDF_FETCH || /\.pdf(\?|#|$)/i.test(tabLink))) {
        const remote = await fetchPdfTextThroughBackend(canon, backendRaw);
        if (remote.length >= 40 && remote.length > domTrim.length)
            return remote;
        if (!domTrim.trim() && remote.length >= 40)
            return remote;
    }
    return domTrim;
}
async function summarizeViaDomPlusPdf(tabId, backendRaw) {
    const merged = await getBestVisibleOrPdfPlainText(tabId, backendRaw);
    const n = merged.trim().length;
    const s = await summarizeText(merged);
    return {
        ...s,
        success: true,
        extractedCharCount: n,
        message: n >= 40 ? 'Combined visible tab text + (when relevant) fetched PDF binary from the HTTPS URL.' : s.message
    };
}
function plannerPublicContext(ctx) {
    if (!ctx)
        return {};
    return {
        url: ctx.url,
        title: ctx.title,
        textExcerpt: ctx.textExcerpt || '',
        scriptingBlocked: !!ctx.scriptingBlocked,
        textLenApprox: ctx.textLenApprox,
        hints: Array.isArray(ctx.hints) ? ctx.hints : [],
        viewerKind: ctx.viewerKind
    };
}
function collapseDuplicatePlannerSteps(steps) {
    const filtered = [];
    let prevSig = '';
    for (const step of steps) {
        const rawTool = typeof step.tool === 'string' ? step.tool.trim() : '';
        const sig = `${rawTool}|${JSON.stringify(step.args || {})}`;
        if (sig && sig === prevSig)
            continue;
        prevSig = sig;
        filtered.push({ ...step, tool: rawTool || step.tool });
    }
    return filtered;
}
async function requestPlannerFromBackend(command, pagePayload, baseUrl) {
    const base = sanitizeOmniBackendBase(baseUrl);
    const endpoint = `${base}/api/omni/plan`;
    const pageContext = pagePayload && typeof pagePayload === 'object' ? plannerPublicContext(pagePayload) : {};
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command,
            pageContext: Object.keys(pageContext).length ? pageContext : undefined
        })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success !== true || !body.plan) {
        const err = body.error || res.statusText || 'Planner unreachable';
        throw new Error(typeof err === 'string' ? err : 'Planner error');
    }
    return body.plan;
}
function normalizeNavigateUrl(raw) {
    let u = String(raw ?? '').trim();
    if (!u)
        return null;
    if (!/^https?:\/\//i.test(u))
        u = 'https://' + u;
    try {
        const parsed = new URL(u);
        if (!parsed.hostname)
            return null;
        return parsed.href;
    }
    catch {
        return null;
    }
}
const CHROME_PAGE_URLS = {
    downloads: 'chrome://downloads',
    extensions: 'chrome://extensions',
    settings: 'chrome://settings',
    bookmarks: 'chrome://bookmarks'
};
const DEEP_LINK_PROTOCOLS = new Set([
    'mailto',
    'tel',
    'vscode',
    'vscode-insiders',
    'cursor',
    'slack',
    'discord',
    'spotify',
    'zoommtg'
]);
function sanitizeDownloadBasename(name, fallback) {
    let b = String(name || '')
        .replace(/[/\\\\]/g, '')
        .trim()
        .slice(0, 140);
    if (!b || /\.\./.test(b))
        b = fallback;
    b = b.replace(/[^\w.\-\s\u00c0-\u024f()+]/gi, '_').replace(/^_+|_+$/g, '');
    return b || fallback;
}
function normalizeHttpTabUrl(raw) {
    let u = String(raw ?? '').trim();
    if (!u)
        return null;
    if (!/^https?:\/\//i.test(u))
        u = 'https://' + u;
    try {
        const p = new URL(u);
        if (p.protocol !== 'http:' && p.protocol !== 'https:')
            return null;
        if (!p.hostname)
            return null;
        return p.href.slice(0, 4096);
    }
    catch {
        return null;
    }
}
function normalizeDeepApplicationUrl(raw) {
    const s = String(raw || '').trim();
    if (!s)
        return null;
    if (/^javascript:/i.test(s) || /^data:/i.test(s) || /^file:/i.test(s) || /^vbscript:/i.test(s))
        return null;
    try {
        const p = new URL(s);
        const prot = (p.protocol || '').replace(/:$/, '').toLowerCase();
        if (!DEEP_LINK_PROTOCOLS.has(prot))
            return null;
        return p.href.slice(0, 8192);
    }
    catch {
        return null;
    }
}
async function hoverArtApiJson(backendBase, jwtToken, path, opts = {}) {
    const base = sanitizeOmniBackendBase(backendBase);
    const tok = typeof jwtToken === 'string' ? jwtToken.trim() : '';
    if (!tok) {
        throw new Error('HoverArt token missing — keep a HoverArt tab open while logged in (same URL as Omni Settings → HoverArt site URL), reopen the Omni popup, and retry—or paste JWT in Omni options.');
    }
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${p}`;
    const res = await fetch(url, {
        method: opts.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
            ...(opts.headers || {})
        },
        body: opts.body != null ? opts.body : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : res.statusText;
        throw new Error(msg || `${res.status}`);
    }
    return data;
}
async function enqueueExtensionSummaryJob(tabId, omniMerged, fullPlainText, titleGuess) {
    const body = String(fullPlainText || '').trim();
    if (body.length < 40 || tabId == null)
        return;
    await ensureHoverArtJwtFromOpenTabs();
    let omni;
    try {
        omni = await mergeOmniSettings();
    }
    catch (_) {
        return;
    }
    if (!String(omni.hoverArtJwt || '').trim())
        return;
    let tab;
    try {
        tab = await chrome.tabs.get(tabId);
    }
    catch (_) {
        tab = null;
    }
    const titleFromTab = typeof tab?.title === 'string' ? tab.title.trim().slice(0, 480) : '';
    const title = (typeof titleGuess === 'string' && titleGuess.trim().length > 0
        ? titleGuess.trim()
        : titleFromTab || 'Omni page summary').slice(0, 480);
    const sourceUrl = typeof tab?.url === 'string' ? tab.url.trim().slice(0, 4060) : null;
    try {
        await hoverArtApiJson(omni.omniBackendUrl, omni.hoverArtJwt, '/api/omni/summaries', {
            method: 'POST',
            body: JSON.stringify({
                sourceChannel: 'extension',
                title,
                sourceUrl,
                bodyText: body.slice(0, 140000)
            })
        });
    }
    catch (e) {
        console.warn('Enqueue HoverArt summary failed:', e.message);
    }
}
async function extractOpenAiChatTranscript(tabId) {
    const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const nodes = document.querySelectorAll('[data-message-author-role]');
            const parts = [];
            nodes.forEach((el) => {
                const role = el.getAttribute('data-message-author-role');
                if (!role)
                    return;
                const inner = el.querySelector('[data-message-content="true"]') ||
                    el.querySelector('.markdown') ||
                    el;
                const text = (inner.innerText || '').trim().replace(/\n{4,}/g, '\n\n\n');
                if (text.length)
                    parts.push(`### ${role}\n${text}`);
            });
            return {
                transcript: parts.join('\n\n'),
                segmentCount: parts.length,
                pageUrl: window.location.href || ''
            };
        }
    });
    return (res?.result || {
        transcript: '',
        segmentCount: 0,
        pageUrl: ''
    });
}
async function exportOpenAiChatToHoverArt(tabId, omniMerged, rawProjectTitle) {
    let tabLink = '';
    try {
        tabLink = (await chrome.tabs.get(tabId)).url || '';
    }
    catch (_) {
        tabLink = '';
    }
    if (!isOpenAiChatHost(tabLink)) {
        throw new Error('Open this chat thread on chat.openai.com or chatgpt.com.');
    }
    const { transcript, segmentCount, pageUrl } = await extractOpenAiChatTranscript(tabId);
    if (!transcript.trim() || segmentCount < 1) {
        throw new Error('No assistant/user messages scraped — scroll the conversation so bubbles load, then retry.');
    }
    const projectTitleOpt = typeof rawProjectTitle === 'string' && rawProjectTitle.trim().length > 0
        ? rawProjectTitle.trim().slice(0, 500)
        : undefined;
    const payload = await hoverArtApiJson(omniMerged.omniBackendUrl, omniMerged.hoverArtJwt, '/api/omni/projects/from-openai-chat', {
        method: 'POST',
        body: JSON.stringify({
            projectTitle: projectTitleOpt,
            sourceUrl: pageUrl.slice(0, 4096),
            transcript
        })
    });
    const origin = sanitizeHoverArtSiteOrigin(omniMerged.hoverartSiteUrl);
    const openUrl = `${origin}/omni?tab=projects&project=${payload.projectId}`;
    let lbl = `Chat export saved as HoverArt project #${payload.projectId}.`;
    lbl += ` Open site: ${openUrl}`;
    if (payload.summaryError) {
        lbl += ` Digest failed—transcript intact (${String(payload.summaryError).slice(0, 120)}…)`;
    }
    return {
        ok: true,
        label: lbl,
        hoverartProjectUrl: openUrl,
        projectId: payload.projectId,
        transcriptChars: transcript.length
    };
}
async function executePlannerTool(tool, args, tabId) {
    if (tabId == null)
        throw new Error('No active tab');
    switch (tool) {
        case 'noop':
            return { ok: true, label: args?.reason || 'No action.' };
        case 'summarize_page': {
            let omniMerged;
            try {
                omniMerged = await mergeOmniSettings();
            }
            catch (_) {
                omniMerged = getDefaultSettings();
            }
            const merged = await getBestVisibleOrPdfPlainText(tabId, omniMerged.omniBackendUrl);
            const s = await summarizeText(merged);
            void enqueueExtensionSummaryJob(tabId, omniMerged, merged, '');
            return {
                ok: true,
                label: 'Summarized page.',
                summary: s.summary,
                compression: s.compression
            };
        }
        case 'analyze_page_meta': {
            const meta = await analyzePage(tabId);
            return {
                ok: true,
                label: 'Page analysis complete.',
                analysis: meta
            };
        }
        case 'extract_page_text': {
            let omCfg;
            try {
                omCfg = await mergeOmniSettings();
            }
            catch (_) {
                omCfg = getDefaultSettings();
            }
            const merged = await getBestVisibleOrPdfPlainText(tabId, omCfg.omniBackendUrl);
            const excerpt = merged.slice(0, 2400);
            return {
                ok: true,
                label: 'Extracted readable text.',
                content: excerpt
            };
        }
        case 'take_screenshot': {
            const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 26);
            const filename = `Omni/screenshot-${stamp}.png`;
            try {
                await chrome.downloads.download({
                    url: dataUrl,
                    filename,
                    saveAs: false,
                    conflictAction: 'uniquify'
                });
            }
            catch (dlErr) {
                console.warn('Omni screenshot download:', dlErr);
                return {
                    ok: true,
                    label: 'Screenshot captured but could not auto-save — check Omni downloads permission in chrome://extensions.',
                    screenshotDataUrlSnippet: typeof dataUrl === 'string' ? dataUrl.slice(0, 80) + '…' : ''
                };
            }
            return {
                ok: true,
                label: `Saved screenshot PNG to your Downloads folder inside “Omni/” (${filename}). Open Finder/file explorer → Downloads.`,
                screenshotSavedAs: filename
            };
        }
        case 'bookmark_current_tab': {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.url || /^(chrome|chrome-extension|edge|about|devtools):/i.test(tab.url)) {
                throw new Error('Cannot bookmark this tab.');
            }
            await chrome.bookmarks.create({ title: tab.title || 'Bookmark', url: tab.url });
            return { ok: true, label: 'Bookmark saved.' };
        }
        case 'duplicate_active_tab': {
            await chrome.tabs.duplicate(tabId);
            return { ok: true, label: 'Tab duplicated.' };
        }
        case 'close_active_tab': {
            await chrome.tabs.remove(tabId);
            return { ok: true, label: 'Tab closed.', closed: true };
        }
        case 'mute_active_tab': {
            const mute = args.mute !== false;
            await chrome.tabs.update(tabId, { muted: mute });
            return { ok: true, label: mute ? 'Tab muted.' : 'Tab unmuted.' };
        }
        case 'navigate_browser': {
            const href = normalizeNavigateUrl(args.url);
            if (!href)
                throw new Error('Invalid URL.');
            await chrome.tabs.update(tabId, { url: href });
            return { ok: true, label: 'Navigated: ' + href };
        }
        case 'google_search': {
            const q = String(args.query || '').trim();
            if (!q)
                throw new Error('Missing search query.');
            const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
            await chrome.tabs.update(tabId, { url });
            return { ok: true, label: 'Google search: ' + q };
        }
        case 'scroll_page_direction': {
            const direction = ['up', 'down', 'top', 'bottom'].includes(args.direction)
                ? args.direction
                : 'down';
            await chrome.scripting.executeScript({
                target: { tabId },
                func: (dir) => {
                    const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
                    if (dir === 'top')
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    else if (dir === 'bottom')
                        window.scrollTo({ top: h, behavior: 'smooth' });
                    else if (dir === 'down')
                        window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
                    else
                        window.scrollBy({ top: -(window.innerHeight * 0.85), behavior: 'smooth' });
                },
                args: [direction]
            });
            return { ok: true, label: `Scrolled (${direction}).` };
        }
        case 'open_new_tab': {
            const rawOpt = typeof args.url === 'string' ? args.url.trim() : '';
            const href = rawOpt ? normalizeHttpTabUrl(rawOpt) : null;
            await chrome.tabs.create({ url: href || 'about:blank', active: true });
            return {
                ok: true,
                label: href ? `Opened new tab: ${href}` : 'Opened a new blank browser tab.'
            };
        }
        case 'open_chrome_page': {
            const key = String(args.which || '').toLowerCase().trim();
            const target = CHROME_PAGE_URLS[key];
            if (!target)
                throw new Error('Unsupported chrome page — use downloads, extensions, settings, or bookmarks.');
            await chrome.tabs.create({ url: target, active: true });
            return { ok: true, label: `Opened ${key}: ${target}.` };
        }
        case 'open_deep_link': {
            const dl = normalizeDeepApplicationUrl(args.url);
            if (!dl)
                throw new Error('Unsupported deep-link (allowed: mailto:, tel:, vscode:, vscode-insiders:, cursor:, slack:, discord:, spotify:, zoommtg:).');
            await chrome.tabs.create({ url: dl, active: true });
            return { ok: true, label: `Desktop hand-off: ${dl.slice(0, 100)}…` };
        }
        case 'hoverart_export_openai_chat': {
            let omCfg;
            try {
                omCfg = await mergeOmniSettings();
            }
            catch (_) {
                omCfg = getDefaultSettings();
            }
            const titleOpt = args.projectTitle ?? args.title;
            return await exportOpenAiChatToHoverArt(tabId, omCfg, titleOpt);
        }
        case 'hoverart_save_project_artifact': {
            let omCfg;
            try {
                omCfg = await mergeOmniSettings();
            }
            catch (_) {
                omCfg = getDefaultSettings();
            }
            let pid = typeof args.projectId === 'number' ? args.projectId : Number(args.projectId);
            if (!Number.isFinite(pid) || pid < 1) {
                const pt = String(args.projectTitle || '').trim();
                if (!pt)
                    throw new Error('Provide projectTitle or projectId.');
                const ensured = await hoverArtApiJson(omCfg.omniBackendUrl, omCfg.hoverArtJwt, '/api/omni/projects/ensure', { method: 'POST', body: JSON.stringify({ title: pt.slice(0, 500) }) });
                pid = ensured.projectId;
            }
            const kindRaw = String(args.kind || '').toLowerCase().trim();
            const allowed = ['diagram', 'analysis', 'document', 'note'];
            if (!allowed.includes(kindRaw))
                throw new Error(`Unsupported artifact kind "${args.kind}".`);
            let body = typeof args.content === 'string'
                ? args.content
                : typeof args.body === 'string'
                    ? args.body
                    : '';
            if (!body.trim())
                throw new Error('HoverArt artifact missing content.');
            if (body.length > 850000)
                body = `${body.slice(0, 850000)}\n…truncated…`;
            const artTitle = String(args.artifactTitle || args.noteTitle || '').trim().slice(0, 500);
            await hoverArtApiJson(omCfg.omniBackendUrl, omCfg.hoverArtJwt, `/api/omni/projects/${pid}/artifacts`, {
                method: 'POST',
                body: JSON.stringify({
                    kind: kindRaw,
                    title: artTitle || null,
                    bodyText: body,
                    sourceUrl: typeof args.sourceUrl === 'string' ? args.sourceUrl.trim().slice(0, 4096) : null
                })
            });
            const origin = sanitizeHoverArtSiteOrigin(omCfg.hoverartSiteUrl);
            const openUrl = `${origin}/omni?tab=projects&project=${pid}`;
            return {
                ok: true,
                label: `Saved HoverArt artifact (${kindRaw}) → project #${pid}. ${openUrl}`,
                hoverartProjectUrl: openUrl,
                projectId: pid
            };
        }
        case 'download_text_document': {
            const fmt = String(args.format || 'txt').toLowerCase() === 'md' ? 'md' : 'txt';
            const fallbackName = fmt === 'md' ? `Omni-note-${Date.now()}.md` : `Omni-note-${Date.now()}.txt`;
            const filename = sanitizeDownloadBasename(args.filename, fallbackName);
            const mime = fmt === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
            let rawContent = typeof args.content === 'string' ? args.content : String(args.body || '');
            if (rawContent.length > 400000)
                rawContent = rawContent.slice(0, 400000) + '\n…truncated…';
            const dataUrl = `data:${mime},${encodeURIComponent(rawContent)}`;
            const path = filename.includes('/') ? filename : `Omni/${filename}`;
            await chrome.downloads.download({
                url: dataUrl,
                filename: path,
                conflictAction: 'uniquify',
                saveAs: false
            });
            return {
                ok: true,
                label: `Saved document to Downloads → Omni/ (${filename}).`,
                downloadedAs: path
            };
        }
        default:
            throw new Error('Unknown planner tool.');
    }
}
async function executePlannerSteps(steps, tabId) {
    const runnable = collapseDuplicatePlannerSteps(Array.isArray(steps) ? steps : []);
    if (!runnable.length) {
        return {
            success: false,
            message: 'Planner returned no steps.',
            summary: null,
            lines: [],
            stopped: false
        };
    }
    const lines = [];
    let stopped = false;
    let aggregateSummary = '';
    let anyFailure = false;
    let lastDownloaded = '';
    let lastScreenshotPath = '';
    let lastHoverartUrl = '';
    for (const step of runnable) {
        const tool = typeof step.tool === 'string' ? step.tool.trim() : '';
        if (!OMNI_PLANNER_TOOLS.has(tool)) {
            lines.push(`Skipped unknown tool "${tool}".`);
            continue;
        }
        try {
            const outcome = await executePlannerTool(tool, step.args || {}, tabId);
            const line = outcome.label ||
                (outcome.summary
                    ? `Summary: ${outcome.summary}`
                    : outcome.content
                        ? `${outcome.content.slice(0, 200)}...`
                        : JSON.stringify(outcome).slice(0, 240));
            lines.push(line);
            if (outcome.summary)
                aggregateSummary = outcome.summary;
            if (outcome.content && !aggregateSummary)
                aggregateSummary = outcome.content.slice(0, 500);
            if (outcome.downloadedAs)
                lastDownloaded = outcome.downloadedAs;
            if (outcome.screenshotSavedAs)
                lastScreenshotPath = outcome.screenshotSavedAs;
            if (typeof outcome.hoverartProjectUrl === 'string' && outcome.hoverartProjectUrl.trim()) {
                lastHoverartUrl = outcome.hoverartProjectUrl.trim();
            }
            if (outcome.closed) {
                stopped = true;
                break;
            }
        }
        catch (err) {
            anyFailure = true;
            lines.push(`Failed ${tool}: ${err.message || err}`);
        }
    }
    return {
        success: !anyFailure && lines.some((ln) => !ln.startsWith('Skipped')),
        message: lines.join('\n'),
        summary: aggregateSummary || null,
        lines,
        stopped,
        downloadedAs: lastDownloaded || undefined,
        screenshotSavedAs: lastScreenshotPath || undefined,
        hoverartProjectUrl: lastHoverartUrl || undefined
    };
}
async function handleTask(task, data, tabId) {
    const trimmed = typeof task === 'string' ? task.trim() : '';
    console.log('Handling task:', trimmed, 'tabId=', tabId);
    if (!trimmed) {
        return { success: false, message: 'Empty command.' };
    }
    let omniPre;
    try {
        omniPre = await mergeOmniSettings();
    }
    catch (_) {
        const d = getDefaultSettings();
        omniPre = {
            omniBackendUrl: d.omniBackendUrl,
            omniUseLlm: d.omniUseLlm !== false,
            hoverartSiteUrl: d.hoverartSiteUrl,
            hoverArtJwt: ''
        };
    }
    if (!String(omniPre.hoverArtJwt || '').trim()) {
        await ensureHoverArtJwtFromOpenTabs();
        try {
            omniPre = await mergeOmniSettings();
        }
        catch (_) {
        }
    }
    let tabBriefPre = null;
    if (tabId != null) {
        tabBriefPre = await gatherPageContextForPlanner(tabId);
    }
    if (summarizeLikeIntent(trimmed) && tabId != null) {
        const blended = await summarizeViaDomPlusPdf(tabId, omniPre.omniBackendUrl);
        const n = blended.extractedCharCount || 0;
        const sumLine = typeof blended.summary === 'string' ? blended.summary.trim() : '';
        if (n >= 40 && sumLine && !/^no readable text/i.test(sumLine)) {
            delete blended.extractedCharCount;
            void enqueueExtensionSummaryJob(tabId, omniPre, blended.original || '', '');
            return blended;
        }
    }
    if (summarizeLikeIntent(trimmed) && tabBriefPre && shouldDeferPdfOrLockedViewer(tabBriefPre)) {
        return deferSummarizeHoverArtBlob(tabBriefPre, omniPre);
    }
    const matchingSkill = await findMatchingSkill(trimmed);
    if (matchingSkill) {
        return await executeWithSkill(matchingSkill, data, tabId);
    }
    const omni = omniPre;
    const tabBrief = tabBriefPre;
    if (omni.omniUseLlm !== false && tabId != null) {
        try {
            const plan = await requestPlannerFromBackend(trimmed, tabBrief, omni.omniBackendUrl);
            const stepsRaw = Array.isArray(plan.steps) ? plan.steps : [];
            const runOutcome = await executePlannerSteps(stepsRaw, tabId);
            const learnedMarks = collapseDuplicatePlannerSteps(stepsRaw)
                .slice(0, 12)
                .map((s) => `${(s.tool || '').trim()}::${JSON.stringify(s.args || {})}`);
            const trivialNoopPlan = stepsRaw.every((s) => (s.tool || '').trim() === 'noop');
            if (runOutcome.success && stepsRaw.length && !trivialNoopPlan) {
                await learnSkill(trimmed, learnedMarks);
            }
            return {
                ...runOutcome,
                success: runOutcome.success !== false,
                assistantNote: plan.assistantNote || '',
                llmPlanner: true
            };
        }
        catch (err) {
            console.warn('Omni planner fallback:', err.message);
        }
    }
    const taskLower = trimmed.toLowerCase();
    let result;
    if (tabId == null) {
        return { success: false, message: 'No active tab — open a web page and try again.' };
    }
    try {
        if (taskLower.includes('summarize')) {
            if (tabBrief && shouldDeferPdfOrLockedViewer(tabBrief)) {
                result = deferSummarizeHoverArtBlob(tabBrief, omni);
            }
            else {
                try {
                    const blended = await summarizeViaDomPlusPdf(tabId, omni.omniBackendUrl);
                    void enqueueExtensionSummaryJob(tabId, omni, blended.original || '', '');
                    delete blended.extractedCharCount;
                    result = blended;
                }
                catch (_summErr) {
                    result = deferSummarizeHoverArtBlob(await gatherPageContextForPlanner(tabId), omni);
                }
            }
        }
        else if (taskLower.includes('read the content') ||
            taskLower.includes('extract text') ||
            /\bextract\b.*\btext\b/i.test(trimmed)) {
            const merged = await getBestVisibleOrPdfPlainText(tabId, omni.omniBackendUrl);
            const excerpt = merged.slice(0, 5000);
            try {
                const tab = await chrome.tabs.get(tabId);
                result = {
                    success: true,
                    summary: excerpt,
                    message: `Read ${excerpt.length} chars (DOM + PDF fetch when HTTPS .pdf applies). Tab: ${tab.title || ''}.`.trim()
                };
            }
            catch (_t0) {
                result = {
                    success: true,
                    summary: excerpt,
                    message: `Read ${excerpt.length} characters (DOM + optional PDF fetch).`
                };
            }
        }
        else if (taskLower.includes('translate')) {
            result = await translateText(data.text || '', 'es');
        }
        else if (taskLower.includes('bookmark')) {
            result = await chrome.bookmarks.create({
                title: data.title,
                url: data.url
            });
        }
        else if (taskLower.includes('download')) {
            result = await chrome.downloads.download({ url: data.url });
        }
        else if (taskLower.includes('screenshot') || taskLower.includes('screen shot')) {
            const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 26);
            const filename = `Omni/screenshot-${stamp}.png`;
            try {
                await chrome.downloads.download({
                    url: dataUrl,
                    filename,
                    saveAs: false,
                    conflictAction: 'uniquify'
                });
                result = {
                    success: true,
                    message: `Screenshot saved — check your Downloads/Omni folder (${filename}).`
                };
            }
            catch (_dl) {
                result = {
                    success: true,
                    message: 'Screenshot captured — download failed (enable Downloads permission). Try again after reloading Omni in chrome://extensions.'
                };
            }
        }
        else if (taskLower.includes('analyze')) {
            const meta = await analyzePage(tabId);
            result = {
                success: true,
                analysis: meta,
                summary: `Analyzed “${meta.title}”\nURL: ${meta.url}\nWords: ${meta.wordCount}  Links: ${meta.linkCount}  Images: ${meta.imageCount}  Forms: ${meta.formCount}`
            };
        }
        else {
            result = { success: true, message: 'Task processed (no specific handler matched).' };
        }
    }
    catch (fallbackErr) {
        result = { success: false, message: fallbackErr.message || String(fallbackErr) };
    }
    return result;
}
const GENERIC_SKILL_KEYWORDS = new Set([
    'this',
    'that',
    'these',
    'those',
    'there',
    'here',
    'about',
    'please',
    'something',
    'anything',
    'everything',
    'summarize',
    'summary',
    'content',
    'page',
    'pages',
    'button',
    'click',
    'open',
    'close',
    'want',
    'need',
    'tell',
    'make',
    'give',
    'take',
    'have',
    'were',
    'been',
    'into',
    'your',
    'what',
    'when',
    'some',
    'many',
    'really',
    'actually',
    'doing',
    'thing',
    'things',
    'task',
    'tasks',
    'just',
    'like',
    'from',
    'with',
    'also',
    'then',
    'than',
    'them',
    'they'
]);
function normaliseTaskText(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
function buildSkillKeywords(task) {
    return normaliseTaskText(task)
        .split(/\s+/)
        .filter((w) => w.length >= 6 && !GENERIC_SKILL_KEYWORDS.has(w))
        .slice(0, 14);
}
function skillHasReplayablePlannerActions(skill) {
    const acts = skill?.executionPlan?.actions;
    return Array.isArray(acts) && acts.some((a) => typeof a === 'string' && a.includes('::'));
}
function parsePlannerActionString(line) {
    const raw = String(line || '');
    const idx = raw.indexOf('::');
    if (idx <= 0)
        return null;
    const tool = raw.slice(0, idx).trim();
    let args = {};
    try {
        args = JSON.parse(raw.slice(idx + 2) || '{}');
    }
    catch {
        args = {};
    }
    if (!tool)
        return null;
    return { tool, args };
}
async function findMatchingSkill(task) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    const nTask = normaliseTaskText(task);
    for (let i = skills.length - 1; i >= 0; i--) {
        const skill = skills[i];
        const plan = skill.executionPlan;
        if (!plan || !skillHasReplayablePlannerActions(skill))
            continue;
        const orig = normaliseTaskText(plan.originalTask || '');
        if (orig.length > 0 && orig === nTask)
            return skill;
        const kws = Array.isArray(plan.keywords)
            ? plan.keywords.filter((kw) => typeof kw === 'string' &&
                kw.length >= 6 &&
                !GENERIC_SKILL_KEYWORDS.has(kw.toLowerCase()))
            : [];
        if (kws.some((kw) => nTask.includes(kw.toLowerCase())))
            return skill;
    }
    return null;
}
async function executeWithSkill(skill, data, tabId) {
    const steps = [];
    for (const act of skill.executionPlan?.actions || []) {
        const parsed = parsePlannerActionString(act);
        if (!parsed || !OMNI_PLANNER_TOOLS.has(parsed.tool))
            continue;
        steps.push({ tool: parsed.tool, args: parsed.args });
    }
    if (!steps.length) {
        return {
            success: false,
            message: 'This saved skill cannot be replayed. Clear old skills from the Skill tree page or retry without reuse.'
        };
    }
    const run = await executePlannerSteps(steps, tabId);
    return {
        ...run,
        success: run.success !== false,
        usedSkill: skill.name,
        replay: true
    };
}
async function learnSkill(task, actions) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    const newSkill = {
        id: `skill-${Date.now()}`,
        name: task.split(' ').slice(0, 3).join(' '),
        description: `Learned from: "${task}"`,
        executionPlan: {
            originalTask: task,
            actions,
            keywords: buildSkillKeywords(task)
        }
    };
    skills.push(newSkill);
    await chrome.storage.local.set({ skills });
}
async function saveSkill(skill) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    skills.push(skill);
    await chrome.storage.local.set({ skills });
}
function getInitialSkills() {
    return [
        { id: 'root', name: 'Omni Core', level: 0, unlocked: true, color: '#00f5ff' },
        { id: 'web', name: 'Web Control', level: 1, parent: 'root', unlocked: true, color: '#a78bfa' },
        { id: 'document', name: 'Documents', level: 1, parent: 'root', unlocked: true, color: '#34d399' },
        { id: 'automation', name: 'Automation', level: 1, parent: 'root', unlocked: true, color: '#fbbf24' }
    ];
}
function getDefaultSettings() {
    return {
        voiceRate: 1.1,
        voicePitch: 1.0,
        autoSpeak: true,
        showNotifications: true,
        omniBackendUrl: 'http://127.0.0.1:3001',
        hoverartSiteUrl: 'http://localhost:5173',
        omniUseLlm: true,
        hoverArtJwt: ''
    };
}
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
        console.log('Running cleanup...');
    }
});
console.log('Omni Enhanced: All APIs loaded and ready!');
