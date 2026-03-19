// Building entity: HQ, Cannon, Wall.
// Cannons use stochastic targeting (weighted by proximity).

import { Entity } from './Entity.js';
import { Grid } from './Grid.js';
import { BALANCE } from '../game/Balance.js';

export const BUILDING_TYPES = {
  HQ: 'HQ',
  CANNON: 'CANNON',
  WALL: 'WALL',
  SHIELD_GENERATOR: 'SHIELD_GENERATOR',
};

export class Building extends Entity {
  constructor(x, y, type) {
    const hpMap = {
      HQ: BALANCE.BUILDINGS.HQ.hp,
      CANNON: BALANCE.BUILDINGS.CANNON.hp,
      WALL: BALANCE.BUILDINGS.WALL.hp,
      SHIELD_GENERATOR: 1, // marker entity, no real HP (shield mechanic is grid-based)
    };
    const hp = hpMap[type];
    if (hp === undefined) throw new Error(`Unknown building type: ${type}`);
    super(x, y, hp, 1); // team 1 = defender
    this.buildingType = type;
    this.range = type === BUILDING_TYPES.CANNON ? BALANCE.BUILDINGS.CANNON.range : 0;
    this.damage = type === BUILDING_TYPES.CANNON ? BALANCE.BUILDINGS.CANNON.damage : 0;
    this.fireRate = BALANCE.BUILDINGS.CANNON.fireRate; // ticks between shots
    this.fireCooldown = 0;
    this.currentTarget = null;
    this.firedThisStep = false;
  }

  // Cannon AI: pick a target and shoot
  tick(grid, soldiers) {
    this.firedThisStep = false;
    if (this.buildingType !== BUILDING_TYPES.CANNON) return null;
    if (!this.alive) return null;

    if (this.fireCooldown > 0) {
      this.fireCooldown--;
      return null;
    }

    // Find all visible enemy soldiers in range
    const targets = [];
    for (const s of soldiers) {
      if (!s.alive || s.team === this.team) continue;
      const dist = Grid.euclidean(this.x, this.y, s.x, s.y);
      if (dist <= this.range && grid.lineOfSight(this.x, this.y, s.x, s.y)) {
        targets.push({ soldier: s, dist });
      }
    }

    if (targets.length === 0) return null;

    // Stochastic targeting: weight by inverse distance (closer = more likely)
    const weights = targets.map(t => 1 / (t.dist + 0.5));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    let chosen = targets[0].soldier;
    for (let i = 0; i < targets.length; i++) {
      r -= weights[i];
      if (r <= 0) { chosen = targets[i].soldier; break; }
    }

    // Fire!
    this.fireCooldown = this.fireRate;
    this.currentTarget = chosen;
    this.firedThisStep = true;
    chosen.takeDamage(this.damage);
    return chosen;
  }
}
