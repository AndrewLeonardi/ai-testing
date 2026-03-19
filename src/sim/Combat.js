// Combat resolution: soldier shooting, damage calculation, hit detection.

import { Grid, DX, DY } from './Grid.js';
import { ACTIONS } from './Soldier.js';

// Resolve a soldier's shot. Ray-cast in facing direction, hit first entity.
export function resolveShot(soldier, grid, buildings, soldiers) {
  if (soldier.lastAction !== ACTIONS.SHOOT) return null;
  if (soldier.shootCooldown < soldier.maxShootCooldown) return null; // only resolve if shot was just fired this tick

  const dx = DX[soldier.facing];
  const dy = DY[soldier.facing];
  let cx = soldier.x + dx;
  let cy = soldier.y + dy;

  for (let step = 0; step < soldier.range; step++) {
    if (!grid.inBounds(cx, cy)) break;
    const cell = grid.getCell(cx, cy);

    // Check if we hit a wall or shield (blocks shot)
    if (cell === 1 || cell === 3) break; // CELL_WALL or CELL_SHIELD

    // Check buildings at this position
    for (const b of buildings) {
      if (b.alive && b.x === cx && b.y === cy) {
        b.takeDamage(soldier.damage);
        soldier.damageDealtThisStep += soldier.damage;
        soldier.shotHitThisStep = true;
        return { type: 'building', target: b, x: cx, y: cy };
      }
    }

    // Check soldiers at this position (enemy only)
    for (const s of soldiers) {
      if (s.alive && s.id !== soldier.id && s.team !== soldier.team && s.x === cx && s.y === cy) {
        s.takeDamage(soldier.damage);
        soldier.damageDealtThisStep += soldier.damage;
        soldier.shotHitThisStep = true;
        return { type: 'soldier', target: s, x: cx, y: cy };
      }
    }

    cx += dx;
    cy += dy;
  }

  // Shot missed - nothing in range along this ray
  soldier.shotMissedThisStep = true;
  return null;
}

// Check if soldier has any target in firing line (for reward computation)
export function hasTargetInLine(soldier, grid, buildings, soldiers) {
  const dx = DX[soldier.facing];
  const dy = DY[soldier.facing];
  let cx = soldier.x + dx;
  let cy = soldier.y + dy;

  for (let step = 0; step < soldier.range; step++) {
    if (!grid.inBounds(cx, cy)) break;
    const c = grid.getCell(cx, cy);
    if (c === 1 || c === 3) break; // wall or shield blocks

    for (const b of buildings) {
      if (b.alive && b.x === cx && b.y === cy) return true;
    }
    for (const s of soldiers) {
      if (s.alive && s.id !== soldier.id && s.team !== soldier.team && s.x === cx && s.y === cy) return true;
    }

    cx += dx;
    cy += dy;
  }
  return false;
}
