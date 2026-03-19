// Scenario builder: creates grid layouts and spawns entities.
// Curriculum: start simple, add complexity as the agent masters each level.

import { Grid, CELL_WALL, CELL_BUILDING, CELL_SHIELD, CELL_MINE, DIR_N } from './Grid.js';
import { Soldier } from './Soldier.js';
import { Building, BUILDING_TYPES } from './Building.js';
import { resetEntityIds } from './Entity.js';

// Level 1: Mines only. No cannons, no shield.
// Soldier must learn: navigate to HQ while avoiding mines.
export function createLevel1() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ closer — shorter episode, faster learning
  const hq = new Building(16, 18, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 18, CELL_BUILDING);

  // Mines in the direct path — soldier MUST deviate to survive
  const minePositions = [
    [16, 8],  // directly in path
    [16, 12], // directly in path again
    [15, 10], // slightly left
    [17, 10], // slightly right
    [15, 14], // left approach
    [17, 14], // right approach
  ];
  for (const [mx, my] of minePositions) {
    grid.setCell(mx, my, CELL_MINE);
  }

  // Soldier at (16, 2) facing north
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// Level 2: Full scenario — mines + cannons + shield.
// Soldier must learn: avoid mines → destroy cannons → shield drops → destroy HQ.
export function createLevel2() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ at (16, 24)
  const hq = new Building(16, 24, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 24, CELL_BUILDING);

  // Cannons
  const cannon1 = new Building(16, 18, BUILDING_TYPES.CANNON);
  buildings.push(cannon1);
  grid.setCell(16, 18, CELL_BUILDING);

  const cannon2 = new Building(14, 18, BUILDING_TYPES.CANNON);
  buildings.push(cannon2);
  grid.setCell(14, 18, CELL_BUILDING);

  // Shield line at y=20
  for (let x = 10; x <= 22; x++) {
    grid.setCell(x, 20, CELL_SHIELD);
  }

  // Mines in approach path
  const minePositions = [
    [16, 10],
    [15, 12],
    [17, 11],
    [14, 14],
    [16, 14],
    [13, 10],
    [18, 13],
  ];
  for (const [mx, my] of minePositions) {
    grid.setCell(mx, my, CELL_MINE);
  }

  // Soldier at (16, 2)
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// Default scenario — currently Level 1 for curriculum training
export function createMVPScenario() {
  return createLevel1();
}

// Get the HQ from a building list
export function getHQ(buildings) {
  return buildings.find(b => b.buildingType === BUILDING_TYPES.HQ);
}
