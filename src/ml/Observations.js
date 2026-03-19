// Build the 139-dimensional observation vector for a soldier.
// 125 from egocentric 5x5 grid (5 channels) + 14 scalar features.

import { Grid } from '../sim/Grid.js';
import { BUILDING_TYPES } from '../sim/Building.js';

export const OBS_SIZE = 139;

export function buildObservation(soldier, grid, soldiers, buildings, hq, shieldActive = true) {
  // 1. Egocentric 5x5 grid view (5 channels = 125 floats)
  const gridView = grid.getEgocentricView(
    soldier.x, soldier.y, soldier.facing, soldiers, buildings
  );

  // 2. Scalar features (14 floats)
  const scalars = new Float32Array(14);
  const maxDist = Math.sqrt(32 * 32 + 32 * 32);
  const facingAngle = (1 - soldier.facing) * Math.PI / 2;

  // HP normalized
  scalars[0] = soldier.hp / soldier.maxHp;

  // Ammo normalized
  scalars[1] = soldier.ammo / soldier.maxAmmo;

  // Ducking
  scalars[2] = soldier.ducking ? 1.0 : 0.0;

  // Facing encoded as sin/cos for continuity
  scalars[3] = Math.sin(soldier.facing * Math.PI / 2);
  scalars[4] = Math.cos(soldier.facing * Math.PI / 2);

  // Distance to HQ (normalized by grid diagonal)
  if (hq && hq.alive) {
    scalars[5] = Grid.euclidean(soldier.x, soldier.y, hq.x, hq.y) / maxDist;
  } else {
    scalars[5] = 0;
  }

  // Relative angle to HQ (sin/cos) - compass toward the goal
  if (hq && hq.alive) {
    const dx = hq.x - soldier.x;
    const dy = hq.y - soldier.y;
    const worldAngle = Math.atan2(dy, dx);
    const relAngle = worldAngle - facingAngle;
    scalars[6] = Math.sin(relAngle);
    scalars[7] = Math.cos(relAngle);
  } else {
    scalars[6] = 0;
    scalars[7] = 0;
  }

  // Shield active (1 = up, 0 = down) - tells agent it must destroy cannons first
  scalars[8] = shieldActive ? 1.0 : 0.0;

  // Nearest alive cannon: distance + relative angle
  let nearestCannonDist = maxDist;
  let nearestCannon = null;
  for (const b of buildings) {
    if (b.alive && b.buildingType === BUILDING_TYPES.CANNON) {
      const d = Grid.euclidean(soldier.x, soldier.y, b.x, b.y);
      if (d < nearestCannonDist) {
        nearestCannonDist = d;
        nearestCannon = b;
      }
    }
  }
  scalars[9] = nearestCannonDist / maxDist;

  if (nearestCannon) {
    const dx = nearestCannon.x - soldier.x;
    const dy = nearestCannon.y - soldier.y;
    const worldAngle = Math.atan2(dy, dx);
    const relAngle = worldAngle - facingAngle;
    scalars[10] = Math.sin(relAngle);
    scalars[11] = Math.cos(relAngle);
  } else {
    scalars[10] = 0;
    scalars[11] = 0;
  }

  // Number of cannons alive (normalized)
  const totalCannons = buildings.filter(b => b.buildingType === BUILDING_TYPES.CANNON).length;
  const aliveCannons = buildings.filter(b => b.buildingType === BUILDING_TYPES.CANNON && b.alive).length;
  scalars[12] = totalCannons > 0 ? aliveCannons / totalCannons : 0;

  // Shoot cooldown (normalized) - helps agent time shots
  scalars[13] = soldier.shootCooldown / soldier.maxShootCooldown;

  // Concatenate into single observation
  const obs = new Float32Array(OBS_SIZE);
  obs.set(gridView, 0);
  obs.set(scalars, 125);
  return obs;
}
