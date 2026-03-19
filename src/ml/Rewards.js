// Layered reward shaping for soldier training.
// Two-phase: destroy cannons (shield up) → destroy HQ (shield down).

import { Grid, CELL_MINE } from '../sim/Grid.js';
import { hasTargetInLine } from '../sim/Combat.js';
import { ACTIONS } from '../sim/Soldier.js';
import { BUILDING_TYPES } from '../sim/Building.js';

export function computeReward(soldier, prevState, grid, buildings, soldiers, hq, episodeDone, won, shieldActive) {
  let reward = 0;

  // --- Survival ---
  reward -= 0.01;

  // --- Idle penalty ---
  const idleActions = [ACTIONS.DUCK, ACTIONS.STAND, ACTIONS.STAY];
  if (idleActions.includes(soldier.lastAction)) {
    reward -= 0.02;
  }

  // --- Combat rewards ---
  if (soldier.damageDealtThisStep > 0) {
    reward += soldier.damageDealtThisStep * 0.1;
  }

  // Extra bonus for killing blow on HQ
  if (hq && !hq.alive && soldier.damageDealtThisStep > 0) {
    reward += 1.0;
  }

  // Damage taken
  if (soldier.damageTakenThisStep > 0) {
    reward -= soldier.damageTakenThisStep * 0.03;
  }

  // --- Shooting accuracy ---
  if (soldier.lastAction === ACTIONS.SHOOT && soldier.shotMissedThisStep) {
    reward -= 0.05;
  }
  if (soldier.shotHitThisStep) {
    reward += 0.5;
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
        reward += (prevDist - currDist) * 0.5;
      }
    } else {
      // Phase 2: Shield is down → move toward HQ
      if (hq && hq.alive) {
        const prevDist = Grid.euclidean(prevState.x, prevState.y, hq.x, hq.y);
        const currDist = Grid.euclidean(soldier.x, soldier.y, hq.x, hq.y);
        reward += (prevDist - currDist) * 0.5;
      }
    }
  }

  // --- Mine proximity penalty ---
  // Small penalty for moving TOWARD a mine (uses mine compass data)
  if (prevState) {
    const nearestMine = grid.findNearestMine(soldier.x, soldier.y);
    if (nearestMine && nearestMine.dist < 5) {
      const prevMine = grid.findNearestMine(prevState.x, prevState.y);
      if (prevMine) {
        const approachDelta = prevMine.dist - nearestMine.dist;
        if (approachDelta > 0) {
          // Moving toward a mine within danger range — penalize
          reward -= approachDelta * 0.3;
        }
      }
    }
  }

  // --- Cannon destruction bonus ---
  for (const b of buildings) {
    if (b.buildingType === BUILDING_TYPES.CANNON && b.destroyedThisStep) {
      reward += 5.0; // big bonus for destroying a cannon
    }
  }

  // --- Terminal rewards ---
  if (episodeDone) {
    if (won) {
      reward += 20.0;
    } else if (!soldier.alive) {
      if (soldier.killedByMine) {
        reward -= 5.0; // stronger signal: mines are avoidable, learn to dodge them
      } else {
        reward -= 3.0;
      }
    } else {
      reward -= 2.0;
    }
  }

  return reward;
}
