import * as THREE from 'three';

export class AnimationController {
	private mixer: THREE.AnimationMixer;
	private actions = new Map<string, THREE.AnimationAction>();
	private current: THREE.AnimationAction | null = null;

	constructor(mixer: THREE.AnimationMixer) {
		this.mixer = mixer;
	}

	// register a clip
	addClip(name: string, clip: THREE.AnimationClip) {
		const action = this.mixer.clipAction(clip);
		this.actions.set(name, action);
	}

	// main play function
	play(
		name: string,
		options?: {
			fadeIn?: number;
			fadeOut?: number;
			loop?: boolean;
			once?: boolean;
			onDone?: () => void;
		}
	) {
		const action = this.actions.get(name);
		if (!action) return;

		const {
			fadeIn = 0.2,
			fadeOut = 0.2,
			loop = true,
			once = false,
			onDone
		} = options ?? {};

		const isSameAction = this.current === action;

		// Prevent restarting if we are already playing this looping animation
		if (isSameAction && action.isRunning() && !once) {
			return;
		}

		// Fade out all other running actions
		this.actions.forEach((a) => {
			if (a !== action && a.isRunning() && a.getEffectiveWeight() > 0) {
				a.fadeOut(fadeOut);
			}
		});

		action.reset();
		action.loop = once ? THREE.LoopOnce : THREE.LoopRepeat;
		action.clampWhenFinished = once;

		if (once && onDone) {
			const handler = (e: THREE.Event) => {
				if (e.action === action) {
					this.mixer.removeEventListener('finished', handler);
					onDone();
				}
			};

			this.mixer.addEventListener('finished', handler);
		}

		action.play();

		// Only fade in if we are transitioning from a different action
		if (!isSameAction) {
			action.fadeIn(fadeIn);
		}

		this.current = action;
	}

	update(dt: number) {
		this.mixer.update(dt);

		// Stop background animations that have finished fading out.
		// This prevents 0-weight looping animations from causing quaternion flip glitches.
		this.actions.forEach((a) => {
			if (a !== this.current && a.isRunning() && a.getEffectiveWeight() <= 0.001) {
				a.stop();
			}
		});
	}
}