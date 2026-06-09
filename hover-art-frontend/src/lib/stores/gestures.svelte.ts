const FLICKER_GRACE_MS = 300;
const L_HOLD_MS = 2000;
const PINKY_HOLD_MS = 2000;
const QUIET_COYOTE_HOLD_MS = 2000;
const NAV_DEBOUNCE_MS = 800;

export function createGestureStore(callbacks: {
    onLHoldComplete: () => void;
    onPinkyHoldComplete: () => void;
    onQuietCoyoteHoldComplete: () => void;
    onNavGesture: (direction: 'up' | 'down') => void;
}) {
    let currentGesture = $state('none');
    let lastNavGesture = $state('none');

    // Hold progress (0–1) exposed for progress arcs in the UI
    let lHoldProgress = $state(0);
    let pinkyHoldProgress = $state(0);
    let quietCoyoteHoldProgress = $state(0);

    let lHoldStart: number | null = null;
    let lLastSeenAt = 0;

    let pinkyHoldStart: number | null = null;
    let pinkyLastSeenAt = 0;

    let quietCoyoteHoldStart: number | null = null;
    let quietCoyoteLastSeenAt = 0;

    let navDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function makeHoldInterval(
        getGestureName: () => string,
        holdMs: number,
        getStart: () => number | null,
        setStart: (v: number | null) => void,
        getLastSeen: () => number,
        setLastSeen: (v: number) => void,
        setProgress: (v: number) => void,
        onComplete: () => void,
    ) {
        return setInterval(() => {
            const now = Date.now();
            if (currentGesture === getGestureName()) {
                setLastSeen(now);
                if (getStart() === null) setStart(now);
                const progress = Math.min((now - getStart()!) / holdMs, 1);
                setProgress(progress);
                if (progress >= 1) {
                    setStart(null);
                    setProgress(0);
                    onComplete();
                }
            } else {
                if (now - getLastSeen() > FLICKER_GRACE_MS) {
                    setStart(null);
                    setProgress(0);
                }
            }
        }, 50);
    }

    const lInterval = makeHoldInterval(
        () => 'l_shape', L_HOLD_MS,
        () => lHoldStart, (v) => { lHoldStart = v; },
        () => lLastSeenAt, (v) => { lLastSeenAt = v; },
        (v) => { lHoldProgress = v; },
        callbacks.onLHoldComplete,
    );

    const pinkyInterval = makeHoldInterval(
        () => 'pinky_up', PINKY_HOLD_MS,
        () => pinkyHoldStart, (v) => { pinkyHoldStart = v; },
        () => pinkyLastSeenAt, (v) => { pinkyLastSeenAt = v; },
        (v) => { pinkyHoldProgress = v; },
        callbacks.onPinkyHoldComplete,
    );

    const quietCoyoteInterval = makeHoldInterval(
        () => 'quiet_coyote', QUIET_COYOTE_HOLD_MS,
        () => quietCoyoteHoldStart, (v) => { quietCoyoteHoldStart = v; },
        () => quietCoyoteLastSeenAt, (v) => { quietCoyoteLastSeenAt = v; },
        (v) => { quietCoyoteHoldProgress = v; },
        callbacks.onQuietCoyoteHoldComplete,
    );

    function handleGestureChange(g: string, sidebarOpen: boolean) {
        currentGesture = g;

        if (sidebarOpen && (g === 'thumb_up' || g === 'thumb_down')) {
            if (g !== lastNavGesture) {
                lastNavGesture = g;
                callbacks.onNavGesture(g === 'thumb_up' ? 'up' : 'down');
                if (navDebounceTimer) clearTimeout(navDebounceTimer);
                navDebounceTimer = setTimeout(() => { lastNavGesture = 'none'; }, NAV_DEBOUNCE_MS);
            }
        }
    }

    function destroy() {
        clearInterval(lInterval);
        clearInterval(pinkyInterval);
        clearInterval(quietCoyoteInterval);
        if (navDebounceTimer) clearTimeout(navDebounceTimer);
    }

    return {
        get currentGesture() { return currentGesture; },
        get lHoldProgress() { return lHoldProgress; },
        get pinkyHoldProgress() { return pinkyHoldProgress; },
        get quietCoyoteHoldProgress() { return quietCoyoteHoldProgress; },
        handleGestureChange,
        destroy,
    };
}