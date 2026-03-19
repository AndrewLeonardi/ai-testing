// Building 3D meshes: HQ, Cannon, Wall.

import * as THREE from 'three';

export function createBuildingMesh(buildingState) {
  const group = new THREE.Group();

  switch (buildingState.buildingType) {
    case 'HQ':
      createHQ(group);
      break;
    case 'CANNON':
      createCannon(group);
      break;
    case 'WALL':
      createWall(group);
      break;
  }

  group.position.set(buildingState.x + 0.5, 0, buildingState.y + 0.5);
  group.userData = { buildingType: buildingState.buildingType };
  return group;
}

function createHQ(group) {
  // Main building
  const baseGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.6;
  group.add(base);

  // Roof
  const roofGeo = new THREE.ConeGeometry(1.2, 0.6, 4);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xa0522d });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 1.5;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  // Flag pole
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 2.3, 0);
  group.add(pole);

  // Flag
  const flagGeo = new THREE.PlaneGeometry(0.4, 0.25);
  const flagMat = new THREE.MeshLambertMaterial({ color: 0xff0000, side: THREE.DoubleSide });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.2, 2.6, 0);
  group.add(flag);

  // HP bar
  addHPBar(group, 2.9);

  group.userData.baseMat = baseMat;
}

function createCannon(group) {
  // Base
  const baseGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.3, 8);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.15;
  group.add(base);

  // Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 8);
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.35, -0.3);
  group.add(barrel);

  // Turret head
  const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.4;
  group.add(head);

  // HP bar
  addHPBar(group, 0.8);
}

function createWall(group) {
  const wallGeo = new THREE.BoxGeometry(0.95, 0.8, 0.95);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9e9e9e });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.y = 0.4;
  group.add(wall);

  // Stone texture detail
  const detailGeo = new THREE.BoxGeometry(0.97, 0.02, 0.97);
  const detailMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
  for (let i = 0; i < 3; i++) {
    const detail = new THREE.Mesh(detailGeo, detailMat);
    detail.position.y = 0.1 + i * 0.25;
    group.add(detail);
  }

  group.userData.wallMat = wallMat;
}

function addHPBar(group, height) {
  const bgGeo = new THREE.PlaneGeometry(0.8, 0.08);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.position.set(0, height, 0);
  bg.rotation.x = -Math.PI / 4;
  group.add(bg);

  const fillGeo = new THREE.PlaneGeometry(0.8, 0.08);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xf44336, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.position.set(0, height, 0.01);
  fill.rotation.x = -Math.PI / 4;
  group.add(fill);

  group.userData.hpFill = fill;
  group.userData.hpFillMat = fillMat;
}

export function updateBuildingMesh(mesh, state) {
  if (!state.alive) {
    // Destroyed: flatten and darken
    mesh.scale.y = Math.max(0.1, mesh.scale.y * 0.9);
    mesh.position.y = Math.min(0, mesh.position.y - 0.01);
    return;
  }

  // HP bar
  const hpFill = mesh.userData.hpFill;
  if (hpFill) {
    const frac = state.hp / state.maxHp;
    hpFill.scale.x = Math.max(0.01, frac);
    hpFill.position.x = -(1 - frac) * 0.4;
  }
}
