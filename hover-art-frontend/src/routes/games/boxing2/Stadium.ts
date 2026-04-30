import * as THREE from 'three';

export class Stadium {
  constructor(scene: THREE.Scene) {
    const stadiumGroup = new THREE.Group();

    // ─── Materials ───────────────────────────────────────────────────────────
    const tierMat     = new THREE.MeshPhongMaterial({ color: 0x0a0a0f });
    const wallMat     = new THREE.MeshPhongMaterial({ color: 0x151520, side: THREE.BackSide });
    const floorMat    = new THREE.MeshPhongMaterial({ color: 0x111115 });
    const gapWallMat  = new THREE.MeshPhongMaterial({ color: 0x141418, side: THREE.DoubleSide });

    // ─── Concourse ───────────────────────────────────────────────────────────
    const concourse = new THREE.Mesh(
      new THREE.RingGeometry(10, 22, 48),
      new THREE.MeshPhongMaterial({ color: 0x0d0d12 })
    );
    concourse.rotation.x = -Math.PI / 2;
    concourse.position.y = -0.4;
    stadiumGroup.add(concourse);

    // ─── Floor ───────────────────────────────────────────────────────────────
    const stadiumFloor = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 0.1, 48), floorMat);
    stadiumFloor.position.set(0, -0.6, 0);
    stadiumGroup.add(stadiumFloor);

    // ─── Tier arc builder ────────────────────────────────────────────────────
    const pathHalfWidth = 4.5;

    const buildTierArc = (
      innerR: number,
      outerR: number,
      yPos: number,
      mat: THREE.Material,
      isLeft: boolean
    ): THREE.Mesh => {
      const gapAngle = Math.asin(Math.min(pathHalfWidth / outerR, 0.98));
      const thetaStart  = isLeft ? Math.PI / 2 + gapAngle : -Math.PI / 2 + gapAngle;
      const thetaLength = Math.PI - 2 * gapAngle;

      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerR, thetaStart, thetaStart + thetaLength, false);
      shape.absarc(0, 0, innerR, thetaStart + thetaLength, thetaStart, true);

      const geo  = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y  = yPos;
      return mesh;
    };

    // ─── Bowl tiers ───────────────────────────────────────────────────────────
    const tierCount  = 12;
    const baseRadius = 18;

    const tierData: { innerR: number; outerR: number; yOuter: number }[] = [];

    for (let i = 0; i < tierCount; i++) {
      const t = i / (tierCount - 1);

      const radiusBase  = baseRadius + Math.pow(t, 1.5) * 70;
      const tierDepth   = 2.5 + t * 3.0;
      const height      = Math.pow(t, 1.8) * 26;
      const wobble      = Math.sin(i * 2.1) * 0.6;

      const innerRadius = radiusBase + wobble;
      const outerRadius = innerRadius + tierDepth;

      tierData.push({ innerR: innerRadius, outerR: outerRadius, yOuter: height + 1.2 });

      stadiumGroup.add(buildTierArc(innerRadius, outerRadius, height, tierMat, true));
      stadiumGroup.add(buildTierArc(innerRadius, outerRadius, height, tierMat, false));
    }

    // ─── Gap walls ───────────────────────────────────────────────────────────
    tierData.forEach(({ innerR, outerR, yOuter }: { innerR: number; outerR: number; yOuter: number }) => {
      const gapAngle   = Math.asin(Math.min(pathHalfWidth / outerR, 0.98));
      const radialLen  = outerR - innerR;
      const wallHeight = yOuter + 2.0;
      const midR       = (innerR + outerR) / 2;

      for (const zSign of [1, -1]) {
        const wx = -midR * Math.sin(gapAngle);
        const wz =  zSign * midR * Math.cos(gapAngle);
        const wy =  wallHeight / 2 - 0.6;

        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(radialLen, wallHeight, 0.4),
          gapWallMat
        );
        panel.position.set(wx, wy, wz);
        panel.rotation.y = -(Math.PI / 2 + gapAngle) * zSign;
        stadiumGroup.add(panel);

        const panel2 = panel.clone();
        panel2.position.set(-wx, wy, wz);
        panel2.rotation.y = (Math.PI / 2 + gapAngle) * zSign;
        stadiumGroup.add(panel2);
      }
    });

    // ─── Illuminated red floor paths (replaces tunnels) ───────────────────────
    // Each path runs from the ring edge to the outer wall along ±Z.
    const pathWidth   = 6;
    const pathStart   = 9;
    const pathEnd     = 87;
    const pathLength  = pathEnd - pathStart;
    const pathCentreZ = (pathStart + pathEnd) / 2;

    const redGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff0022,
      emissive: new THREE.Color(0xff0022),
      emissiveIntensity: 1.8,
      roughness: 0.3,
      metalness: 0.1,
    });

    // Dark base mat for the surrounding path floor
    const pathBaseMat = new THREE.MeshPhongMaterial({ color: 0x0d0d10 });

    const buildPath = (zSign: number) => {
      const group = new THREE.Group();

      // Dark floor base strip
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(pathWidth, 0.3, pathLength),
        pathBaseMat
      );
      base.position.set(0, -0.55, 0);
      group.add(base);

      // Left edge line
      const edgeLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.33, pathLength),
        redGlowMat
      );
      edgeLeft.position.set(-(pathWidth / 2 - 0.06), -0.48, 0);
      group.add(edgeLeft);

      // Right edge line
      const edgeRight = edgeLeft.clone();
      edgeRight.position.set(pathWidth / 2 - 0.06, -0.48, 0);
      group.add(edgeRight);

      group.position.set(0, 0, zSign * pathCentreZ);
      return group;
    };

    stadiumGroup.add(buildPath(1));
    stadiumGroup.add(buildPath(-1));

    // ─── Doors with illuminated outlines ─────────────────────────────────────
    const doorFrameGlowMat = new THREE.MeshStandardMaterial({
      color: 0xff0022,
      emissive: new THREE.Color(0xff0022),
      emissiveIntensity: 2.2,
    });
    const doorFillMat = new THREE.MeshPhongMaterial({ color: 0x0a0a0e });
    const doorLightMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const tunnelHeight = 6; // kept for door sizing reference

    const createDoor = (zPos: number, isForward: boolean) => {
      const doorGroup = new THREE.Group();

      const doorW = pathWidth - 0.5;
      const doorH = tunnelHeight - 1;
      const frameThickness = 0.35;

      // Dark door fill panel
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW, doorH),
        doorFillMat
      );
      fill.position.set(0, doorH / 2, isForward ? -0.05 : 0.05);
      if (!isForward) fill.rotation.y = Math.PI;
      doorGroup.add(fill);

      // Glowing portal (cyan inner glow — kept from original)
      const portal = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW - 0.4, doorH - 0.4),
        doorLightMat
      );
      portal.position.set(0, doorH / 2, isForward ? -0.3 : 0.3);
      if (!isForward) portal.rotation.y = Math.PI;
      doorGroup.add(portal);

      // ── Glowing red frame: four thin box strips around the door edge ──
      // Top bar
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(doorW + frameThickness * 2, frameThickness, frameThickness),
        doorFrameGlowMat
      );
      topBar.position.set(0, doorH + frameThickness / 2, 0);
      doorGroup.add(topBar);

      // Bottom bar
      const bottomBar = topBar.clone();
      bottomBar.position.set(0, -frameThickness / 2, 0);
      doorGroup.add(bottomBar);

      // Left upright
      const leftBar = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, doorH + frameThickness * 2, frameThickness),
        doorFrameGlowMat
      );
      leftBar.position.set(-(doorW / 2 + frameThickness / 2), doorH / 2, 0);
      doorGroup.add(leftBar);

      // Right upright
      const rightBar = leftBar.clone();
      rightBar.position.set(doorW / 2 + frameThickness / 2, doorH / 2, 0);
      doorGroup.add(rightBar);

      doorGroup.position.set(0, -0.5, zPos);
      return doorGroup;
    };

    stadiumGroup.add(createDoor(pathEnd, true));
    stadiumGroup.add(createDoor(-pathEnd, false));

    // ─── Lower bowl front fascia ──────────────────────────────────────────────
    // Split into two arcs (±X hemispheres) with gaps at ±Z for the paths.
    {
      const fasciaR   = 22;
      const fasciaGap = Math.asin(Math.min(pathHalfWidth / fasciaR, 0.98));
      const fasciaMat = new THREE.MeshPhongMaterial({ color: 0x181820, side: THREE.DoubleSide });
      for (const startAngle of [fasciaGap, Math.PI + fasciaGap]) {
        const arc = new THREE.Mesh(
          new THREE.CylinderGeometry(fasciaR, fasciaR, 1.5, 64, 1, true, startAngle, Math.PI - 2 * fasciaGap),
          fasciaMat
        );
        arc.position.y = 0.35;
        stadiumGroup.add(arc);
      }
    }

    // ─── Roof accent ring ─────────────────────────────────────────────────────
    const accentRing = new THREE.Mesh(
      new THREE.TorusGeometry(82, 0.35, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xff0055 })
    );
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.y  = 38.5;
    stadiumGroup.add(accentRing);

    

    // ─── Roof ─────────────────────────────────────────────────────────────────
    const ceiling2 = new THREE.Mesh(
      new THREE.CircleGeometry(90, 64),
      new THREE.MeshPhongMaterial({
        color: 0x101018,
        emissive: new THREE.Color(0x050510),
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide
      })
    );
    ceiling2.rotation.x = Math.PI / 2;
    ceiling2.position.y  = 40;
    stadiumGroup.add(ceiling2);

    // ─── Jumbotron ────────────────────────────────────────────────────────────
    const jumboGroup  = new THREE.Group();
    const jumboScreen = new THREE.MeshBasicMaterial({ color: 0x1144ff });
    const jumboMat    = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const jumboBox    = new THREE.Mesh(
      new THREE.BoxGeometry(12, 7, 12),
      [jumboScreen, jumboScreen, jumboMat, jumboMat, jumboScreen, jumboScreen]
    );
    jumboGroup.add(jumboBox);

    const cableMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    [[4,0,4],[-4,0,4],[4,0,-4],[-4,0,-4]].forEach(([x,,z]) => {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 20), cableMat);
      cable.position.set(x, 10, z);
      jumboGroup.add(cable);
    });
    jumboGroup.position.y = 22;
    stadiumGroup.add(jumboGroup);

    // ─── Ring ─────────────────────────────────────────────────────────────────
    const ringBase = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 16),
      new THREE.MeshPhongMaterial({ color: 0x0a0a0a }));
    ringBase.position.set(0, -0.5, 0);
    stadiumGroup.add(ringBase);

    const postMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
    const ropeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff0055, emissive: 0xff0055, emissiveIntensity: 0.5,
      transmission: 0.5, opacity: 0.8, transparent: true
    });

    const postOffsets: [number,number][] = [[-7.5,-7.5],[7.5,-7.5],[7.5,7.5],[-7.5,7.5]];
    postOffsets.forEach(([px, pz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.5), postMat);
      post.position.set(px, 1, pz);
      stadiumGroup.add(post);
    });

    for (let h = 1; h <= 2; h++) {
      for (let i = 0; i < 4; i++) {
        const p1 = postOffsets[i];
        const p2 = postOffsets[(i + 1) % 4];
        const len = Math.hypot(p2[0]-p1[0], p2[1]-p1[1]);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len), ropeMat);
        rope.position.set((p1[0]+p2[0])/2, h*1.1, (p1[1]+p2[1])/2);
        rope.lookAt(p2[0], h*1.1, p2[1]);
        rope.rotateX(Math.PI / 2);
        stadiumGroup.add(rope);
      }
    }

    scene.add(stadiumGroup);
  }
}