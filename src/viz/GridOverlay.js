// Debug grid lines overlay.

import * as THREE from 'three';

export function createGridOverlay(size) {
  const points = [];
  const color = new THREE.Color(0x3a5a3a);

  // Vertical lines
  for (let x = 0; x <= size; x++) {
    points.push(new THREE.Vector3(x, 0.01, 0));
    points.push(new THREE.Vector3(x, 0.01, size));
  }
  // Horizontal lines
  for (let z = 0; z <= size; z++) {
    points.push(new THREE.Vector3(0, 0.01, z));
    points.push(new THREE.Vector3(size, 0.01, z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x3a5a3a,
    transparent: true,
    opacity: 0.3,
  });

  return new THREE.LineSegments(geometry, material);
}
