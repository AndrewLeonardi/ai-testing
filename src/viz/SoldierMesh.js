// Soldier 3D mesh: capsule body + direction indicator + HP bar.

import * as THREE from 'three';
import { DIR_N, DIR_E, DIR_S, DIR_W } from '../sim/Grid.js';

const FACING_ROTATIONS = {
  [DIR_N]: 0,
  [DIR_E]: -Math.PI / 2,
  [DIR_S]: Math.PI,
  [DIR_W]: Math.PI / 2,
};

export function createSoldierMesh(soldierState) {
  const group = new THREE.Group();

  // Body - cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 }); // army green
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.35;
  group.add(body);

  // Head - sphere
  const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x33691e });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.85;
  group.add(head);

  // Helmet
  const helmetGeo = new THREE.SphereGeometry(0.22, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const helmetMat = new THREE.MeshLambertMaterial({ color: 0x4a6741 });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.y = 0.88;
  group.add(helmet);

  // Direction indicator - small cone pointing forward
  const dirGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
  const dirMat = new THREE.MeshLambertMaterial({ color: 0x76ff03 });
  const dirCone = new THREE.Mesh(dirGeo, dirMat);
  dirCone.rotation.x = Math.PI / 2;
  dirCone.position.set(0, 0.4, -0.4);
  group.add(dirCone);

  // HP bar background
  const hpBgGeo = new THREE.PlaneGeometry(0.6, 0.08);
  const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
  const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
  hpBg.position.set(0, 1.15, 0);
  hpBg.rotation.x = -Math.PI / 4;
  group.add(hpBg);

  // HP bar fill
  const hpFillGeo = new THREE.PlaneGeometry(0.6, 0.08);
  const hpFillMat = new THREE.MeshBasicMaterial({ color: 0x4caf50, side: THREE.DoubleSide });
  const hpFill = new THREE.Mesh(hpFillGeo, hpFillMat);
  hpFill.position.set(0, 1.15, 0.01);
  hpFill.rotation.x = -Math.PI / 4;
  group.add(hpFill);

  // Store references
  group.userData = {
    body, bodyMat, dirCone, hpFill, hpFillMat,
    prevX: soldierState.x,
    prevY: soldierState.y,
  };

  // Initial position
  group.position.set(soldierState.x + 0.5, 0, soldierState.y + 0.5);
  group.rotation.y = FACING_ROTATIONS[soldierState.facing] || 0;

  return group;
}

export function updateSoldierMesh(mesh, state, alpha) {
  if (!state.alive) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;

  const ud = mesh.userData;

  // Interpolate position
  const targetX = state.x + 0.5;
  const targetZ = state.y + 0.5;
  mesh.position.x += (targetX - mesh.position.x) * 0.3;
  mesh.position.z += (targetZ - mesh.position.z) * 0.3;

  // Rotation (snap to facing)
  const targetRot = FACING_ROTATIONS[state.facing] || 0;
  mesh.rotation.y = targetRot;

  // Ducking animation
  const targetY = state.ducking ? -0.2 : 0;
  mesh.position.y += (targetY - mesh.position.y) * 0.3;

  // HP bar
  const hpFrac = state.hp / state.maxHp;
  ud.hpFill.scale.x = Math.max(0.01, hpFrac);
  ud.hpFill.position.x = -(1 - hpFrac) * 0.3;

  // HP color
  if (hpFrac > 0.6) ud.hpFillMat.color.setHex(0x4caf50);
  else if (hpFrac > 0.3) ud.hpFillMat.color.setHex(0xff9800);
  else ud.hpFillMat.color.setHex(0xf44336);

  // Body color flash on damage
  ud.bodyMat.color.setHex(0x2e7d32);

  ud.prevX = state.x;
  ud.prevY = state.y;
}
