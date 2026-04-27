import * as THREE from 'three';

export class CameraController {
	camera;

	constructor() {
		this.camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		this.camera.position.set(0, 8, 12);
		this.camera.lookAt(0, 2, 0);
	}

	follow(target) {
		// later: smooth follow boxer
	}
}
