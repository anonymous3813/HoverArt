import * as THREE from "three";

export class ArenaEffects {
  lasers: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x0a0a16, 0.015);

    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const laserGeo = new THREE.CylinderGeometry(0.1, 0.2, 80, 4);
    laserGeo.translate(0, 40, 0);

    for (let i = 0; i < 4; i++) {
      const laser = new THREE.Mesh(laserGeo, laserMat);

      const angle = (i * Math.PI / 2) + Math.PI / 4;

      laser.position.set(
        Math.cos(angle) * 25,
        0,
        Math.sin(angle) * 25
      );

      scene.add(laser);
      this.lasers.push(laser);
    }
  }

  update(time: number) {
    this.lasers.forEach((laser, i) => {
      laser.rotation.z = Math.sin(time + i) * 0.5;
      laser.rotation.x = Math.cos(time * 0.8 + i) * 0.5;

      const hue = (time * 0.1 + i * 0.25) % 1;
      (laser.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.5);
    });
  }
}