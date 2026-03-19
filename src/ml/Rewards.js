// Layered reward shaping for soldier training.
// Two-phase: destroy cannons (shield up) → destroy HQ (shield down).
// All constants pulled from Balance.js — single source of truth.

import { Grid, CELL_MINE } from '../sim/Grid.js';
import { hasTargetInLine } from '../sim/Combat.js';
import { ACTIONS } from '../sim/Soldier.js';
import { BUILDING_TYPES } from '../sim/Building.js';
import { BALANCE } from '../game/Balance.js';

const R = BALANCE.REWARDS;

export function computeReward(soldier, prevState, grid, buildings, soldiers, hq, episodeDone, won, shieldActive) {
  let reward = 0;

  // --- Survival ---
  reward += R.survivalTick;

  // --- Idle penalty ---
  const idleActions = [ACTIONS.DUCK, ACTIONS.STAND, ACTIONS.STAY];
  if (idleActions.includes(soldier.lastAction)) {
    reward += R.idlePenalty;
  }

  // --- Combat rewards ---
  if (soldier.damageDealtThisStep > 0) {
    reward += soldier.damageDealtThisStep * R.damageDealtMultiplier;
  }

  // Extra bonus for killing blow on HQ
  if (hq && !hq.alive && soldier.damageDealtThisStep > 0) {
    reward += R.hqKillBonus;
  }

  // Damage taken
  if (soldier.damageTakenThisStep > 0) {
    reward += soldier.damageTakenThisStep * R.damageTakenMultiplier;
  }

  // --- Shooting accuracy ---
  if (soldier.lastAction === ACTIONS.SHOOT && soldier.shotMissedThisStep) {
    reward += R.shotMissedPenalty;
  }
  if (soldier.shotHitThisStep) {
    reward += R.shotHitBonus;
  }

  // --- Phase-dependent distance reward ---
  if (prevState) {
    if (shieldActive) {
      // Phase 1: Shield is up → move toward nearest alive cannon
      let nearestCannon = null;
      let nearestDist = Infinity;
      for (const b of buildings) {
        if (b.alive && b.buildingType === BUILDING_TYPES.CANNON) {
          const d = Grid.euclidean(soldier.x, soldier.y, b.x, b.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestCannon = b;
          }
        }
      }
      if (nearestCannon) {
        const prevDist = Grid.euclidean(prevState.x, prevState.y, nearestCannon.x, nearestCannon.y);
        const currDist = Grid.euclidean(soldier.x, soldier.y, nearestCannon.x, nearestCannon.y);
        reward += (prevDist - currDist) * R.distanceApproachMultiplier;
      }
    } else {
      // Phase 2: Shield is down → move toward HQ
      if (hq && hq.alive) {
        const prevDist = Grid.euclidean(prevState.x, prevState.y, hq.x, hq.y);
        const currDist = Grid.euclidean(soldier.x, soldier.y, hq.x, hq.y);
        reward += (prevDist - currDist) * R.distanceApproachMultiplier;
      }
    }
  }

  // --- Mine proximity penalty ---
  if (prevState) {
    const nearestMine = grid.findNearestMine(soldier.x, soldier.y);
    if (nearestMine && nearestMine.dist < R.mineProximityThreshold) {
      const prevMine = grid.findNearestMine(prevState.x, prevState.y);
      if (prevMine) {
        const approachDelta = prevMine.dist - nearestMine.dist;
        if (approachDelta > 0) {
          reward += approachDelta * R.mineApproachPenalty;
        }
      }
    }
  }

  // --- Cannon destruction bonus ---
  for (const b of buildings) {
    if (b.buildingType === BUILDING_TYPES.CANNON && b.destroyedThisStep) {
      reward += R.cannonDestroyedBonus;
    }
  }

  // --- Terminal rewards ---
  if (episodeDone) {
    if (won) {
      reward += R.winReward;
    } else if (!soldier.alive) {
      if (soldier.killedByMine) {
        reward += R.mineDeathPenalty;
      } else {
        reward += R.killedPenalty;
      }
    } else {
      reward += R.timeoutPenalty;
    }
  }

  return reward;
}
