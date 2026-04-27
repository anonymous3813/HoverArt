/**
 * GameEngine.js
 * Manages the Three.js scene, character loading, fight simulation, and CPU AI.
 * Player input comes from PoseDetector gestures via playerGesture().
 */

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { AnimationController, loadMixamoAnimations } from './AnimationController.ts';

// ─── Constants ────────────────────────────────────────────────────────────────
const RING_HALF = 4.5;
const FIGHTER_Z = 1.8; // fixed distance apart (no movement)
const PUNCH_DMG = { punchLeft: 8, punchRight: 10 };
const BLOCK_REDUCE = 0.25; // damage multiplier when blocking
const CPU_REACT_TIME = 0.9; // seconds between CPU decisions
const ROUND_SECONDS = 180;

export class GameEngine {
	canvas: HTMLCanvasElement;
	cb: any;
	renderer: THREE.WebGLRenderer | null;
	scene: THREE.Scene | null;
	camera: THREE.PerspectiveCamera | null;
	clock: THREE.Clock;
	playerRoot: THREE.Group | null;
	cpuRoot: THREE.Group | null;
	playerCtrl: AnimationController | null;
	cpuCtrl: AnimationController | null;
	_mixers: THREE.AnimationMixer[];
	playerPos: THREE.Vector3;
	cpuPos: THREE.Vector3;
	isRunning: boolean;
	playerHP: number;
	cpuHP: number;
	playerBlocking: boolean;
	cpuBlocking: boolean;
	playerPunching: boolean;
	cpuPunching: boolean;
	combo: number;
	comboTimer: number;
	roundTimeLeft: number;
	timerAccum: number;
	cpuDecisionTimer: number;
	_raf: number | null;

	constructor(canvas, callbacks = {}) {
		this.canvas = canvas;
		this.cb = callbacks;

		// Three.js
		this.renderer = null;
		this.scene = null;
		this.camera = null;
		this.clock = new THREE.Clock(false);

		// Characters
		this.playerRoot = null;
		this.cpuRoot = null;
		this.playerCtrl = null;
		this.cpuCtrl = null;
		this._mixers = [];

		// Fixed positions — no movement
		this.playerPos = new THREE.Vector3(0, 0, FIGHTER_Z);
		this.cpuPos = new THREE.Vector3(0, 0, -FIGHTER_Z);

		// Fight state
		this.isRunning = false;
		this.playerHP = 100;
		this.cpuHP = 100;
		this.playerBlocking = false;
		this.cpuBlocking = false;
		this.playerPunching = false;
		this.cpuPunching = false;
		this.combo = 0;
		this.comboTimer = 0;
		this.roundTimeLeft = ROUND_SECONDS;
		this.timerAccum = 0;
		this.cpuDecisionTimer = 0;

		this._raf = null;
	}

	// ─── Init ─────────────────────────────────────────────────────────────────

	async init() {
		this._setupRenderer();
		this._setupScene();
		this._buildRing();

		const animPaths = this.cb.animationPaths ?? {};
		const totalSteps = 2 + Object.keys(animPaths).length * 2;
		let step = 0;
		const tick = (msg) => {
			step++;
			this.cb.onProgress?.(Math.round((step / totalSteps) * 100), msg);
		};

		const loader = new FBXLoader();

		this.cb.onProgress?.(0, 'Loading player model…');
		this.playerRoot = await loader.loadAsync(this.cb.playerModelPath);
		this._prepareCharacter(this.playerRoot, true);
		tick('Player model loaded');

		this.cb.onProgress?.(10, 'Loading CPU model…');
		this.cpuRoot = await loader.loadAsync(this.cb.cpuModelPath);
		this._prepareCharacter(this.cpuRoot, false);
		tick('CPU model loaded');

		const playerMixer = new THREE.AnimationMixer(this.playerRoot);
		const cpuMixer = new THREE.AnimationMixer(this.cpuRoot);
		this.playerCtrl = new AnimationController(playerMixer);
		this.cpuCtrl = new AnimationController(cpuMixer);
		this._mixers = [playerMixer, cpuMixer];

		this.cb.onProgress?.(20, 'Loading animations…');
		const [playerAnims, cpuAnims] = await Promise.all([
			loadMixamoAnimations(playerMixer, this.playerRoot, animPaths, (n, t) =>
				this.cb.onProgress?.(20 + Math.round((n / t) * 35), `Animations ${n}/${t}…`)
			),
			loadMixamoAnimations(cpuMixer, this.cpuRoot, animPaths, (n, t) =>
				this.cb.onProgress?.(55 + Math.round((n / t) * 35), `CPU animations ${n}/${t}…`)
			)
		]);

		for (const [name, action] of playerAnims) this.playerCtrl.addClip(name, action);
		for (const [name, action] of cpuAnims) this.cpuCtrl.addClip(name, action);

		this._ensureAnimationFallback(this.playerCtrl);
		this._ensureAnimationFallback(this.cpuCtrl);

		this.playerCtrl.play('idle', { fadeIn: 0 });
		this.cpuCtrl.play('idle', { fadeIn: 0 });

		this.cb.onProgress?.(100, 'Ready!');
		this.cb.onReady?.();
		this._tick();
	}

