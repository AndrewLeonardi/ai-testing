// Scenario builder: creates grid layouts and spawns entities.
// Curriculum: start simple, add complexity as the agent masters each level.
// Mine positions are RANDOMIZED each episode to force generalization, not memorization.

import { Grid, SIZE, CELL_WALL, CELL_BUILDING, CELL_SHIELD, CELL_MINE, CELL_EMPTY, DIR_N } from './Grid.js';
import { Soldier } from './Soldier.js';
import { Building, BUILDING_TYPES } from './Building.js';
import { resetEntityIds } from './Entity.js';

// --- Level Registry ---
// Each level teaches a new equipment type. Skills must TRANSFER to unknown layouts.
export const LEVELS = [
  { id: 1, name: 'Mines',            factory: createLevel1, maxSteps: 200, equipment: ['MINE'] },
  { id: 2, name: 'Cannons + Shield', factory: createLevel2, maxSteps: 500, equipment: ['MINE', 'CANNON', 'SHIELD'] },
  { id: 3, name: 'Walls',            factory: createLevel3, maxSteps: 400, equipment: ['MINE', 'CANNON', 'SHIELD', 'WALL'] },
  { id: 4, name: 'Mine Walls',       factory: createLevel4, maxSteps: 400, equipment: ['MINE', 'CANNON', 'SHIELD', 'WALL'] },
  { id: 5, name: 'Squad Basics',     factory: createLevel5, maxSteps: 600, equipment: ['MINE', 'CANNON', 'SHIELD'] },
  { id: 6, name: 'Full Squad',       factory: createLevel6, maxSteps: 600, equipment: ['MINE', 'CANNON', 'SHIELD', 'WALL'] },
];

// --- Mine Randomization ---
// Places mines randomly within a corridor, guaranteeing:
// - At least 2 on the direct path (column centerX)
// - At least 1 on each side of center
// - All within the specified band
function randomizeMines(grid, count, centerX, yMin, yMax, xMin, xMax) {
  const positions = [];
  const used = new Set();
  const key = (x, y) => `${x},${y}`;

  function placeOne(x, y) {
    const k = key(x, y);
    if (used.has(k)) return false;
    if (grid.getCell(x, y) !== CELL_EMPTY) return false;
    used.add(k);
    positions.push([x, y]);
    grid.setCell(x, y, CELL_MINE);
    return true;
  }

  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  // Guarantee: 2 mines on the direct path (x = centerX)
  let placed = 0;
  while (placed < 2) {
    const y = randInt(yMin, yMax);
    if (placeOne(centerX, y)) placed++;
  }

  // Guarantee: 1 mine left of center
  while (positions.filter(([x]) => x < centerX).length < 1) {
    const x = randInt(xMin, centerX - 1);
    const y = randInt(yMin, yMax);
    placeOne(x, y);
  }

  // Guarantee: 1 mine right of center
  while (positions.filter(([x]) => x > centerX).length < 1) {
    const x = randInt(centerX + 1, xMax);
    const y = randInt(yMin, yMax);
    placeOne(x, y);
  }

  // Fill remaining mines randomly in the band
  let attempts = 0;
  while (positions.length < count && attempts < 200) {
    const x = randInt(xMin, xMax);
    const y = randInt(yMin, yMax);
    placeOne(x, y);
    attempts++;
  }

  return positions;
}

