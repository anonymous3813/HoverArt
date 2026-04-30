import * as THREE from 'three';
export class AnimationController {
    constructor(mixer) {
        this.mixer = mixer;
        this.clips = new Map();
        this.current = null;
        this._pendingDone = new Map();
        this._onFinishedBound = (e) => this._onFinished(e);
        this.mixer.addEventListener('finished', this._onFinishedBound);
    }
    addClip(name, action) {
        action.setEffectiveWeight(0);
        action.setEffectiveTimeScale(1);
        action.enabled = true;
        action.play();
        this.clips.set(name, action);
    }
    hasClip(name) {
        return this.clips.has(name);
    }
    getClip(name) {
        return this.clips.get(name) ?? null;
    }
    getFirstClipName() {
        return this.clips.keys().next().value ?? null;
    }
    play(name, { fadeIn = 0.2, fadeOut = 0.2, once = false, timeScale = 1, onDone } = {}) {
        let clipName = name;
        if (!this.clips.has(clipName)) {
            const fallback = this.getFirstClipName();
            console.warn(`[AnimationController] Clip "${clipName}" not found, falling back to "${fallback}".`);
            if (!fallback)
                return;
            clipName = fallback;
        }
        if (this.current?.name === clipName)
            return;
        const nextAction = this.clips.get(clipName);
        if (!nextAction)
            return;
        const prevAction = this.current?.action ?? null;
        if (prevAction && prevAction !== nextAction) {
            prevAction.fadeOut(fadeOut);
        }
        nextAction.reset();
        nextAction.enabled = true;
        nextAction.setEffectiveTimeScale(timeScale);
        nextAction.setEffectiveWeight(1);
        nextAction.time = 0;
        nextAction.fadeIn(fadeIn);
        nextAction.clampWhenFinished = false;
        nextAction.loop = once ? THREE.LoopOnce : THREE.LoopRepeat;
        if (once && onDone) {
            this._pendingDone.set(clipName, onDone);
        }
        this.current = { name: clipName, action: nextAction };
    }
    get currentName() { return this.current?.name ?? null; }
    crossFadeTo(from, to, duration = 0.3) {
        if (!this.clips.has(from) || !this.clips.has(to))
            return;
        this.clips.get(from).crossFadeTo(this.clips.get(to), duration, true);
        this.current = { name: to, action: this.clips.get(to) };
    }
    _onFinished(e) {
        for (const [name, action] of this.clips) {
            if (action === e.action && this._pendingDone.has(name)) {
                const cb = this._pendingDone.get(name);
                this._pendingDone.delete(name);
                cb();
                break;
            }
        }
    }
    dispose() {
        this.mixer.removeEventListener('finished', this._onFinishedBound);
    }
}
export async function loadMixamoAnimations(mixer, charRoot, paths, onProgress) {
    const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
    const loader = new FBXLoader();
    const entries = Object.entries(paths);
    const actions = new Map();
    let loaded = 0;
    await Promise.all(entries.map(async ([name, path]) => {
        try {
            const gltf = await loader.loadAsync(path);
            const clip = gltf.animations[0];
            if (!clip) {
                console.warn(`[loadMixamoAnimations] No animation in ${path}`);
                return;
            }
            retargetMixamoClip(clip, charRoot);
            const action = mixer.clipAction(clip);
            actions.set(name, action);
        }
        catch (err) {
            console.error(`[loadMixamoAnimations] Failed to load "${name}" from ${path}:`, err);
        }
        finally {
            loaded++;
            onProgress?.(loaded, entries.length);
        }
    }));
    return actions;
}
function retargetMixamoClip(clip, root) {
    let rootBoneName = '';
    root.traverse(obj => {
        if (obj.isBone && !rootBoneName)
            rootBoneName = obj.name.split(':')[0];
    });
    clip.tracks.forEach(track => {
        const colonIdx = track.name.indexOf(':');
        if (colonIdx !== -1) {
            track.name = track.name.substring(colonIdx + 1);
        }
    });
}
