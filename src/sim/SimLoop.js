// Episode management and tick loop.
// Runs the simulation at 10Hz conceptually, but can be advanced manually.

import { resolveShot } from './Combat.js';
import { ACTIONS } from './Soldier.js';
import { BUILDING_TYPES } from './Building.js';
import { CELL_EMPTY, CELL_SHIELD, CELL_MINE } from './Grid.js';

export class SimLoop {
  constructor(grid, soldiers, buildings, hq) {
    this.grid = grid;
    this.soldiers = soldiers;
    this.buildings = buildings;
    this.hq = hq;
    this.step = 0;
    const hasCannons = buildings.some(b => b.buildingType === BUILDING_TYPES.CANNON);
    this.maxSteps = hasCannons ? 500 : 200; // shorter episodes for simpler scenarios
    this.done = false;
    this.won = false;
    this.shieldActive = hasCannons;
    this.events = []; // per-tick events for visualization
  }

  // Execute one simulation tick. Actions should already be set on soldiers.
  tick(actions) {
    if (this.done) return;
    this.step++;
    this.events = [];

    // 1. Reset per-step tracking
    for (const s of this.soldiers) {
      s.resetStepTracking();
    }
    for (const b of this.buildings) {
      b.destroyedThisStep = false;
    }

    // 2. Execute soldier actions
    for (let i = 0; i < this.soldiers.length; i++) {
      const s = this.soldiers[i];
      if (!s.alive) continue;
      s.executeAction(actions[i], this.grid);
    }

    // 2.5. Check mine triggers (soldier stepped on a mine)
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      if (this.grid.getCell(s.x, s.y) === CELL_MINE) {
        const mineDamage = 999; // instant kill — forces real avoidance, no tanking
        s.takeDamage(mineDamage);
        this.grid.setCell(s.x, s.y, CELL_EMPTY);
        this.events.push({ type: 'mine_explode', x: s.x, y: s.y, target: s });
      }
    }

    // 3. Resolve soldier shots
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      if (s.lastAction === ACTIONS.SHOOT) {
        const hit = resolveShot(s, this.grid, this.buildings, this.soldiers);
        if (hit) {
          this.events.push({
            type: 'shot_hit',
            shooter: s,
            target: hit.target,
            tx: hit.x, ty: hit.y,
          });
        } else {
          this.events.push({ type: 'shot_miss', shooter: s });
        }
      }
    }

    // 4. Cannon AI
    for (const b of this.buildings) {
      if (b.buildingType === BUILDING_TYPES.CANNON) {
        const target = b.tick(this.grid, this.soldiers);
        if (target) {
          this.events.push({
            type: 'cannon_fire',
            cannon: b,
            target,
          });
        }
      }
    }

    // 5. Tick cooldowns
    for (const s of this.soldiers) {
      if (s.alive) s.tickCooldowns();
    }

    // 6. Remove dead soldiers from grid
    for (const s of this.soldiers) {
      if (!s.alive) {
        this.grid.removeSoldier(s.x, s.y);
      }
    }

    // 7. Remove destroyed buildings from grid
    for (const b of this.buildings) {
      if (!b.alive && this.grid.getCell(b.x, b.y) !== 0) {
        this.grid.setCell(b.x, b.y, 0);
      }
    }

    // 7.5. Check if shield should drop (all cannons destroyed)
    if (this.shieldActive) {
      const cannonsAlive = this.buildings.some(
        b => b.buildingType === BUILDING_TYPES.CANNON && b.alive
      );
      if (!cannonsAlive) {
        this.shieldActive = false;
        // Remove all shield cells from grid
        for (let y = 0; y < 32; y++) {
          for (let x = 0; x < 32; x++) {
            if (this.grid.getCell(x, y) === CELL_SHIELD) {
              this.grid.setCell(x, y, 0);
            }
          }
        }
        this.events.push({ type: 'shield_down' });
      }
    }

    // 8. Check terminal conditions
    const allSoldiersDead = this.soldiers.filter(s => s.team === 0).every(s => !s.alive);
    const hqDestroyed = !this.hq.alive;

    if (hqDestroyed) {
      this.done = true;
      this.won = true;
    } else if (allSoldiersDead) {
      this.done = true;
      this.won = false;
    } else if (this.step >= this.maxSteps) {
      this.done = true;
      this.won = false;
    }
  }

  _getMinePositions() {
    const mines = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (this.grid.getCell(x, y) === CELL_MINE) {
          mines.push({ x, y });
        }
      }
    }
    return mines;
  }

  // Get snapshot of current state for rendering
  getState() {
    return {
      step: this.step,
      done: this.done,
      won: this.won,
      soldiers: this.soldiers.map(s => ({
        id: s.id, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp,
        facing: s.facing, ducking: s.ducking, alive: s.alive,
        team: s.team, lastAction: s.lastAction,
      })),
      buildings: this.buildings.map(b => ({
        id: b.id, x: b.x, y: b.y, hp: b.hp, maxHp: b.maxHp,
        alive: b.alive, buildingType: b.buildingType,
        firedThisStep: b.firedThisStep,
        currentTarget: b.currentTarget ? { x: b.currentTarget.x, y: b.currentTarget.y } : null,
      })),
      shieldActive: this.shieldActive,
      mines: this._getMinePositions(),
      events: this.events,
    };
  }
}
