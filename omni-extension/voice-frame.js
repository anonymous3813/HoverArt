(function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById('vfMic');
    if (!SpeechRecognition) {
        btn.disabled = true;
        btn.title = 'Speech recognition not supported';
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ OMNI_VOICE: true, error: 'Speech recognition not supported in this browser.' }, window.location.origin);
        }
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang =
        navigator.language && /^en/i.test(navigator.language) ? navigator.language : 'en-US';
    let listening = false;
    async function primeMicrophoneAudio() {
        if (!navigator.mediaDevices?.getUserMedia)
            return true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((t) => t.stop());
            return true;
        }
        catch (_) {
            postToParent({ phase: 'error', error: 'microphone_blocked' });
            return false;
        }
    }
    function tryStartRecognition() {
        try {
            recognition.start();
        }
        catch (err) {
            if (err.name === 'InvalidStateError') {
                try {
                    recognition.stop();
                }
                catch (_) { }
                setTimeout(() => {
                    try {
                        recognition.start();
                    }
                    catch (e2) {
                        postToParent({ phase: 'error', error: 'start_failed' });
                    }
                }, 120);
                return;
            }
            postToParent({ phase: 'error', error: err.message || String(err) });
        }
    }
    function postToParent(payload) {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ OMNI_VOICE: true, ...payload }, window.location.origin);
        }
    }
    recognition.onstart = () => {
        listening = true;
        btn.classList.add('listening');
        postToParent({ phase: 'start' });
    };
    recognition.onresult = (event) => {
        let full = '';
        for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript;
        }
        full = full.trim();
        if (!full)
            return;
        const last = event.results[event.results.length - 1];
        if (last.isFinal) {
            postToParent({ phase: 'final', text: full });
        }
        else {
            postToParent({ phase: 'interim', text: full });
        }
    };
    recognition.onerror = (event) => {
        listening = false;
        btn.classList.remove('listening');
        let code = event.error || 'unknown';
        if (code === 'aborted')
            return;
        postToParent({ phase: 'error', error: code });
    };
    recognition.onend = () => {
        listening = false;
        btn.classList.remove('listening');
        postToParent({ phase: 'end' });
    };
    btn.addEventListener('click', async () => {
        if (listening) {
            try {
                recognition.stop();
            }
            catch (_) { }
            return;
        }
        const micOk = await primeMicrophoneAudio();
        if (!micOk)
            return;
        tryStartRecognition();
    }, false);
    window.addEventListener('message', (e) => {
        if (e.origin !== window.location.origin)
            return;
        if (e.data && e.data.OMNI_VOICE_TRIGGER === true) {
            btn.click();
        }
    });
})();
