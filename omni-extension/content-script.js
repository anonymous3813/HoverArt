console.log('Omni Enhanced content script loaded');
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received:', message);
    try {
        let result;
        switch (message.type) {
            case 'GET_PAGE_INFO':
                result = getPageInfo();
                break;
            case 'CLICK_ELEMENT':
                result = clickElement(message.selector);
                break;
            case 'FILL_INPUT':
                result = fillInput(message.selector, message.value);
                break;
            case 'EXTRACT_TEXT':
                result = extractText(message.selector);
                break;
            case 'HIGHLIGHT_ELEMENT':
                result = highlightElement(message.selector);
                break;
            case 'SELECT_DROPDOWN':
                result = selectDropdown(message.selector, message.value);
                break;
            case 'CHECK_CHECKBOX':
                result = checkCheckbox(message.selector, message.checked);
                break;
            case 'RADIO_SELECT':
                result = selectRadio(message.selector);
                break;
            case 'HOVER_ELEMENT':
                result = hoverElement(message.selector);
                break;
            case 'DRAG_ELEMENT':
                result = dragElement(message.fromSelector, message.toSelector);
                break;
            case 'SCROLL_TO_ELEMENT':
                result = scrollToElement(message.selector);
                break;
            case 'WAIT_FOR_ELEMENT':
                result = await waitForElement(message.selector, message.timeout);
                break;
            case 'REPLACE_TEXT':
                result = replaceText(message.selector, message.oldText, message.newText);
                break;
            case 'APPEND_TEXT':
                result = appendText(message.selector, message.text);
                break;
            case 'GET_SELECTED_TEXT':
                result = getSelectedText();
                break;
            case 'SELECT_TEXT':
                result = selectText(message.selector);
                break;
            case 'SUBMIT_FORM':
                result = submitForm(message.selector);
                break;
            case 'RESET_FORM':
                result = resetForm(message.selector);
                break;
            case 'FILL_FORM':
                result = fillForm(message.formData);
                break;
            case 'VALIDATE_FORM':
                result = validateForm(message.selector);
                break;
            case 'PLAY_VIDEO':
                result = playVideo(message.selector);
                break;
            case 'PAUSE_VIDEO':
                result = pauseVideo(message.selector);
                break;
            case 'MUTE_VIDEO':
                result = muteVideo(message.selector);
                break;
            case 'SET_VIDEO_TIME':
                result = setVideoTime(message.selector, message.time);
                break;
            case 'PLAY_AUDIO':
                result = playAudio(message.selector);
                break;
            case 'PAUSE_AUDIO':
                result = pauseAudio(message.selector);
                break;
            case 'HIDE_ELEMENTS':
                result = hideElements(message.selector);
                break;
            case 'SHOW_ELEMENTS':
                result = showElements(message.selector);
                break;
            case 'REMOVE_ELEMENTS':
                result = removeElements(message.selector);
                break;
            case 'MODIFY_CSS':
                result = modifyCSS(message.selector, message.styles);
                break;
            case 'ADD_CLASS':
                result = addClass(message.selector, message.className);
                break;
            case 'REMOVE_CLASS':
                result = removeClass(message.selector, message.className);
                break;
            case 'TOGGLE_CLASS':
                result = toggleClass(message.selector, message.className);
                break;
            case 'EXTRACT_LINKS':
                result = extractLinks();
                break;
            case 'EXTRACT_IMAGES':
                result = extractImages();
                break;
            case 'EXTRACT_VIDEOS':
                result = extractVideos();
                break;
            case 'EXTRACT_TABLES':
                result = extractTables();
                break;
            case 'EXTRACT_HEADINGS':
                result = extractHeadings();
                break;
            case 'EXTRACT_METADATA':
                result = extractMetadata();
                break;
            case 'EXTRACT_EMAILS':
                result = extractEmails();
                break;
            case 'EXTRACT_PHONE_NUMBERS':
                result = extractPhoneNumbers();
                break;
            case 'WATCH_ELEMENT':
                result = watchElement(message.selector, message.property);
                break;
            case 'MONITOR_CHANGES':
                result = monitorDOMChanges(message.selector);
                break;
            case 'READ_ALOUD':
                result = readAloud(message.text || document.body.innerText);
                break;
            case 'DARK_MODE':
                result = toggleDarkMode(message.enable);
                break;
            case 'FOCUS_MODE':
                result = enableFocusMode(message.enable);
                break;
            case 'AUTO_SCROLL':
                result = autoScroll(message.speed);
                break;
            default:
                result = { success: false, error: 'Unknown action' };
        }
        if (result instanceof Promise) {
            result.then(r => sendResponse(r));
        }
        else {
            sendResponse(result);
        }
    }
    catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
    }
    return true;
});
function getPageInfo() {
    return {
        url: window.location.href,
        title: document.title,
        text: document.body.innerText,
        wordCount: document.body.innerText.split(/\s+/).length,
        links: document.querySelectorAll('a').length,
        images: document.querySelectorAll('img').length,
        forms: document.querySelectorAll('form').length,
        videos: document.querySelectorAll('video').length,
        scripts: document.querySelectorAll('script').length,
        scrollHeight: document.documentElement.scrollHeight,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
    };
}
function clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.click();
        return { success: true, message: `Clicked ${selector}` };
    }
    const allElements = document.querySelectorAll('button, a, [onclick], [role="button"]');
    for (const el of allElements) {
        if (el.textContent.toLowerCase().includes(selector.toLowerCase())) {
            el.click();
            return { success: true, message: `Clicked element containing "${selector}"` };
        }
    }
    return { success: false, error: `Element not found: ${selector}` };
}
function fillInput(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, message: `Filled ${selector}` };
    }
    return { success: false, error: `Input not found: ${selector}` };
}
function extractText(selector) {
    const element = selector ? document.querySelector(selector) : document.body;
    if (element) {
        return { success: true, text: element.innerText };
    }
    return { success: false, error: `Element not found: ${selector}` };
}
function highlightElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.style.outline = '3px solid #00f5ff';
        element.style.backgroundColor = 'rgba(0, 245, 255, 0.1)';
        setTimeout(() => {
            element.style.outline = '';
            element.style.backgroundColor = '';
        }, 2000);
        return { success: true };
    }
    return { success: false, error: `Element not found: ${selector}` };
}
function selectDropdown(selector, value) {
    const element = document.querySelector(selector);
    if (element && element.tagName === 'SELECT') {
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
    }
    return { success: false, error: 'Dropdown not found' };
}
function checkCheckbox(selector, checked) {
    const element = document.querySelector(selector);
    if (element && element.type === 'checkbox') {
        element.checked = checked;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
    }
    return { success: false, error: 'Checkbox not found' };
}
function selectRadio(selector) {
    const element = document.querySelector(selector);
    if (element && element.type === 'radio') {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
    }
    return { success: false, error: 'Radio button not found' };
}
function hoverElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        const event = new MouseEvent('mouseenter', { bubbles: true });
        element.dispatchEvent(event);
        return { success: true };
    }
    return { success: false, error: 'Element not found' };
}
function dragElement(fromSelector, toSelector) {
    const from = document.querySelector(fromSelector);
    const to = document.querySelector(toSelector);
    if (from && to) {
        const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
        const dropEvent = new DragEvent('drop', { bubbles: true });
        from.dispatchEvent(dragStartEvent);
        to.dispatchEvent(dropEvent);
        return { success: true };
    }
    return { success: false, error: 'Elements not found' };
}
function scrollToElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true };
    }
    return { success: false, error: 'Element not found' };
}
async function waitForElement(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
            return { success: true, message: 'Element found' };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { success: false, error: 'Timeout waiting for element' };
}
function replaceText(selector, oldText, newText) {
    const element = document.querySelector(selector);
    if (element) {
        element.innerHTML = element.innerHTML.replace(new RegExp(oldText, 'g'), newText);
        return { success: true };
    }
    return { success: false, error: 'Element not found' };
}
function appendText(selector, text) {
    const element = document.querySelector(selector);
    if (element) {
        element.innerHTML += text;
        return { success: true };
    }
    return { success: false, error: 'Element not found' };
}
function getSelectedText() {
    const selection = window.getSelection();
    return {
        success: true,
        text: selection.toString(),
        range: {
            start: selection.anchorOffset,
            end: selection.focusOffset
        }
    };
}
function selectText(selector) {
    const element = document.querySelector(selector);
    if (element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return { success: true };
    }
    return { success: false, error: 'Element not found' };
}
function submitForm(selector) {
    const form = document.querySelector(selector);
    if (form && form.tagName === 'FORM') {
        form.submit();
        return { success: true };
    }
    return { success: false, error: 'Form not found' };
}
function resetForm(selector) {
    const form = document.querySelector(selector);
    if (form && form.tagName === 'FORM') {
        form.reset();
        return { success: true };
    }
    return { success: false, error: 'Form not found' };
}
function fillForm(formData) {
    let filled = 0;
    for (const [key, value] of Object.entries(formData)) {
        const element = document.querySelector(`[name="${key}"], #${key}`);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            }
            else if (element.type === 'radio') {
                element.checked = element.value === value;
            }
            else {
                element.value = value;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            filled++;
        }
    }
    return { success: true, filled };
}
function validateForm(selector) {
    const form = document.querySelector(selector);
    if (form && form.tagName === 'FORM') {
        const isValid = form.checkValidity();
        const errors = [];
        if (!isValid) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (!input.validity.valid) {
                    errors.push({
                        name: input.name,
                        message: input.validationMessage
                    });
                }
            });
        }
        return { success: true, valid: isValid, errors };
    }
    return { success: false, error: 'Form not found' };
}
function playVideo(selector) {
    const video = document.querySelector(selector);
    if (video && video.tagName === 'VIDEO') {
        video.play();
        return { success: true };
    }
    return { success: false, error: 'Video not found' };
}
function pauseVideo(selector) {
    const video = document.querySelector(selector);
    if (video && video.tagName === 'VIDEO') {
        video.pause();
        return { success: true };
    }
    return { success: false, error: 'Video not found' };
}
function muteVideo(selector) {
    const video = document.querySelector(selector);
    if (video && video.tagName === 'VIDEO') {
        video.muted = !video.muted;
        return { success: true, muted: video.muted };
    }
    return { success: false, error: 'Video not found' };
}
function setVideoTime(selector, time) {
    const video = document.querySelector(selector);
    if (video && video.tagName === 'VIDEO') {
        video.currentTime = time;
        return { success: true };
    }
    return { success: false, error: 'Video not found' };
}
function playAudio(selector) {
    const audio = document.querySelector(selector);
    if (audio && audio.tagName === 'AUDIO') {
        audio.play();
        return { success: true };
    }
    return { success: false, error: 'Audio not found' };
}
function pauseAudio(selector) {
    const audio = document.querySelector(selector);
    if (audio && audio.tagName === 'AUDIO') {
        audio.pause();
        return { success: true };
    }
    return { success: false, error: 'Audio not found' };
}
function hideElements(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.style.display = 'none');
    return { success: true, count: elements.length };
}
function showElements(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.style.display = '');
    return { success: true, count: elements.length };
}
function removeElements(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.remove());
    return { success: true, count: elements.length };
}
function modifyCSS(selector, styles) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
        for (const [prop, value] of Object.entries(styles)) {
            el.style[prop] = value;
        }
    });
    return { success: true, count: elements.length };
}
function addClass(selector, className) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.classList.add(className));
    return { success: true, count: elements.length };
}
function removeClass(selector, className) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.classList.remove(className));
    return { success: true, count: elements.length };
}
function toggleClass(selector, className) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => el.classList.toggle(className));
    return { success: true, count: elements.length };
}
function extractLinks() {
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.textContent.trim(),
        title: a.title
    }));
    return { success: true, links };
}
function extractImages() {
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
    }));
    return { success: true, images };
}
function extractVideos() {
    const videos = Array.from(document.querySelectorAll('video')).map(video => ({
        src: video.src,
        duration: video.duration,
        currentTime: video.currentTime
    }));
    return { success: true, videos };
}
function extractTables() {
    const tables = Array.from(document.querySelectorAll('table')).map((table, index) => ({
        index,
        rows: table.rows.length,
        data: Array.from(table.rows).map(row => Array.from(row.cells).map(cell => cell.textContent.trim()))
    }));
    return { success: true, tables };
}
function extractHeadings() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        level: h.tagName,
        text: h.textContent.trim()
    }));
    return { success: true, headings };
}
function extractMetadata() {
    const meta = {};
    document.querySelectorAll('meta').forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        if (name) {
            meta[name] = tag.getAttribute('content');
        }
    });
    return { success: true, metadata: meta };
}
function extractEmails() {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const text = document.body.innerText;
    const emails = text.match(emailRegex) || [];
    return { success: true, emails: [...new Set(emails)] };
}
function extractPhoneNumbers() {
    const phoneRegex = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
    const text = document.body.innerText;
    const phones = text.match(phoneRegex) || [];
    return { success: true, phones: [...new Set(phones)] };
}
let elementWatchers = new Map();
function watchElement(selector, property) {
    const element = document.querySelector(selector);
    if (!element) {
        return { success: false, error: 'Element not found' };
    }
    const watcherId = `${selector}-${property}`;
    const observer = new MutationObserver((mutations) => {
        chrome.runtime.sendMessage({
            type: 'ELEMENT_CHANGED',
            selector,
            property,
            value: element[property]
        });
    });
    observer.observe(element, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    });
    elementWatchers.set(watcherId, observer);
    return { success: true, watcherId };
}
function monitorDOMChanges(selector) {
    const target = selector ? document.querySelector(selector) : document.body;
    if (!target) {
        return { success: false, error: 'Element not found' };
    }
    const observer = new MutationObserver((mutations) => {
        chrome.runtime.sendMessage({
            type: 'DOM_CHANGED',
            mutations: mutations.length,
            selector
        });
    });
    observer.observe(target, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    });
    return { success: true };
}
function readAloud(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
    return { success: true, length: text.length };
}
function toggleDarkMode(enable) {
    if (enable) {
        document.body.style.filter = 'invert(1) hue-rotate(180deg)';
        document.querySelectorAll('img, video').forEach(el => {
            el.style.filter = 'invert(1) hue-rotate(180deg)';
        });
    }
    else {
        document.body.style.filter = '';
        document.querySelectorAll('img, video').forEach(el => {
            el.style.filter = '';
        });
    }
    return { success: true, enabled: enable };
}
function enableFocusMode(enable) {
    if (enable) {
        document.querySelectorAll('header, nav, aside, footer, [role="complementary"]').forEach(el => {
            el.style.display = 'none';
        });
    }
    else {
        document.querySelectorAll('header, nav, aside, footer, [role="complementary"]').forEach(el => {
            el.style.display = '';
        });
    }
    return { success: true, enabled: enable };
}
let autoScrollInterval;
function autoScroll(speed = 1) {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
        return { success: true, message: 'Auto-scroll stopped' };
    }
    autoScrollInterval = setInterval(() => {
        window.scrollBy(0, speed);
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }, 16);
    return { success: true, message: 'Auto-scroll started' };
}
const domain = window.location.hostname;
if (domain.includes('chat.openai.com') || domain.includes('chatgpt.com')) {
    console.log('ChatGPT detected - Enhanced features enabled');
    window.omniChatGPT = {
        getConversation: () => {
            const messages = Array.from(document.querySelectorAll('[data-message-author-role]')).map(msg => ({
                role: msg.getAttribute('data-message-author-role'),
                content: msg.textContent.trim()
            }));
            return messages;
        },
        sendMessage: (text) => {
            const textarea = document.querySelector('textarea');
            if (textarea) {
                textarea.value = text;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                const button = document.querySelector('[data-testid="send-button"]');
                if (button)
                    button.click();
            }
        }
    };
}
if (domain.includes('docs.google.com')) {
    console.log('Google Docs detected - Enhanced features enabled');
    window.omniGoogleDocs = {
        getText: () => {
            return document.querySelector('.kix-page-content-wrapper')?.innerText || '';
        },
        insertText: (text) => {
            document.execCommand('insertText', false, text);
        }
    };
}
function injectOmniIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'omni-indicator';
    indicator.innerHTML = 'Omni';
    indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    cursor: pointer;
    z-index: 10000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    transition: transform 0.2s;
  `;
    indicator.addEventListener('mouseenter', () => {
        indicator.style.transform = 'scale(1.1)';
    });
    indicator.addEventListener('mouseleave', () => {
        indicator.style.transform = 'scale(1)';
    });
    indicator.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });
    document.body.appendChild(indicator);
}
chrome.storage.local.get('settings', (data) => {
    if (data.settings?.showFloatingButton) {
        injectOmniIndicator();
    }
});
console.log('Omni Enhanced content script ready with 60+ functions!');
