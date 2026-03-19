// 32x32 grid world. Source of truth for positions, obstacles, LOS.

export const CELL_EMPTY = 0;
export const CELL_WALL = 1;
export const CELL_BUILDING = 2;
export const CELL_SHIELD = 3; // Force field - blocks movement & shots until cannons destroyed
export const CELL_MINE = 4;   // Hidden mine - damages soldier on step, then consumed

export const SIZE = 32;

// Facing directions: 0=N(+y), 1=E(+x), 2=S(-y), 3=W(-x)
export const DIR_N = 0, DIR_E = 1, DIR_S = 2, DIR_W = 3;
export const DX = [0, 1, 0, -1];
export const DY = [1, 0, -1, 0];

export class Grid {
  constructor() {
    this.cells = new Uint8Array(SIZE * SIZE);
    // Separate occupancy layer for soldiers (not baked into cells)
    this.soldierOccupancy = new Int8Array(SIZE * SIZE).fill(-1); // -1 = empty, else soldier id
  }

  inBounds(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
  }

  getCell(x, y) {
    return this.cells[y * SIZE + x];
  }

  setCell(x, y, type) {
    this.cells[y * SIZE + x] = type;
  }

  isPassable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const c = this.cells[y * SIZE + x];
    return (c === CELL_EMPTY || c === CELL_MINE) && this.soldierOccupancy[y * SIZE + x] === -1;
  }

  isPassableIgnoringSoldiers(x, y) {
    if (!this.inBounds(x, y)) return false;
    const c = this.cells[y * SIZE + x];
    return c === CELL_EMPTY || c === CELL_MINE;
  }

  placeSoldier(id, x, y) {
    this.soldierOccupancy[y * SIZE + x] = id;
  }

  removeSoldier(x, y) {
    this.soldierOccupancy[y * SIZE + x] = -1;
  }

  moveSoldier(id, fromX, fromY, toX, toY) {
    this.soldierOccupancy[fromY * SIZE + fromX] = -1;
    this.soldierOccupancy[toY * SIZE + toX] = id;
  }

  // Bresenham line-of-sight check. Returns true if no walls/buildings block.
  lineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    while (cx !== x1 || cy !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
      // Don't check the destination cell itself
      if (cx === x1 && cy === y1) break;
      if (!this.inBounds(cx, cy)) return false;
      const c = this.cells[cy * SIZE + cx];
      if (c === CELL_WALL || c === CELL_BUILDING) return false;
    }
    return true;
  }

  // Get egocentric 5x5 view centered on (cx, cy), rotated so facing is "up".
  // Returns 5 channels: [obstacles, enemies, allies, buildings, mines] = 125 floats
  getEgocentricView(cx, cy, facing, soldiers, buildings) {
    const view = new Float32Array(5 * 5 * 5); // 5 channels, 5x5
    const radius = 2;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Rotate (dx, dy) based on facing direction
        let wx, wy;
        switch (facing) {
          case DIR_N: wx = cx + dx; wy = cy + dy; break;
          case DIR_E: wx = cx + dy; wy = cy - dx; break;
          case DIR_S: wx = cx - dx; wy = cy - dy; break;
          case DIR_W: wx = cx - dy; wy = cy + dx; break;
        }

        const lx = dx + radius; // local x in 5x5 grid (0-4)
        const ly = dy + radius; // local y in 5x5 grid (0-4)
        const idx = ly * 5 + lx;

        if (!this.inBounds(wx, wy)) {
          view[idx] = 1.0; // Out of bounds = obstacle
          continue;
        }

        const cell = this.cells[wy * SIZE + wx];

        // Channel 0: Obstacles (walls, shields)
        if (cell === CELL_WALL || cell === CELL_SHIELD) view[idx] = 1.0;

        // Channel 1: Enemies (offset by 25)
        // Channel 2: Allies (offset by 50)
        // Filled below from soldier positions

        // Channel 3: Buildings (offset by 75)
        if (cell === CELL_BUILDING) view[75 + idx] = 1.0;

        // Channel 4: Mines (offset by 100) - only visible within view range
        if (cell === CELL_MINE) view[100 + idx] = 1.0;
      }
    }

    // Fill enemy/ally channels from soldier list
    for (const s of soldiers) {
      if (!s.alive) continue;
      // Reverse-rotate soldier position to local coords
      const relX = s.x - cx;
      const relY = s.y - cy;
      let lx, ly;
      switch (facing) {
        case DIR_N: lx = relX; ly = relY; break;
        case DIR_E: lx = -relY; ly = relX; break;
        case DIR_S: lx = -relX; ly = -relY; break;
        case DIR_W: lx = relY; ly = -relX; break;
      }
      lx += radius;
      ly += radius;
      if (lx >= 0 && lx < 5 && ly >= 0 && ly < 5) {
        const idx = ly * 5 + lx;
        if (s.team === 1) { // enemy
          view[25 + idx] = 1.0;
        } else { // ally (team 0) - skip self
          if (s.x !== cx || s.y !== cy) {
            view[50 + idx] = 1.0;
          }
        }
      }
    }

    return view;
  }

  // Find nearest mine position on the grid
  findNearestMine(x, y) {
    let bestDist = Infinity;
    let bestX = -1, bestY = -1;
    for (let cy = 0; cy < SIZE; cy++) {
      for (let cx = 0; cx < SIZE; cx++) {
        if (this.cells[cy * SIZE + cx] === CELL_MINE) {
          const d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
          if (d < bestDist) {
            bestDist = d;
            bestX = cx;
            bestY = cy;
          }
        }
      }
    }
    if (bestX === -1) return null;
    return { x: bestX, y: bestY, dist: bestDist };
  }

  // Manhattan distance
  static distance(x0, y0, x1, y1) {
    return Math.abs(x1 - x0) + Math.abs(y1 - y0);
  }

  // Euclidean distance
  static euclidean(x0, y0, x1, y1) {
    return Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
  }
}
