/**
 * AnimationController.js
 * Wraps a THREE.AnimationMixer and manages state-machine transitions
 * between Mixamo FBX animations on a single character.
 *
 * Usage:
 *   const ctrl = new AnimationController(mixer);
 *   ctrl.addClip('idle',   idleAction);
 *   ctrl.addClip('punch',  punchAction);
 *   ctrl.play('idle');
 *   ctrl.play('punch', { fadeIn: 0.1, fadeOut: 0.2, once: true, onDone: () => ctrl.play('idle') });
 */

import * as THREE from 'three';

export class AnimationController {
  /** @param {THREE.AnimationMixer} mixer */
  constructor(mixer) {
    this.mixer        = mixer;
    /** @type {Map<string, THREE.AnimationAction>} */
    this.clips        = new Map();
    this.current      = null; // { name, action }
    this._pendingDone = new Map(); // name → callback

    // Arrow function keeps 'this' without clobbering the prototype method,
    // and gives us a stable reference for removeEventListener.
    this._onFinishedBound = (e) => this._onFinished(e);
    this.mixer.addEventListener('finished', this._onFinishedBound);
  }

  // ─── Registration ─────────────────────────────────────────────────────────────

  /**
   * Register an AnimationAction.
   * Call once per clip after loading with FBXLoader.
   * @param {string} name
   * @param {THREE.AnimationAction} action
   */
  addClip(name, action) {
    action.setEffectiveWeight(0);
    action.setEffectiveTimeScale(1);
    action.enabled = true;
    action.play();   // keep all actions "playing"; we control weight instead
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

  // ─── Playback ─────────────────────────────────────────────────────────────────

  /**
   * Transition to a new animation.
   *
   * @param {string} name  - Key registered via addClip()
   * @param {object} opts
   * @param {number}   [opts.fadeIn=0.2]   - Fade-in duration (s)
   * @param {number}   [opts.fadeOut=0.2]  - Fade-out duration for previous (s)
   * @param {boolean}  [opts.once=false]   - Play once then call onDone
   * @param {number}   [opts.timeScale=1]  - Speed multiplier
   * @param {Function} [opts.onDone]       - Called when a once-shot clip ends
   */
  play(name, { fadeIn = 0.2, fadeOut = 0.2, once = false, timeScale = 1, onDone } = {}) {
    let clipName = name;
    if (!this.clips.has(clipName)) {
      const fallback = this.getFirstClipName();
      console.warn(
        `[AnimationController] Clip "${clipName}" not found, falling back to "${fallback}".`
      );
      if (!fallback) return;
      clipName = fallback;
    }
    if (this.current?.name === clipName) return;

    const nextAction = this.clips.get(clipName);
    if (!nextAction) return;
    const prevAction = this.current?.action ?? null;

    // Fade out previous
    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(fadeOut);
    }

    // Set up next
    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(timeScale);
    nextAction.setEffectiveWeight(1);
    nextAction.time = 0;
    nextAction.fadeIn(fadeIn);
    nextAction.clampWhenFinished = false; // keep blending behavior robust
    nextAction.loop = once ? THREE.LoopOnce : THREE.LoopRepeat;

    if (once && onDone) {
      this._pendingDone.set(clipName, onDone);
    }

    this.current = { name: clipName, action: nextAction };
  }

  /** Returns the name of the currently playing animation. */
  get currentName() { return this.current?.name ?? null; }

  /** Directly cross-fade between two named clips (lower-level helper). */
  crossFadeTo(from, to, duration = 0.3) {
    if (!this.clips.has(from) || !this.clips.has(to)) return;
    this.clips.get(from).crossFadeTo(this.clips.get(to), duration, true);
    this.current = { name: to, action: this.clips.get(to) };
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  _onFinished(e) {
    // e.action is the action that just finished a LoopOnce
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load all Mixamo FBX animations onto a target skeleton and return
 * a map of { name → AnimationAction }.
 *
 * Mixamo FBX files export the rig + a single clip.  When your character model
 * and animations share the same bone names (they do when both come from Mixamo)
 * you can retarget clips by simply replacing the root bone reference.
 *
 * @param {THREE.AnimationMixer} mixer       - Attached to the character root
 * @param {THREE.Group}          charRoot    - The loaded character FBX group
 * @param {{ [name: string]: string }} paths - { animName: '/path/to/anim.fbx' }
 * @param {Function} onProgress             - (loaded, total) callback
 * @returns {Promise<Map<string, THREE.AnimationAction>>}
 */
export async function loadMixamoAnimations(mixer, charRoot, paths, onProgress) {
  const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
  const loader = new FBXLoader();

  const entries = Object.entries(paths);
  const actions = new Map();
  let   loaded  = 0;

  await Promise.all(entries.map(async ([name, path]) => {
    try {
      const gltf = await loader.loadAsync(path);
      const clip = gltf.animations[0];
      if (!clip) {
        console.warn(`[loadMixamoAnimations] No animation in ${path}`);
        return;
      }

      // GLB files exported from Mixamo via FBX2glTF retain the "mixamorig:"
      // prefix on bone tracks — strip it so they retarget onto the character.
      retargetMixamoClip(clip, charRoot);

      const action = mixer.clipAction(clip);
      actions.set(name, action);
    } catch (err) {
      console.error(`[loadMixamoAnimations] Failed to load "${name}" from ${path}:`, err);
    } finally {
      loaded++;
      onProgress?.(loaded, entries.length);
    }
  }));

  return actions;
}

/**
 * Mixamo exports bone tracks prefixed with the armature name (e.g. "mixamorig:Hips").
 * This strips those prefixes so the clip works on re-used skeletons.
 */
function retargetMixamoClip(clip, root) {
  // Find the actual root bone name in the loaded character
  let rootBoneName = '';
  root.traverse(obj => {
    if (obj.isBone && !rootBoneName) rootBoneName = obj.name.split(':')[0];
  });

  clip.tracks.forEach(track => {
    // "mixamorig:Hips.position" → find bone name after ":"
    const colonIdx = track.name.indexOf(':');
    if (colonIdx !== -1) {
      track.name = track.name.substring(colonIdx + 1);
    }
  });
}