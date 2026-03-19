// Soldier entity with movement, shooting, ducking.
// 8 actions: MOVE_FWD, MOVE_BACK, TURN_L, TURN_R, SHOOT, DUCK, STAND, STAY

import { Entity } from './Entity.js';
import { DX, DY, DIR_N } from './Grid.js';
import { BALANCE } from '../game/Balance.js';

export const ACTIONS = {
  MOVE_FWD: 0,
  MOVE_BACK: 1,
  TURN_L: 2,
  TURN_R: 3,
  SHOOT: 4,
  DUCK: 5,
  STAND: 6,
  STAY: 7,
};

export const ACTION_NAMES = [
  'MOVE_FWD', 'MOVE_BACK', 'TURN_L', 'TURN_R',
  'SHOOT', 'DUCK', 'STAND', 'STAY'
];

export const NUM_ACTIONS = 8;

export class Soldier extends Entity {
  // classStats: optional { hpMultiplier, damageMultiplier } from Balance.SOLDIER_CLASSES
  constructor(x, y, team, facing = DIR_N, classStats = null) {
    const hpMult = classStats ? classStats.hpMultiplier : 1.0;
    const dmgMult = classStats ? classStats.damageMultiplier : 1.0;
    const hp = Math.round(BALANCE.SOLDIER.hp * hpMult);
    super(x, y, hp, team);
    this.facing = facing;
    this.ducking = false;
    this.shootCooldown = 0;
    this.maxShootCooldown = BALANCE.SOLDIER.shootCooldown;
    this.ammo = BALANCE.SOLDIER.ammo;
    this.maxAmmo = BALANCE.SOLDIER.ammo;
    this.damage = Math.round(BALANCE.SOLDIER.damage * dmgMult);
    this.range = BALANCE.SOLDIER.range;
    this.lastAction = -1;
    this.damageDealtThisStep = 0;
    this.damageTakenThisStep = 0;
    this.shotHitThisStep = false;
    this.shotMissedThisStep = false;
    this.killedByMine = false;
  }

  resetStepTracking() {
    this.damageDealtThisStep = 0;
    this.damageTakenThisStep = 0;
    this.shotHitThisStep = false;
    this.shotMissedThisStep = false;
  }

  executeAction(actionIdx, grid) {
    this.lastAction = actionIdx;

    switch (actionIdx) {
      case ACTIONS.MOVE_FWD: return this._move(grid, 1);
      case ACTIONS.MOVE_BACK: return this._move(grid, -1);
      case ACTIONS.TURN_L:
        this.facing = (this.facing + 3) % 4; // CCW
        return true;
      case ACTIONS.TURN_R:
        this.facing = (this.facing + 1) % 4; // CW
        return true;
      case ACTIONS.SHOOT:
        return this._tryShoot();
      case ACTIONS.DUCK:
        this.ducking = true;
        return true;
      case ACTIONS.STAND:
        this.ducking = false;
        return true;
      case ACTIONS.STAY:
        return true;
    }
    return false;
  }

  _move(grid, direction) {
    if (this.ducking) this.ducking = false; // stand up to move
    const dx = DX[this.facing] * direction;
    const dy = DY[this.facing] * direction;
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (grid.isPassable(nx, ny)) {
      grid.moveSoldier(this.id, this.x, this.y, nx, ny);
      this.x = nx;
      this.y = ny;
      return true;
    }
    return false; // blocked
  }

  _tryShoot() {
    if (this.shootCooldown > 0) return false;
    if (this.ammo <= 0) return false;
    this.ammo--;
    this.shootCooldown = this.maxShootCooldown;
    // Actual damage resolution handled in Combat.js
    return true;
  }

  tickCooldowns() {
    if (this.shootCooldown > 0) this.shootCooldown--;
  }

  takeDamage(amount) {
    const actual = this.ducking ? amount * BALANCE.SOLDIER.duckDamageReduction : amount;
    this.damageTakenThisStep += actual;
    return super.takeDamage(actual);
  }
}
