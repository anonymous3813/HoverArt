import * as THREE from 'three';

export class Crowd {
  bodyMesh: THREE.InstancedMesh;
  headMesh: THREE.InstancedMesh;
  count: number;
  uniforms = {
    uTime: { value: 0 }
  };

  constructor(scene: THREE.Scene) {
    // Bodies
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.3, 6);
    bodyGeo.translate(0, 0.65, 0);
    // Heads
    const headGeo = new THREE.SphereGeometry(0.25, 6, 6);
    headGeo.translate(0, 1.55, 0);

    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = `
        uniform float uTime;
        attribute float aRandom;
      ` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        float jump = max(0.0, sin(uTime * (8.0 + aRandom * 5.0) + aRandom * 100.0));
        float isJumping = step(0.3, aRandom); 
        transformed.y += jump * 0.6 * isJumping;
        transformed.x += sin(uTime * 4.0 + aRandom * 50.0) * 0.1;
        transformed.z += cos(uTime * 3.5 + aRandom * 50.0) * 0.1;
        `
      );
    };

    // Pre-calculate possible seats to avoid glitching/overlapping
    const possibleSeats: { x: number, y: number, z: number }[] = [];

    for (let tier = 0; tier < 10; tier++) {
      const radius = 16 + tier * 4 + 2.0;
      const circumference = 2 * Math.PI * radius;
      const seatSpacing = 1.3; // Generous spacing prevents overlap
      const numSeats = Math.floor(circumference / seatSpacing);

      for (let s = 0; s < numSeats; s++) {
        const angle = (s / numSeats) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (Math.abs(x) < 5.0) continue; // Pathway

        const height = tier * 2.0;
        possibleSeats.push({ x, y: height, z });
      }
    }

    // Shuffle seats
    for (let i = possibleSeats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [possibleSeats[i], possibleSeats[j]] = [possibleSeats[j], possibleSeats[i]];
    }

    this.count = Math.min(3000, possibleSeats.length);

    this.bodyMesh = new THREE.InstancedMesh(bodyGeo, mat, this.count);
    this.headMesh = new THREE.InstancedMesh(headGeo, mat, this.count);

    const randoms = new Float32Array(this.count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const palettes = [0xff0055, 0x00ddff, 0xaa00ff, 0xffaa00, 0x111111, 0x444444, 0xffffff];

    for (let i = 0; i < this.count; i++) {
      const seat = possibleSeats[i];

      dummy.position.set(seat.x, seat.y, seat.z);
      dummy.lookAt(0, seat.y, 0);
      dummy.updateMatrix();

      this.bodyMesh.setMatrixAt(i, dummy.matrix);
      this.headMesh.setMatrixAt(i, dummy.matrix);

      color.setHex(palettes[Math.floor(Math.random() * palettes.length)]);
      this.bodyMesh.setColorAt(i, color);

      color.offsetHSL(0, 0, 0.2);
      this.headMesh.setColorAt(i, color);

      randoms[i] = Math.random();
    }

    this.bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.headMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.bodyMesh.geometry.setAttribute(
      'aRandom',
      new THREE.InstancedBufferAttribute(randoms, 1)
    );

    this.headMesh.geometry.setAttribute(
      'aRandom',
      new THREE.InstancedBufferAttribute(randoms, 1)
    );

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    if (this.headMesh.instanceColor) this.headMesh.instanceColor.needsUpdate = true;

    scene.add(this.bodyMesh);
    scene.add(this.headMesh);
  }

  update(time: number) {
    this.uniforms.uTime.value = time;
  }
}