// --- Level 1: Mines only ---
// Soldier must learn: navigate to HQ while avoiding RANDOMIZED mine positions.
export function createLevel1() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ closer — shorter episode, faster learning
  const hq = new Building(16, 18, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 18, CELL_BUILDING);

  // Randomized mines in the approach corridor
  // Band: y=6 to y=16, x=12 to x=20 (centered on the direct path)
  randomizeMines(grid, 6, 16, 6, 16, 12, 20);

  // Soldier at (16, 2) facing north
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// --- Level 2: Mines + Cannons + Shield ---
// Soldier must learn: avoid randomized mines → destroy cannons → shield drops → destroy HQ.
export function createLevel2() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ at (16, 24)
  const hq = new Building(16, 24, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 24, CELL_BUILDING);

  // Cannons (fixed positions — cannon combat is a separate skill to isolate)
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

  // Randomized mines in approach corridor (before cannon line)
  // Band: y=6 to y=16, x=12 to x=20
  randomizeMines(grid, 7, 16, 6, 16, 12, 20);

  // Soldier at (16, 2)
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// --- Level 3: Mines + Cannons + Shield + Walls ---
// Soldier must learn: pathfind around walls while avoiding mines and engaging cannons.
export function createLevel3() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ at (16, 26) — pushed back to make room for walls
  const hq = new Building(16, 26, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 26, CELL_BUILDING);

  // Cannons behind walls
  const cannon1 = new Building(16, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon1);
  grid.setCell(16, 20, CELL_BUILDING);

  const cannon2 = new Building(13, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon2);
  grid.setCell(13, 20, CELL_BUILDING);

  // Shield line at y=22
  for (let x = 9; x <= 23; x++) {
    grid.setCell(x, 22, CELL_SHIELD);
  }

  // Wall row 1 at y=8 — gap position randomized (2-tile gap)
  const gap1 = 12 + Math.floor(Math.random() * 6); // gap at x=12..17
  for (let x = 10; x <= 22; x++) {
    if (x >= gap1 && x <= gap1 + 1) continue; // gap
    grid.setCell(x, 8, CELL_WALL);
  }

  // Wall row 2 at y=14 — gap on opposite side of row 1 to force zigzag
  const gap2Side = (gap1 <= 14) ? 17 + Math.floor(Math.random() * 3) : 11 + Math.floor(Math.random() * 3);
  for (let x = 10; x <= 22; x++) {
    if (x >= gap2Side && x <= gap2Side + 1) continue; // gap
    grid.setCell(x, 14, CELL_WALL);
  }

  // Randomized mines between walls and in approach
  // Band: y=4 to y=18, x=10 to x=22 (wider area with walls)
  randomizeMines(grid, 8, 16, 4, 18, 10, 22);

  // Soldier at (16, 2)
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// --- Level 4: Mine Walls ---
// Fixes the "always go right" problem. A dense mine wall blocks either the LEFT or RIGHT
// side randomly each episode, forcing the soldier to learn BOTH directions.
// Also includes walls + cannons + shield from Level 3.
export function createLevel4() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ at (16, 26)
  const hq = new Building(16, 26, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 26, CELL_BUILDING);

  // Cannons
  const cannon1 = new Building(16, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon1);
  grid.setCell(16, 20, CELL_BUILDING);

  const cannon2 = new Building(13, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon2);
  grid.setCell(13, 20, CELL_BUILDING);

  // Shield line at y=22
  for (let x = 9; x <= 23; x++) {
    grid.setCell(x, 22, CELL_SHIELD);
  }

  // Wall row at y=10 with randomized gap
  const wallGap = 12 + Math.floor(Math.random() * 6);
  for (let x = 10; x <= 22; x++) {
    if (x >= wallGap && x <= wallGap + 1) continue;
    grid.setCell(x, 10, CELL_WALL);
  }

  // THE KEY: Dense mine wall blocking one side
  // Randomly choose LEFT or RIGHT side to block
  const blockLeft = Math.random() < 0.5;

  if (blockLeft) {
    // Mine wall on the ENTIRE left side (x=0-15, y=4-8) — soldier MUST go right
    for (let y = 4; y <= 8; y++) {
      for (let x = 0; x <= 15; x++) {
        if (grid.getCell(x, y) === CELL_EMPTY) {
          grid.setCell(x, y, CELL_MINE);
        }
      }
    }
    // Leave right side open with a few scattered mines
    randomizeMines(grid, 3, 19, 4, 8, 17, 22);
  } else {
    // Mine wall on the ENTIRE right side (x=17-31, y=4-8) — soldier MUST go left
    for (let y = 4; y <= 8; y++) {
      for (let x = 17; x <= 31; x++) {
        if (grid.getCell(x, y) === CELL_EMPTY) {
          grid.setCell(x, y, CELL_MINE);
        }
      }
    }
    // Leave left side open with a few scattered mines
    randomizeMines(grid, 3, 13, 4, 8, 10, 15);
  }

  // A few mines in the mid-zone between wall and cannons
  randomizeMines(grid, 4, 16, 12, 18, 10, 22);

  // Soldier at (16, 2)
  const soldier = new Soldier(16, 2, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// --- Level 5: Squad Basics (2 soldiers) ---
// First multi-agent level. Level 2 difficulty (mines + cannons + shield) but with
// 2 soldiers spread apart. Isolates the new variable: coordination.
export function createLevel5() {
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

  // Randomized mines in approach corridor
  randomizeMines(grid, 7, 16, 6, 16, 12, 20);

  // TWO soldiers spread apart — different egocentric views from the start
  const s1 = new Soldier(14, 2, 0, DIR_N);
  const s2 = new Soldier(18, 2, 0, DIR_N);
  soldiers.push(s1, s2);
  grid.placeSoldier(s1.id, s1.x, s1.y);
  grid.placeSoldier(s2.id, s2.x, s2.y);

  return { grid, soldiers, buildings, hq };
}

// --- Level 6: Full Squad (3 soldiers) ---
// 3 soldiers against dense defenses: walls + mines + 3 cannons + shield.
// Tests full squad coordination under pressure.
export function createLevel6() {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // HQ at (16, 26)
  const hq = new Building(16, 26, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(16, 26, CELL_BUILDING);

  // 3 cannons — spread out to force multi-directional assault
  const cannon1 = new Building(16, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon1);
  grid.setCell(16, 20, CELL_BUILDING);

  const cannon2 = new Building(12, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon2);
  grid.setCell(12, 20, CELL_BUILDING);

  const cannon3 = new Building(20, 20, BUILDING_TYPES.CANNON);
  buildings.push(cannon3);
  grid.setCell(20, 20, CELL_BUILDING);

  // Shield line at y=22
  for (let x = 8; x <= 24; x++) {
    grid.setCell(x, 22, CELL_SHIELD);
  }

  // Wall row at y=10 with randomized gap
  const wallGap = 12 + Math.floor(Math.random() * 6);
  for (let x = 10; x <= 22; x++) {
    if (x >= wallGap && x <= wallGap + 1) continue;
    grid.setCell(x, 10, CELL_WALL);
  }

  // Wall row at y=16 — gap on opposite side to force zigzag
  const gap2Side = (wallGap <= 14) ? 17 + Math.floor(Math.random() * 3) : 11 + Math.floor(Math.random() * 3);
  for (let x = 10; x <= 22; x++) {
    if (x >= gap2Side && x <= gap2Side + 1) continue;
    grid.setCell(x, 16, CELL_WALL);
  }

  // Dense mines — 10+ across the approach
  randomizeMines(grid, 10, 16, 4, 18, 10, 22);

  // THREE soldiers spread wide
  const s1 = new Soldier(12, 2, 0, DIR_N);
  const s2 = new Soldier(16, 2, 0, DIR_N);
  const s3 = new Soldier(20, 2, 0, DIR_N);
  soldiers.push(s1, s2, s3);
  grid.placeSoldier(s1.id, s1.x, s1.y);
  grid.placeSoldier(s2.id, s2.x, s2.y);
  grid.placeSoldier(s3.id, s3.x, s3.y);

  return { grid, soldiers, buildings, hq };
}

// Create scenario from a player-designed base layout (for base editor)
export function createFromLayout(layout) {
  resetEntityIds();
  const grid = new Grid();
  const soldiers = [];
  const buildings = [];

  // Place HQ
  const hq = new Building(layout.hq.x, layout.hq.y, BUILDING_TYPES.HQ);
  buildings.push(hq);
  grid.setCell(layout.hq.x, layout.hq.y, CELL_BUILDING);

  // Place buildings
  if (layout.cannons) {
    for (const c of layout.cannons) {
      const cannon = new Building(c.x, c.y, BUILDING_TYPES.CANNON);
      buildings.push(cannon);
      grid.setCell(c.x, c.y, CELL_BUILDING);
    }
  }

  // Place walls
  if (layout.walls) {
    for (const [wx, wy] of layout.walls) {
      grid.setCell(wx, wy, CELL_WALL);
    }
  }

  // Place mines
  if (layout.mines) {
    for (const [mx, my] of layout.mines) {
      grid.setCell(mx, my, CELL_MINE);
    }
  }

  // Place shield line
  if (layout.shield) {
    for (const [sx, sy] of layout.shield) {
      grid.setCell(sx, sy, CELL_SHIELD);
    }
  }

  // Soldier at spawn
  const spawnX = layout.spawn ? layout.spawn.x : 16;
  const spawnY = layout.spawn ? layout.spawn.y : 2;
  const soldier = new Soldier(spawnX, spawnY, 0, DIR_N);
  soldiers.push(soldier);
  grid.placeSoldier(soldier.id, soldier.x, soldier.y);

  return { grid, soldiers, buildings, hq };
}

// Get the HQ from a building list
export function getHQ(buildings) {
  return buildings.find(b => b.buildingType === BUILDING_TYPES.HQ);
}
