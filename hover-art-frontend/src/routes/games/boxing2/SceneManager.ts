import * as THREE from 'three';
import { CameraController } from './CameraController.ts';
import { Stadium } from './Stadium.ts';
import { Crowd } from './Crowd.ts';
import { ArenaEffects } from './ArenaEffects.ts';
import { Lighting } from './Lighting.ts';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Fighter } from './Fighter.ts';

type CutsceneStep = (dt: number) => boolean;

export class SceneManager {
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	camera: THREE.PerspectiveCamera;

	ring: Stadium;
	crowd: Crowd;
	effects: ArenaEffects;
	lighting: Lighting;
	//controls: OrbitControls;

	fighter1!: Fighter;
	fighter2!: Fighter;

	// Game state callbacks
	onPlayerHP?: (hp: number) => void;
	onCpuHP?: (hp: number) => void;
	onTimer?: (time: number) => void;
	onCombo?: (combo: number) => void;
	onAction?: (text: string) => void;
	onStateChange?: (state: string) => void;

	// Game logic variables
	playerHP = 100;
	cpuHP = 100;
	playerBlocking = false;
	cpuBlocking = false;
	playerPunching = false;
	cpuPunching = false;
	combo = 0;
	comboTimer = 0;
	roundTimeLeft = 180;
	timerAccum = 0;
	cpuDecisionTimer = 0;
	gameState: 'CUTSCENE' | 'FIGHTING' | 'VICTORY' | 'DEFEAT' | 'DRAW' = 'CUTSCENE';

	private stepTime = 0;

	private startPos = new THREE.Vector3();
	private endPos = new THREE.Vector3();

	private JOG_FRAMES = 78;
	private FPS = 60;
	private JOG_DURATION = this.JOG_FRAMES / this.FPS;

	private cutsceneSteps: CutsceneStep[] = [];
	private cutsceneIndex = 0;
	private cutsceneActive = false;

