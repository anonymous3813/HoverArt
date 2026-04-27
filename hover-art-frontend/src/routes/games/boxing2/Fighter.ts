import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AnimationController } from './AnimationController.js';

export class Fighter {
  model!: THREE.Group;
  animation!: AnimationController;

  private mixer!: THREE.AnimationMixer;
  private clock = new THREE.Clock();

  private ready = false;
  private _readyPromise: Promise<void>;
  private _resolveReady!: () => void;

  // CUTSCENE LOCK
  public cutsceneLocked = false;
  private animationLocked = false;

  // internal movement (ONLY used when NOT in cutscene)
  private moveTarget: THREE.Vector3 | null = null;
  private moveSpeed = 0;

  constructor(
    private scene: THREE.Scene,
    private position: THREE.Vector3
  ) {
    this._readyPromise = new Promise((res) => {
      this._resolveReady = res;
    });
  }

  async init() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/boxer.glb');

    this.model = gltf.scene;

    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.model.scale.set(2, 2, 2);
    this.model.position.copy(this.position);

    this.scene.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.animation = new AnimationController(this.mixer);

    gltf.animations.forEach((clip) => {
      this.animation.addClip(clip.name || 'clip', clip);
    });

    this.playAnimation('idle');

    this.ready = true;
    this._resolveReady();
  }

  waitUntilReady() {
    return this._readyPromise;
  }

  isReady() {
    return this.ready;
  }

  playAnimation(name: string, options: any = {}) {
    if (this.animationLocked) return;
    this.animation.play(name, options);
  }

  lockAnimation() {
    this.animationLocked = true;
  }

  unlockAnimation() {
    this.animationLocked = false;
  }

  // now SAFE (only works outside cutscene)
  moveTo(target: THREE.Vector3, speed = 1) {
    if (!this.model) return;
    if (this.cutsceneLocked) return;

    this.moveTarget = target.clone();
    this.moveSpeed = speed;
  }

  lookAt(target: THREE.Vector3) {
    if (!this.model) return;
    this.model.lookAt(target);
  }

  // Allow external delta time to sync animation with cutscene
  update(externalDt?: number) {
    if (!this.ready) return;

    const dt = externalDt ?? this.clock.getDelta();

    // animation
    this.animation.update(dt);

    if (!this.cutsceneLocked && this.moveTarget) {
      this.model.position.lerp(this.moveTarget, this.moveSpeed * dt * 60);

      if (this.model.position.distanceTo(this.moveTarget) < 0.1) {
        this.moveTarget = null;
      }
    }
  }
}