	// ─── Scene ────────────────────────────────────────────────────────────────

	_setupRenderer() {
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			powerPreference: 'high-performance'
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.2;
		window.addEventListener('resize', this._onResize.bind(this));
	}

	_setupScene() {
		this.scene = new THREE.Scene();

		const canvas = document.createElement('canvas');
		canvas.width = 1;
		canvas.height = 256;
		const ctx = canvas.getContext('2d');
		const gradient = ctx.createLinearGradient(0, 0, 0, 256);
		gradient.addColorStop(0, '#111111'); // top
		gradient.addColorStop(1, '#000000'); // bottom
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 1, 256);
		this.scene.background = new THREE.CanvasTexture(canvas);

		// Minimal lighting
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

		// Third-person camera
		this.camera = new THREE.PerspectiveCamera(
			60, // narrower FOV works well for third-person
			this.canvas.clientWidth / this.canvas.clientHeight,
			0.1,
			100
		);

		// Initial camera position (will adjust after characters load)
		this.camera.position.set(0, 3.5, 6);
		this.camera.lookAt(0, 1.0, 0); // temporary target
	}

	_buildRing() {
		const R = RING_HALF;

		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(R * 2, R * 2),
			new THREE.MeshStandardMaterial({ map: this._makeRingTexture(512), roughness: 0.9 })
		);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		this.scene.add(floor);

		const postMat = new THREE.MeshStandardMaterial({
			color: 0xdddddd,
			metalness: 0.3,
			roughness: 0.5
		});
		[
			[-R, R],
			[R, R],
			[-R, -R],
			[R, -R]
		].forEach(([x, z]) => {
			const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), postMat);
			post.position.set(x, 1.25, z);
			this.scene.add(post);
		});

		const ropeMat = new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.8 });
		[0.7, 1.2, 1.8].forEach((y) => {
			[
				[0, y, R, R * 2, 0.03, 0.03],
				[0, y, -R, R * 2, 0.03, 0.03],
				[-R, y, 0, 0.03, 0.03, R * 2],
				[R, y, 0, 0.03, 0.03, R * 2]
			].forEach(([x, ry, z, w, h, d]) => {
				const rope = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ropeMat);
				rope.position.set(x, ry, z);
				this.scene.add(rope);
			});
		});

		const crowd = new THREE.Mesh(
			new THREE.TorusGeometry(9, 0.8, 8, 64),
			new THREE.MeshStandardMaterial({
				color: 0x110800,
				emissive: 0xff6600,
				emissiveIntensity: 0.15
			})
		);
		crowd.rotation.x = Math.PI / 2;
		crowd.position.y = 0.1;
		this.scene.add(crowd);
	}

	_makeRingTexture(size) {
		const cv = document.createElement('canvas');
		cv.width = cv.height = size;
		const ctx = cv.getContext('2d');
		ctx.fillStyle = '#c8a96e';
		ctx.fillRect(0, 0, size, size);
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size * 0.18, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(size / 2, 0);
		ctx.lineTo(size / 2, size);
		ctx.stroke();
		return new THREE.CanvasTexture(cv);
	}

	_ensureAnimationFallback(ctrl) {
		if (!ctrl.hasClip('idle')) {
			const candidate = ctrl.getFirstClipName();
			if (candidate) {
				console.warn(`GameEngine: 'idle' clip missing; using '${candidate}' as fallback`);
				ctrl.play(candidate, { fadeIn: 0, once: false });
			}
		}
	}

	_prepareCharacter(fbx: THREE.Group, isPlayer: boolean) {
		fbx.scale.setScalar(0.01);

		fbx.traverse((child) => {
			if (child.isMesh) {
				child.castShadow = child.receiveShadow = true;
				if (child.material) child.material.side = THREE.FrontSide;
			}
		});

		// Set positions
		fbx.position.copy(isPlayer ? this.playerPos : this.cpuPos);

		// Face each other
		fbx.rotation.y = isPlayer ? Math.PI : 0;

		this.scene.add(fbx);

		// Only for player: setup angled third-person camera
		if (isPlayer) {
			const cameraOffset = new THREE.Vector3(-2, 2.5, 6); // left + up + behind
			this.camera.position.copy(this.playerPos.clone().add(cameraOffset));

			const midpoint = this.playerPos.clone().add(this.cpuPos).multiplyScalar(0.5);
			midpoint.y += 1.2; // aim at upper body
			this.camera.lookAt(midpoint);
		}
	}

	// ─── Game loop ────────────────────────────────────────────────────────────

	_tick() {
		this._raf = requestAnimationFrame(this._tick.bind(this));
		const dt = this.clock.getDelta();

		if (this.isRunning) {
			this._updateCpuAI(dt);
			this._updateTimer(dt);
			this._updateCombo(dt);
		}

		this._mixers.forEach((m) => m.update(dt));

		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		if (this.renderer.domElement.width !== w || this.renderer.domElement.height !== h) {
			this.renderer.setSize(w, h, false);
			this.camera.aspect = w / h;
			this.camera.updateProjectionMatrix();
		}

		this.renderer.render(this.scene, this.camera);
	}

	// ─── Pose gesture entry point (called by PoseDetector) ───────────────────

	/**
	 * Called by BoxingGame.svelte when MediaPipe classifies a gesture.
	 * @param {'punchLeft'|'punchRight'|'blockStart'|'blockEnd'} gesture
	 */
	playerGesture(gesture) {
		if (!this.isRunning) return;

		if (gesture === 'blockStart') {
			this.playerBlocking = true;
			this.playerCtrl.play('block', { fadeIn: 0.15 });
			return;
		}
		if (gesture === 'blockEnd') {
			this.playerBlocking = false;
			this.playerCtrl.play('idle', { fadeIn: 0.2 });
			return;
		}
		// All punch types
		if (gesture === 'punchLeft' || gesture === 'punchRight') {
			this._playerPunch(gesture);
		}
	}

	// ─── Combat ───────────────────────────────────────────────────────────────────

	// Safety timeout: if onDone never fires, force-reset punch state after this many ms.
	// Should be longer than the longest punch animation (~600ms is typical for Mixamo).
	PUNCH_TIMEOUT_MS = 800;

	_playerPunch(type) {
		if (this.playerPunching) return;
		this.playerPunching = true;
        console.log(`Player punch: ${type} (blocking: ${this.playerBlocking}, CPU HP: ${this.cpuHP})`);

		// Safety net: if onDone never fires (e.g. AnimationController bug or
		// missing clip), this ensures we don't get permanently stuck in punch state.
		const safetyTimer = setTimeout(() => {
			if (this.playerPunching) {
				console.log(`GameEngine: punch '${type}' onDone never fired — force resetting`);
				this.playerPunching = false;
				this.playerCtrl?.play('idle', { fadeIn: 0.2 });
			}
		}, this.PUNCH_TIMEOUT_MS);

		const done = () => {
			clearTimeout(safetyTimer);
			this.playerPunching = false;
			this.playerCtrl.play('idle', { fadeIn: 0.2 });
		};

		// Check the clip actually exists before trying to play it.
		// If it doesn't, AnimationController likely silently no-ops and onDone
		// never fires — which is the most common cause of stuck idle.
		if (!this.playerCtrl.hasClip(type)) {
			console.warn(`GameEngine: animation clip '${type}' not found — playing idle`);
			done();
		} else {
			this.playerCtrl.play(type, {
				once: true,
				fadeIn: 0.08,
				fadeOut: 0.1,
				onDone: done
			});
		}

		const base = PUNCH_DMG[type] ?? 7;
		const dmg = this.cpuBlocking ? Math.round(base * BLOCK_REDUCE) : base;
		this.cpuHP = Math.max(0, this.cpuHP - dmg);
		this.cb.onCpuHP?.(this.cpuHP);

		this.combo++;
		this.comboTimer = 1.2;
		this.cb.onCombo?.(this.combo);
		this.cb.onAction?.(this.cpuBlocking ? '🛡 BLOCKED' : `−${dmg} HP`);

		if (!this.cpuBlocking) {
			this.cpuCtrl.play('hitReact', {
				once: true,
				fadeIn: 0.08,
				onDone: () => this.cpuCtrl.play('idle', { fadeIn: 0.2 })
			});
		}
	}

	// Apply the same fix to CPU punches for consistency
	_cpuPunch(type) {
		if (this.cpuPunching) return;
		this.cpuPunching = true;

		const safetyTimer = setTimeout(() => {
			if (this.cpuPunching) {
				this.cpuPunching = false;
				this.cpuCtrl?.play('idle', { fadeIn: 0.2 });
			}
		}, this.PUNCH_TIMEOUT_MS);

		const done = () => {
			clearTimeout(safetyTimer);
			this.cpuPunching = false;
			this.cpuCtrl.play('idle', { fadeIn: 0.2 });
		};

		if (!this.cpuCtrl.hasClip(type)) {
			done();
		} else {
			this.cpuCtrl.play(type, {
				once: true,
				fadeIn: 0.08,
				onDone: done
			});
		}

		const base = PUNCH_DMG[type] ?? 6;
		const dmg = this.playerBlocking ? Math.round(base * BLOCK_REDUCE) : base;
		this.playerHP = Math.max(0, this.playerHP - dmg);
		this.cb.onPlayerHP?.(this.playerHP);
		this.cb.onAction?.(this.playerBlocking ? '🛡 BLOCKED' : `CPU −${dmg}`);

		if (!this.playerBlocking) {
			this.playerCtrl.play('hitReact', {
				once: true,
				fadeIn: 0.08,
				onDone: () => this.playerCtrl.play('idle', { fadeIn: 0.2 })
			});
		}
	}

	// ─── CPU AI ───────────────────────────────────────────────────────────────

	_updateCpuAI(dt) {
		this.cpuDecisionTimer -= dt;
		if (this.cpuDecisionTimer > 0) return;

		const aggression = 1 - (this.cpuHP / 100) * 0.5;
		const r = Math.random();

		if (r < 0.55 * aggression && !this.cpuPunching) {
			const punch = r < 0.5 ? 'punchLeft' : 'punchRight';
			this._cpuPunch(punch);
		} else if (r < 0.75 && !this.cpuBlocking && !this.cpuPunching) {
			this.cpuBlocking = true;
			this.cpuCtrl.play('block', { fadeIn: 0.15 });
			setTimeout(
				() => {
					this.cpuBlocking = false;
					if (this.isRunning) this.cpuCtrl.play('idle', { fadeIn: 0.2 });
				},
				600 + Math.random() * 600
			);
		}

		this.cpuDecisionTimer = CPU_REACT_TIME * (0.6 + Math.random() * 0.8);
	}

	// ─── Timer / combo ────────────────────────────────────────────────────────

	_updateTimer(dt) {
		this.timerAccum += dt;
		if (this.timerAccum >= 1) {
			this.timerAccum -= 1;
			this.roundTimeLeft = Math.max(0, this.roundTimeLeft - 1);
			this.cb.onTimer?.(this.roundTimeLeft);
		}
	}

	_updateCombo(dt) {
		if (this.combo > 0) {
			this.comboTimer -= dt;
			if (this.comboTimer <= 0) {
				this.combo = 0;
				this.cb.onCombo?.(0);
			}
		}
	}

	// ─── Public controls ──────────────────────────────────────────────────────

	startFight() {
		this.isRunning = true;
		this.clock.start();
		this.playerCtrl?.play('idle', { fadeIn: 0.2 });
		this.cpuCtrl?.play('idle', { fadeIn: 0.2 });
	}

	restartFight() {
		this.playerHP = 100;
		this.cpuHP = 100;
		this.roundTimeLeft = ROUND_SECONDS;
		this.combo = 0;
		this.playerPunching = false;
		this.cpuPunching = false;
		this.playerBlocking = false;
		this.cpuBlocking = false;
		this.cpuDecisionTimer = 0;
		this.timerAccum = 0;
		this.cb.onPlayerHP?.(100);
		this.cb.onCpuHP?.(100);
		this.cb.onTimer?.(ROUND_SECONDS);
		this.isRunning = true;
		this.clock.start();
		this.playerCtrl?.play('idle', { fadeIn: 0.1 });
		this.cpuCtrl?.play('idle', { fadeIn: 0.1 });
	}

	triggerVictory() {
		this.isRunning = false;
		this.playerCtrl?.play('victory', { fadeIn: 0.3 });
		this.cpuCtrl?.play('defeated', { fadeIn: 0.3 });
	}

	triggerDefeat() {
		this.isRunning = false;
		this.playerCtrl?.play('defeated', { fadeIn: 0.3 });
		this.cpuCtrl?.play('victory', { fadeIn: 0.3 });
	}

	dispose() {
		cancelAnimationFrame(this._raf);
		window.removeEventListener('resize', this._onResize.bind(this));
		this.playerCtrl?.dispose();
		this.cpuCtrl?.dispose();
		this.renderer?.dispose();
	}

	_onResize() {
		const w = this.canvas.clientWidth;
		const h = this.canvas.clientHeight;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
	}
}