	private camStart = new THREE.Vector3();
	private camEnd = new THREE.Vector3();
	private camT = 0;
	private stepInitialized = false;
	private shots = {
		fighter1Entrance: {
			pos: new THREE.Vector3(4, 3.5, 5),
			target: new THREE.Vector3(0, 1.5, 75)
		},

		fighter2Entrance: {
			pos: new THREE.Vector3(4, 3.5, -5),
			target: new THREE.Vector3(0, 1.5, -75)
		}
	};
	constructor(canvas: HTMLCanvasElement) {
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x050508);
		//this.debugCaptureKeyListener();

		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: "high-performance"
		});

		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.scene.fog = new THREE.Fog(0x05050a, 15, 70);

		this.camera = new CameraController().camera;

		this.ring = new Stadium(this.scene);
		this.crowd = new Crowd(this.scene);
		this.effects = new ArenaEffects(this.scene);
		this.lighting = new Lighting(this.scene);

		// Fighters
		this.fighter1 = new Fighter(this.scene, new THREE.Vector3(0, 0, 70));
		this.fighter2 = new Fighter(this.scene, new THREE.Vector3(0, 0, -70));

		Promise.all([this.fighter1.init(), this.fighter2.init()]).then(() => {
			this.startCutscene();
		});

		// Orbit controls
		/*
		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.enablePan = true;
		this.controls.screenSpacePanning = true;
		this.controls.minDistance = 5;
		this.controls.maxDistance = 50;
		this.controls.maxPolarAngle = Math.PI / 2.1;*/
	}

	// ────────────────────────────────────────────────
	// 🎬 CUTSCENE SYSTEM
	// ────────────────────────────────────────────────
	private setCamera(pos: THREE.Vector3, lookAt: THREE.Vector3) {
		this.camera.position.copy(pos);
		this.camera.lookAt(lookAt);
	}

	/*
	private debugCaptureKeyListener() {
		window.addEventListener("keydown", (e) => {
			if (e.key === "c") {
				const pos = this.camera.position.clone();
				const target = this.controls.target.clone();

				alert(
					`📸 Camera Capture\n\n` +
					`Position:\n  x: ${pos.x.toFixed(3)}\n  y: ${pos.y.toFixed(3)}\n  z: ${pos.z.toFixed(3)}\n\n` +
					`Target:\n  x: ${target.x.toFixed(3)}\n  y: ${target.y.toFixed(3)}\n  z: ${target.z.toFixed(3)}`
				);
				console.log("camera", this.camera.position);
				console.log("controls target", this.controls.target);
				console.log("controls enabled", this.controls.enabled);
			}
		});
	}*/

	startCutscene() {
		this.cutsceneActive = true;
		//this.controls.enabled = false;
		this.cutsceneIndex = 0;
		this.stepInitialized = false;

		this.fighter1.cutsceneLocked = true;
		this.fighter2.cutsceneLocked = true;

		this.cutsceneSteps = [
			// Step 1: fighter 1 jogs to the ring

			(dt) => {
				if (!this.stepInitialized) {
					this.fighter1.animation.play("jog");

					const shot = this.shots.fighter1Entrance;

					this.camera.position.copy(shot.pos);
					this.camera.lookAt(shot.target);

					this.stepInitialized = true;
					this.stepTime = 0;
					this.startPos = this.fighter1.model.position.clone();
					this.endPos = new THREE.Vector3(2, 0, 4);
				}

				this.stepTime += dt;
				const t = Math.min(this.stepTime / this.JOG_DURATION, 1);

				this.fighter1.model.position.lerpVectors(
					this.startPos,
					this.endPos,
					t
				);

				this.fighter1.lookAt(new THREE.Vector3(0, 0, 0));

				return this.fighter1.model.position.distanceTo(new THREE.Vector3(2, 0, 4)) < 0.3;
			},

			// Step 2: fighter 2 jogs from the other path
			(dt) => {
				if (!this.stepInitialized) {
					this.fighter2.animation.play("jog");

					const shot = this.shots.fighter2Entrance;

					this.camera.position.copy(shot.pos);
					this.camera.lookAt(shot.target);

					this.stepInitialized = true;
					this.stepTime = 0;
					this.startPos = this.fighter2.model.position.clone();
					this.endPos = new THREE.Vector3(-2, 0, -4);
				}

				this.stepTime += dt;
				const t = Math.min(this.stepTime / this.JOG_DURATION, 1);

				this.fighter2.model.position.lerpVectors(
					this.startPos,
					this.endPos,
					t
				);
				this.fighter2.lookAt(new THREE.Vector3(0, 0, 0));

				return this.fighter2.model.position.distanceTo(new THREE.Vector3(-2, 0, -4)) < 0.3;
			},

			// Step 3: both fighters facing each other
			(dt) => {
				if (!this.stepInitialized) {
					this.fighter1.animation.play("fighting idle");
					this.fighter2.animation.play("fighting idle");
					this.fighter1.lookAt(this.fighter2.model.position);
					this.fighter2.lookAt(this.fighter1.model.position);
					this.camT = 0;
					this.stepInitialized = true;
				}

				this.camT += dt * 1.5;
				const radius = 10;
				const angle = this.camT + Math.PI / 4;

				this.camera.position.set(Math.cos(angle) * radius, 4, Math.sin(angle) * radius);
				this.camera.lookAt(0, 3, 0);

				const done = this.camT > Math.PI; // Pan for a half circle
				return done;
			},

			// Step 4: First person view for the fight to begin
			(dt) => {
				if (!this.stepInitialized) {
					this.camT = 0;
					this.stepInitialized = true;
				}

				const p1 = this.fighter1.model.position;
				const p2 = this.fighter2.model.position;

				// Forward direction (fighter1 -> fighter2)
				const forward = new THREE.Vector3().subVectors(p2, p1).normalize();

				// Right vector (perpendicular to forward)
				const right = new THREE.Vector3(0, 1, 0)
					.cross(forward)
					.normalize();

				// OTS camera position:
				// behind + up + right shoulder offset
				const camPos = p1.clone()
					.add(forward.clone().multiplyScalar(-2.5)) // behind fighter1
					.add(right.clone().multiplyScalar(1.5))   // right shoulder
					.add(new THREE.Vector3(0, 4, 0));       // height

				this.camera.position.copy(camPos);

				// Look at opponent (slightly above chest/head)
				this.camera.lookAt(
					p2.clone().add(new THREE.Vector3(0, 2.2, 0))
				);

				this.camT += dt;
				return this.camT > 1.0;
			}
		];
	}

	updateCutscene(dt: number) {
		if (!this.cutsceneActive) return;

		const step = this.cutsceneSteps[this.cutsceneIndex];
		if (!step) {
			this.endCutscene();
			return;
		}

		const done = step(dt);

		if (done) {
			this.cutsceneIndex++;
			this.stepInitialized = false;
		}
	}

	endCutscene() {
		this.cutsceneActive = false;
		this.fighter1.cutsceneLocked = false;
		this.fighter2.cutsceneLocked = false;
		
		this.startFight();
	}

	// ────────────────────────────────────────────────
	// GAME LOGIC
	// ────────────────────────────────────────────────

	startFight() {
		this.gameState = 'FIGHTING';
		this.onStateChange?.(this.gameState);
		this.fighter1.animation.play('fighting idle');
		this.fighter2.animation.play('fighting idle');
	}

	restartFight() {
		this.playerHP = 100;
		this.cpuHP = 100;
		this.roundTimeLeft = 180;
		this.combo = 0;
		this.playerPunching = false;
		this.cpuPunching = false;
		this.playerBlocking = false;
		this.cpuBlocking = false;
		this.cpuDecisionTimer = 0;
		this.timerAccum = 0;
		this.onPlayerHP?.(100);
		this.onCpuHP?.(100);
		this.onTimer?.(180);
		
		this.gameState = 'FIGHTING';
		this.onStateChange?.(this.gameState);
		
		this.fighter1.animation.play('fighting idle');
		this.fighter2.animation.play('fighting idle');
	}

	triggerVictory() {
		this.gameState = 'VICTORY';
		this.onStateChange?.(this.gameState);
		this.fighter1.animation.play('house dancing');
		this.fighter2.animation.play('knockout', { once: true, clampWhenFinished: true });
	}

	triggerDefeat() {
		this.gameState = 'DEFEAT';
		this.onStateChange?.(this.gameState);
		this.fighter1.animation.play('knockout', { once: true, clampWhenFinished: true });
		this.fighter2.animation.play('house dancing');
	}

	playerGesture(gesture: string) {
		if (this.gameState !== 'FIGHTING') return;

		if (gesture === 'blockStart') {
			this.playerBlocking = true;
			this.fighter1.animation.play('block', { fadeIn: 0.15 });
			return;
		}
		if (gesture === 'blockEnd') {
			this.playerBlocking = false;
			this.fighter1.animation.play('fighting idle', { fadeIn: 0.2 });
			return;
		}
		if (gesture === 'punchLeft' || gesture === 'punchRight') {
			this._playerPunch(gesture === 'punchLeft' ? 'punch left' : 'punch right');
		}
	}

	private _playerPunch(type: string) {
		if (this.playerPunching) return;
		this.playerPunching = true;

		const safetyTimer = setTimeout(() => {
			if (this.playerPunching) {
				this.playerPunching = false;
				this.fighter1.animation.play('fighting idle', { fadeIn: 0.2 });
			}
		}, 800);

		const done = () => {
			clearTimeout(safetyTimer);
			this.playerPunching = false;
			this.fighter1.animation.play('fighting idle', { fadeIn: 0.2 });
		};

		this.fighter1.animation.play(type, {
			once: true,
			fadeIn: 0.08,
			fadeOut: 0.1,
			onDone: done
		});

		const base = type === 'punch left' ? 8 : 10;
		const dmg = this.cpuBlocking ? Math.round(base * 0.25) : base;
		this.cpuHP = Math.max(0, this.cpuHP - dmg);
		this.onCpuHP?.(this.cpuHP);

		this.combo++;
		this.comboTimer = 1.2;
		this.onCombo?.(this.combo);
		this.onAction?.(this.cpuBlocking ? '🛡 BLOCKED' : `−${dmg} HP`);

		if (!this.cpuBlocking) {
			this.fighter2.animation.play('body hit reaction', {
				once: true,
				fadeIn: 0.08,
				onDone: () => {
					if (this.gameState === 'FIGHTING') {
						this.fighter2.animation.play('fighting idle', { fadeIn: 0.2 });
					}
				}
			});
		}

		if (this.cpuHP <= 0 && this.gameState === 'FIGHTING') {
			this.triggerVictory();
		}
	}

	private _cpuPunch(type: string) {
		if (this.cpuPunching) return;
		this.cpuPunching = true;

		const safetyTimer = setTimeout(() => {
			if (this.cpuPunching) {
				this.cpuPunching = false;
				this.fighter2.animation.play('fighting idle', { fadeIn: 0.2 });
			}
		}, 800);

		const done = () => {
			clearTimeout(safetyTimer);
			this.cpuPunching = false;
			this.fighter2.animation.play('fighting idle', { fadeIn: 0.2 });
		};

		this.fighter2.animation.play(type, {
			once: true,
			fadeIn: 0.08,
			onDone: done
		});

		const base = type === 'punch left' ? 6 : 8;
		const dmg = this.playerBlocking ? Math.round(base * 0.25) : base;
		this.playerHP = Math.max(0, this.playerHP - dmg);
		this.onPlayerHP?.(this.playerHP);
		this.onAction?.(this.playerBlocking ? '🛡 BLOCKED' : `CPU −${dmg}`);

		if (!this.playerBlocking) {
			this.fighter1.animation.play('body hit reaction', {
				once: true,
				fadeIn: 0.08,
				onDone: () => {
					if (this.gameState === 'FIGHTING') {
						this.fighter1.animation.play('fighting idle', { fadeIn: 0.2 });
					}
				}
			});
		}

		if (this.playerHP <= 0 && this.gameState === 'FIGHTING') {
			this.triggerDefeat();
		}
	}

	private _updateCpuAI(dt: number) {
		this.cpuDecisionTimer -= dt;
		if (this.cpuDecisionTimer > 0) return;

		const aggression = 1 - (this.cpuHP / 100) * 0.5;
		const r = Math.random();

		if (r < 0.55 * aggression && !this.cpuPunching) {
			const punch = r < 0.5 ? 'punch left' : 'punch right';
			this._cpuPunch(punch);
		} else if (r < 0.75 && !this.cpuBlocking && !this.cpuPunching) {
			this.cpuBlocking = true;
			this.fighter2.animation.play('block', { fadeIn: 0.15 });
			setTimeout(() => {
				this.cpuBlocking = false;
				if (this.gameState === 'FIGHTING') {
					this.fighter2.animation.play('fighting idle', { fadeIn: 0.2 });
				}
			}, 600 + Math.random() * 600);
		}

		this.cpuDecisionTimer = 0.9 * (0.6 + Math.random() * 0.8);
	}

	private _updateGameLogic(dt: number) {
		if (this.gameState !== 'FIGHTING') return;

		this._updateCpuAI(dt);

		// Timer
		this.timerAccum += dt;
		if (this.timerAccum >= 1) {
			this.timerAccum -= 1;
			this.roundTimeLeft = Math.max(0, this.roundTimeLeft - 1);
			this.onTimer?.(this.roundTimeLeft);
			
			if (this.roundTimeLeft <= 0) {
				if (this.playerHP > this.cpuHP) this.triggerVictory();
				else if (this.playerHP < this.cpuHP) this.triggerDefeat();
				else {
					this.gameState = 'DRAW';
					this.onStateChange?.(this.gameState);
				}
			}
		}

		// Combo
		if (this.combo > 0) {
			this.comboTimer -= dt;
			if (this.comboTimer <= 0) {
				this.combo = 0;
				this.onCombo?.(0);
			}
		}
	}

	// ────────────────────────────────────────────────
	// UPDATE LOOP
	// ────────────────────────────────────────────────

	update(time: number) {
		this.crowd.update(time);
		this.effects.update(time);
		this.lighting.update(time);

		//this.controls.update();

		if (this.fighter1) this.fighter1.update();
		if (this.fighter2) this.fighter2.update();

		this.updateCutscene(0.016); // or pass real delta
		this._updateGameLogic(0.016);
	}

	render() {
		this.renderer.render(this.scene, this.camera);
	}
}