import * as THREE from "three";

export class Lighting {
  spotLights: THREE.SpotLight[] = [];
  timeOffsets: number[] = [];
  entranceLights: { spot: THREE.SpotLight, target: THREE.Object3D, baseX: number, baseZ: number }[] = [];

  constructor(scene: THREE.Scene) {
    const ambient = new THREE.AmbientLight(0x222233, 0.8);
    scene.add(ambient);

    const ceilingFill = new THREE.PointLight(0x223355, 2, 60);
    ceilingFill.position.set(0, 20, 0); // just below the ceiling, radiates outward
    scene.add(ceilingFill);
    
    const centerLight = new THREE.SpotLight(0xffffff, 80);
    centerLight.position.set(0, 25, 0);
    centerLight.angle = Math.PI / 3;
    centerLight.penumbra = 0.5;
    centerLight.decay = 1.5;
    centerLight.distance = 50;
    centerLight.castShadow = true;
    centerLight.shadow.mapSize.width = 1024;
    centerLight.shadow.mapSize.height = 1024;
    scene.add(centerLight);

    // Ring corner spotlights for intense arena visibility (NO SHADOWS to save FPS)
    const ringCornerOffsets = [
      [-6, 6], [6, 6], [6, -6], [-6, -6] 
    ];
    ringCornerOffsets.forEach((pos) => {
      const ringSpot = new THREE.SpotLight(0xfff5e6, 120); 
      ringSpot.position.set(pos[0], 25, pos[1]);
      ringSpot.angle = Math.PI / 5;
      ringSpot.penumbra = 0.5;
      ringSpot.decay = 1.5;
      ringSpot.distance = 40;
      ringSpot.castShadow = false; 

      const target = new THREE.Object3D();
      target.position.set(pos[0] * 0.3, 0, pos[1] * 0.3); // Point slightly inwards towards center
      scene.add(target);
      ringSpot.target = target;
      
      scene.add(ringSpot);
    });

    // Entrance runway spotlights (Moved to sides of the pathway)
    const createEntranceLight = (color: number, xPos: number, doorZ: number, targetZ: number) => {
      const spot = new THREE.SpotLight(color, 150); // Bright intensity for runway
      spot.position.set(xPos, 15, doorZ);
      spot.angle = Math.PI / 10;
      spot.penumbra = 0.8;
      spot.decay = 1.5;
      spot.distance = 60;
      spot.castShadow = false;

      const target = new THREE.Object3D();
      target.position.set(xPos * 0.5, 0, targetZ); // point slightly inward
      scene.add(target);
      spot.target = target;
      
      scene.add(spot);
      return { spot, target, baseX: xPos, baseZ: targetZ };
    };

    // Blue corner entrance (+Z)
    this.entranceLights.push(createEntranceLight(0x00aaff, 4, 48, 10));
    this.entranceLights.push(createEntranceLight(0x00aaff, -4, 48, 10));
    // Red corner entrance (-Z)
    this.entranceLights.push(createEntranceLight(0xff0044, 4, -48, -10));
    this.entranceLights.push(createEntranceLight(0xff0044, -4, -48, -10));

    // Colored sweeping spotlights (NO SHADOWS for performance)
    const colors = [0xff0055, 0x00ddff, 0xaa00ff, 0xffaa00];
    for (let i = 0; i < 4; i++) {
      const spot = new THREE.SpotLight(colors[i], 40);
      const angle = (i / 4) * Math.PI * 2; // Shifted off the pathways
      spot.position.set(Math.cos(angle) * 20, 25, Math.sin(angle) * 20);
      spot.angle = Math.PI / 5;
      spot.penumbra = 0.5;
      spot.decay = 1.5;
      spot.distance = 45;
      spot.castShadow = false;

      const target = new THREE.Object3D();
      scene.add(target);
      spot.target = target;

      scene.add(spot);
      this.spotLights.push(spot);
      this.timeOffsets.push(Math.random() * Math.PI * 2);
    }
  }

  update(time: number) {
    for (let i = 0; i < this.spotLights.length; i++) {
      const spot = this.spotLights[i];
      const target = spot.target as THREE.Object3D;
      const offset = this.timeOffsets[i];

      target.position.set(
        Math.cos(time * 0.8 + offset) * 15,
        0,
        Math.sin(time * 0.4 + offset) * 15
      );

      spot.intensity = 30 + Math.sin(time * 3 + offset) * 20;
    }

    // Sweep entrance lights slightly side to side over the runway
    this.entranceLights.forEach((light, i) => {
      const sway = Math.sin(time * 1.5 + i * Math.PI) * 1.5; // Sway x-axis left and right
      light.target.position.x = light.baseX * 0.5 + sway;
      // Pulse intensity slightly
      light.spot.intensity = 100 + Math.sin(time * 4 + i) * 50;
    });
  }
}


