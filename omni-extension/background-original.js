console.log('Omni background service worker loaded');
let skillTree = [];
let settings = {};
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Omni extension installed/updated');
    const data = await chrome.storage.local.get(['skills', 'settings']);
    skillTree = data.skills || getInitialSkills();
    settings = data.settings || getDefaultSettings();
    await chrome.storage.local.set({ skills: skillTree, settings });
    chrome.contextMenus.create({
        id: 'omni-analyze',
        title: 'Omni: Analyze this page',
        contexts: ['page']
    });
    chrome.contextMenus.create({
        id: 'omni-summarize',
        title: 'Omni: Summarize selection',
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: 'omni-execute',
        title: 'Omni: Execute task...',
        contexts: ['page']
    });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case 'omni-analyze':
            executeTask(tab.id, 'analyze_page', {});
            break;
        case 'omni-summarize':
            executeTask(tab.id, 'summarize_text', { text: info.selectionText });
            break;
        case 'omni-execute':
            chrome.action.openPopup();
            break;
    }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    (async () => {
        try {
            switch (message.type) {
                case 'EXECUTE_TASK':
                    const result = await handleTask(message.task, message.data, sender.tab?.id);
                    sendResponse({ success: true, result });
                    break;
                case 'GET_PAGE_CONTENT':
                    const content = await getPageContent(message.tabId || sender.tab?.id);
                    sendResponse({ success: true, content });
                    break;
                case 'GET_SKILLS':
                    const skills = await chrome.storage.local.get('skills');
                    sendResponse({ success: true, skills: skills.skills || skillTree });
                    break;
                case 'SAVE_SKILL':
                    await saveSkill(message.skill);
                    sendResponse({ success: true });
                    break;
                case 'UPDATE_SETTINGS':
                    await chrome.storage.local.set({ settings: message.settings });
                    sendResponse({ success: true });
                    break;
                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true;
});
async function handleTask(task, data, tabId) {
    console.log('Handling task:', task, data);
    const taskLower = task.toLowerCase();
    const matchingSkill = await findMatchingSkill(task);
    if (matchingSkill) {
        console.log('Found matching skill:', matchingSkill.name);
        return await executeWithSkill(matchingSkill, data, tabId);
    }
    let result;
    if (taskLower.includes('summarize') || taskLower.includes('summary')) {
        result = await summarizeContent(data, tabId);
    }
    else if (taskLower.includes('read') || taskLower.includes('extract')) {
        result = await readContent(data, tabId);
    }
    else if (taskLower.includes('click') || taskLower.includes('button')) {
        result = await clickElement(data, tabId);
    }
    else if (taskLower.includes('fill') || taskLower.includes('type')) {
        result = await fillForm(data, tabId);
    }
    else if (taskLower.includes('scroll')) {
        result = await scrollPage(data, tabId);
    }
    else if (taskLower.includes('navigate') || taskLower.includes('go to')) {
        result = await navigateToUrl(data, tabId);
    }
    else if (taskLower.includes('screenshot')) {
        result = await takeScreenshot(tabId);
    }
    else if (taskLower.includes('download')) {
        result = await downloadFile(data, tabId);
    }
    else {
        result = await genericTaskExecution(task, data, tabId);
    }
    if (result.success) {
        await learnSkill(task, result.actions);
    }
    return result;
}
async function getPageContent(tabId) {
    if (!tabId) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
    }
    const [response] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            return {
                title: document.title,
                url: window.location.href,
                text: document.body.innerText,
                html: document.body.innerHTML,
                links: Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.textContent,
                    href: a.href
                })),
                images: Array.from(document.querySelectorAll('img')).map(img => ({
                    src: img.src,
                    alt: img.alt
                })),
                headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent)
            };
        }
    });
    return response.result;
}
async function summarizeContent(data, tabId) {
    const content = await getPageContent(tabId);
    const paragraphs = content.text.split('\n\n').filter(p => p.length > 50);
    const summary = paragraphs.slice(0, 5).map(p => {
        const sentences = p.split('. ');
        return sentences[0] + '.';
    }).join(' ');
    return {
        success: true,
        summary,
        actions: ['extract_text', 'summarize']
    };
}
async function readContent(data, tabId) {
    const content = await getPageContent(tabId);
    return {
        success: true,
        content: content.text,
        actions: ['extract_text']
    };
}
async function clickElement(data, tabId) {
    const selector = data.selector || data.text;
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel) => {
            const element = document.querySelector(sel) ||
                Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.toLowerCase().includes(sel.toLowerCase()));
            if (element) {
                element.click();
                return true;
            }
            return false;
        },
        args: [selector]
    });
    return {
        success: true,
        actions: ['find_element', 'click']
    };
}
async function fillForm(data, tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (inputData) => {
            for (const [selector, value] of Object.entries(inputData)) {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        },
        args: [data.inputs || {}]
    });
    return {
        success: true,
        actions: ['find_inputs', 'fill_values']
    };
}
async function scrollPage(data, tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (direction) => {
            const amount = direction === 'down' ? 500 : -500;
            window.scrollBy(0, amount);
        },
        args: [data.direction || 'down']
    });
    return {
        success: true,
        actions: ['scroll']
    };
}
async function navigateToUrl(data, tabId) {
    const url = data.url || data.query;
    await chrome.tabs.update(tabId, { url });
    return {
        success: true,
        actions: ['navigate']
    };
}
async function takeScreenshot(tabId) {
    const dataUrl = await chrome.tabs.captureVisibleTab();
    return {
        success: true,
        screenshot: dataUrl,
        actions: ['screenshot']
    };
}
async function downloadFile(data, tabId) {
    await chrome.downloads.download({
        url: data.url,
        filename: data.filename
    });
    return {
        success: true,
        actions: ['download']
    };
}
async function genericTaskExecution(task, data, tabId) {
    const content = await getPageContent(tabId);
    return {
        success: true,
        message: 'Task processed',
        actions: ['analyze']
    };
}
async function findMatchingSkill(task) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(' ').filter(w => w.length > 3);
    for (const skill of skills) {
        if (!skill.executionPlan)
            continue;
        const keywords = skill.executionPlan.keywords || [];
        const matches = taskWords.filter(word => keywords.some(kw => kw.includes(word) || word.includes(kw)));
        if (matches.length / taskWords.length > 0.6) {
            return skill;
        }
    }
    return null;
}
async function executeWithSkill(skill, data, tabId) {
    console.log('Executing with skill:', skill.name);
    const actions = skill.executionPlan.actions || [];
    const results = [];
    for (const action of actions) {
        results.push({ action, success: true });
    }
    const skillData = await chrome.storage.local.get('skills');
    const skills = skillData.skills || [];
    const skillIndex = skills.findIndex(s => s.id === skill.id);
    if (skillIndex >= 0) {
        skills[skillIndex].metadata = skills[skillIndex].metadata || {};
        skills[skillIndex].metadata.timesUsed = (skills[skillIndex].metadata.timesUsed || 0) + 1;
        skills[skillIndex].metadata.lastUsed = new Date().toISOString();
        await chrome.storage.local.set({ skills });
    }
    return {
        success: true,
        usedSkill: skill.name,
        results
    };
}
async function learnSkill(task, actions) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    const newSkill = {
        id: `skill-${Date.now()}`,
        name: generateSkillName(task),
        description: `Learned from: "${task}"`,
        level: 1,
        parent: 'web',
        unlocked: true,
        color: '#a78bfa',
        actions: actions,
        executionPlan: {
            originalTask: task,
            actions: actions,
            keywords: extractKeywords(task)
        },
        metadata: {
            timesUsed: 1,
            lastUsed: new Date().toISOString(),
            successRate: 1.0
        }
    };
    skills.push(newSkill);
    await chrome.storage.local.set({ skills });
    console.log('New skill learned:', newSkill.name);
}
function generateSkillName(task) {
    const words = task.split(' ').filter(w => w.length > 3).slice(0, 3);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
function extractKeywords(task) {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'to', 'from', 'for', 'with'];
    return task.toLowerCase().split(' ').filter(w => w.length > 3 && !stopWords.includes(w));
}
function getInitialSkills() {
    return [
        {
            id: 'root',
            name: 'Omni Core',
            description: 'The foundation of all capabilities',
            level: 0,
            children: ['web', 'document', 'automation'],
            unlocked: true,
            color: '#00f5ff'
        },
        {
            id: 'web',
            name: 'Web Control',
            description: 'Navigate and control web pages',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: true,
            color: '#a78bfa'
        },
        {
            id: 'document',
            name: 'Document Operations',
            description: 'Read, summarize, and edit documents',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: true,
            color: '#34d399'
        },
        {
            id: 'automation',
            name: 'Task Automation',
            description: 'Automate repetitive tasks',
            level: 1,
            parent: 'root',
            children: [],
            unlocked: true,
            color: '#fbbf24'
        }
    ];
}
function getDefaultSettings() {
    return {
        voiceRate: 1.1,
        voicePitch: 1.0,
        autoSpeak: true,
        showNotifications: true
    };
}
async function saveSkill(skill) {
    const data = await chrome.storage.local.get('skills');
    const skills = data.skills || [];
    skills.push(skill);
    await chrome.storage.local.set({ skills });
}
