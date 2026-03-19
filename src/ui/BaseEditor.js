// Base Editor: click-to-place buildings on the 3D grid.
// Data-driven from Balance.js — adding new building types requires zero editor changes.

import * as THREE from 'three';
import { BALANCE } from '../game/Balance.js';
import { Grid, SIZE, CELL_EMPTY, CELL_WALL, CELL_BUILDING, CELL_SHIELD, CELL_MINE } from '../sim/Grid.js';
import { createBuildingMesh } from '../viz/BuildingMesh.js';

export class BaseEditor {
  constructor(container, renderer, onTest, onExit) {
    this.container = container;
    this.renderer = renderer;
    this.onTest = onTest;
    this.onExit = onExit;

    // State
    this.playerLevel = 1;
    this.selectedTool = null; // building type string or 'ERASE' or 'SPAWN'
    this.placedBuildings = []; // { type, x, y }
    this.hqPosition = null;
    this.spawnPosition = { x: 16, y: 2 };

    // Preview meshes tracked for cleanup
    this._previewMeshes = [];
    this._hoverMesh = null;
    this._spawnMesh = null;

    // Bound handlers for cleanup
    this._onMouseClick = this._onMouseClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);

    this._build();
    this._setupMouse();
    this._updatePreview();
    this.renderer.canvas.classList.add('editor-active');
  }

  _build() {
    // Collect cumulative unlocks for building display names
    const buildingNames = {
      HQ: 'HQ', CANNON: 'Cannon', WALL: 'Wall', MINE: 'Mine',
      SHIELD_GENERATOR: 'Shield Gen', SNIPER_TOWER: 'Sniper', MORTAR: 'Mortar',
      HEAL_STATION: 'Heal Station',
    };

    this.container.innerHTML = `
      <div class="control-group">
        <label>Player Level</label>
        <select id="editor-level" class="editor-select">
          ${Array.from({ length: BALANCE.PLAYER_LEVELS.MAX }, (_, i) => {
            const lvl = i + 1;
            return `<option value="${lvl}">Level ${lvl}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="control-group">
        <label>Buildings</label>
        <div id="editor-palette" class="editor-palette"></div>
      </div>
      <div class="control-group">
        <label>Tools</label>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn palette-btn" data-tool="SPAWN">Spawn</button>
          <button class="btn palette-btn" data-tool="ERASE">Eraser</button>
        </div>
      </div>
      <div class="editor-budget" id="editor-budget">
        <div class="stat-row"><span class="label">Gold</span><span class="value" id="budget-gold">0 / 800</span></div>
        <div class="stat-row"><span class="label">Buildings</span><span class="value" id="budget-count">0 / 10</span></div>
      </div>
      <div class="editor-path-status" id="editor-path-status">
        <span id="path-icon">--</span> <span id="path-text">Place HQ to begin</span>
      </div>
      <div class="control-group">
        <label>Save / Load</label>
        <div style="display:flex;gap:4px;">
          <input type="text" id="editor-save-name" placeholder="Layout name" class="editor-input" style="flex:1">
          <button class="btn" id="btn-save">SAVE</button>
        </div>
        <select id="editor-load-list" class="editor-select">
          <option value="">-- Load saved --</option>
        </select>
        <button class="btn" id="btn-load" style="width:100%">LOAD</button>
      </div>
      <button class="btn" id="btn-test" style="width:100%;background:#1a1a3a;color:#40c4ff;border-color:#40c4ff" disabled>TEST (AI attacks once)</button>
      <button class="btn" id="btn-back" style="width:100%">BACK TO TRAINING</button>
    `;

    // Wire events
    this.container.querySelector('#editor-level').addEventListener('change', (e) => {
      this.playerLevel = parseInt(e.target.value);
      this._rebuildPalette();
      this._updateBudget();
    });

    // Tool buttons
    this.container.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this._selectTool(btn.dataset.tool));
    });

    this.container.querySelector('#btn-save').addEventListener('click', () => {
      const name = this.container.querySelector('#editor-save-name').value.trim();
      if (name) this.save(name);
    });

    this.container.querySelector('#btn-load').addEventListener('click', () => {
      const name = this.container.querySelector('#editor-load-list').value;
      if (name) this.load(name);
    });

    this.container.querySelector('#btn-test').addEventListener('click', () => {
      const layout = this._buildLayout();
      if (layout && this.onTest) this.onTest(layout);
    });

    this.container.querySelector('#btn-back').addEventListener('click', () => {
      if (this.onExit) this.onExit();
    });

    this._rebuildPalette();
    this._refreshSaveList();
    this._updateBudget();
  }

  _rebuildPalette() {
    const palette = this.container.querySelector('#editor-palette');
    const unlocked = this._getUnlockedBuildings(this.playerLevel);
    const buildingNames = {
      HQ: 'HQ', CANNON: 'Cannon', WALL: 'Wall', MINE: 'Mine',
      SHIELD_GENERATOR: 'Shield Gen',
    };

    palette.innerHTML = unlocked.map(type => {
      const cost = BALANCE.BUILDINGS[type].goldCost;
      const label = buildingNames[type] || type;
      const costLabel = cost > 0 ? ` (${cost}g)` : ' (free)';
      return `<button class="btn palette-btn" data-building="${type}">${label}${costLabel}</button>`;
    }).join('');

    palette.querySelectorAll('[data-building]').forEach(btn => {
      btn.addEventListener('click', () => this._selectTool(btn.dataset.building));
    });
  }

  _getUnlockedBuildings(level) {
    const unlocked = new Set();
    // HQ is always available
    unlocked.add('HQ');
    // Walk progression up to this level, collecting cumulative unlocks
    for (let i = 1; i <= level; i++) {
      const prog = BALANCE.PLAYER_LEVELS.progression[i];
      if (prog && prog.unlocks) {
        for (const u of prog.unlocks) {
          // Only include implemented buildings
          if (BALANCE.BUILDINGS[u] && BALANCE.BUILDINGS[u].status === 'implemented') {
            unlocked.add(u);
          }
        }
      }
    }
    return Array.from(unlocked);
  }

  _selectTool(tool) {
    this.selectedTool = tool;
    // Update UI
    this.container.querySelectorAll('.palette-btn').forEach(btn => {
      const isTool = btn.dataset.tool === tool || btn.dataset.building === tool;
      btn.classList.toggle('active', isTool);
    });
  }

  _setupMouse() {
    this.renderer.canvas.addEventListener('click', this._onMouseClick);
    this.renderer.canvas.addEventListener('mousemove', this._onMouseMove);
  }

  _onMouseClick(e) {
    const hit = this.renderer.getGroundIntersection(e.clientX, e.clientY);
    if (!hit) return;
    this._handleGridClick(hit.gridX, hit.gridY);
  }

  _onMouseMove(e) {
    const hit = this.renderer.getGroundIntersection(e.clientX, e.clientY);
    this._updateHover(hit);
  }

  _handleGridClick(x, y) {
    if (!this.selectedTool) return;

    if (this.selectedTool === 'ERASE') {
      this._eraseAt(x, y);
    } else if (this.selectedTool === 'SPAWN') {
      if (y > 6) return; // Spawn zone: bottom of grid
      this.spawnPosition = { x, y };
    } else if (this.selectedTool === 'HQ') {
      if (y < 16) return; // HQ zone: back half of grid
      // Remove old HQ if exists
      this.placedBuildings = this.placedBuildings.filter(b => b.type !== 'HQ');
      this.hqPosition = { x, y };
      this.placedBuildings.push({ type: 'HQ', x, y });
    } else {
      // Place a building
      if (this._isOccupied(x, y)) return;

      const cost = BALANCE.BUILDINGS[this.selectedTool]?.goldCost || 0;
      const currentGold = this._goldSpent();
      const budget = this._getBudget();
      const currentCount = this._buildingCount();
      const maxCount = this._getMaxBuildings();

      if (currentGold + cost > budget) return; // Over budget
      if (currentCount >= maxCount) return; // Too many buildings

      this.placedBuildings.push({ type: this.selectedTool, x, y });
    }

    this._updateBudget();
    this._validatePath();
    this._updatePreview();
  }

  _eraseAt(x, y) {
    const idx = this.placedBuildings.findIndex(b => b.x === x && b.y === y);
    if (idx !== -1) {
      const removed = this.placedBuildings[idx];
      this.placedBuildings.splice(idx, 1);
      if (removed.type === 'HQ') this.hqPosition = null;
    }
  }

  _isOccupied(x, y) {
    if (this.spawnPosition && this.spawnPosition.x === x && this.spawnPosition.y === y) return true;
    return this.placedBuildings.some(b => b.x === x && b.y === y);
  }

  _goldSpent() {
    return this.placedBuildings.reduce((sum, b) => {
      return sum + (BALANCE.BUILDINGS[b.type]?.goldCost || 0);
    }, 0);
  }

  _buildingCount() {
    // Count non-HQ buildings (HQ is free and mandatory)
    return this.placedBuildings.filter(b => b.type !== 'HQ').length;
  }

  _getBudget() {
    const prog = BALANCE.PLAYER_LEVELS.progression[this.playerLevel];
    return prog ? prog.buildBudget : 800;
  }

  _getMaxBuildings() {
    const prog = BALANCE.PLAYER_LEVELS.progression[this.playerLevel];
    return prog ? prog.maxBuildings : 10;
  }

  _updateBudget() {
    const goldEl = this.container.querySelector('#budget-gold');
    const countEl = this.container.querySelector('#budget-count');
    if (goldEl) goldEl.textContent = `${this._goldSpent()} / ${this._getBudget()}`;
    if (countEl) countEl.textContent = `${this._buildingCount()} / ${this._getMaxBuildings()}`;
  }

  _validatePath() {
    const statusIcon = this.container.querySelector('#path-icon');
    const statusText = this.container.querySelector('#path-text');
    const testBtn = this.container.querySelector('#btn-test');

    if (!this.hqPosition) {
      statusIcon.textContent = '--';
      statusIcon.className = '';
      statusText.textContent = 'Place HQ to begin';
      testBtn.disabled = true;
      return;
    }

    // Build a temporary cell grid from placed buildings
    const cells = new Uint8Array(SIZE * SIZE);
    for (const b of this.placedBuildings) {
      if (b.type === 'MINE') {
        cells[b.y * SIZE + b.x] = CELL_MINE;
      } else if (b.type === 'WALL') {
        cells[b.y * SIZE + b.x] = CELL_WALL;
      } else if (b.type === 'SHIELD_GENERATOR') {
        // Shield gen itself is a building cell
        cells[b.y * SIZE + b.x] = CELL_BUILDING;
        // Auto-generate shield line 2 rows in front
        const shieldY = b.y - 2;
        if (shieldY >= 0) {
          for (let sx = Math.max(0, b.x - 6); sx <= Math.min(SIZE - 1, b.x + 6); sx++) {
            if (cells[shieldY * SIZE + sx] === CELL_EMPTY) {
              cells[shieldY * SIZE + sx] = CELL_SHIELD;
            }
          }
        }
      } else {
        cells[b.y * SIZE + b.x] = CELL_BUILDING;
      }
    }

    const result = Grid.bfsPathExists(
      cells,
      this.spawnPosition.x, this.spawnPosition.y,
      this.hqPosition.x, this.hqPosition.y
    );

    if (!result.reachable) {
      statusIcon.textContent = 'X';
      statusIcon.className = 'path-blocked';
      statusText.textContent = 'No path to HQ!';
      testBtn.disabled = true;
    } else if (result.mineOnly) {
      statusIcon.textContent = '!';
      statusIcon.className = 'path-warning';
      statusText.textContent = 'Path only through mines';
      testBtn.disabled = false; // Allow it, but warn
    } else {
      statusIcon.textContent = 'OK';
      statusIcon.className = 'path-ok';
      statusText.textContent = 'Path clear';
      testBtn.disabled = false;
    }
  }

  _updatePreview() {
    // Clear old preview meshes
    for (const mesh of this._previewMeshes) {
      this.renderer.removeMesh(mesh);
    }
    this._previewMeshes = [];

    // Remove old spawn mesh
    if (this._spawnMesh) {
      this.renderer.removeMesh(this._spawnMesh);
      this._spawnMesh = null;
    }

    // Render each placed building
    for (const b of this.placedBuildings) {
      if (b.type === 'MINE') {
        // Mine mesh (same as Renderer._addMineMesh)
        const group = new THREE.Group();
        const discGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8);
        const discMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.y = 0.03;
        group.add(disc);
        const dotGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 6);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.y = 0.07;
        group.add(dot);
        group.position.set(b.x + 0.5, 0, b.y + 0.5);
        this.renderer.addMesh(group);
        this._previewMeshes.push(group);
      } else {
        // Use createBuildingMesh for HQ, CANNON, WALL, SHIELD_GENERATOR
        const mesh = createBuildingMesh({ buildingType: b.type, x: b.x, y: b.y, hp: 1, maxHp: 1 });
        this.renderer.addMesh(mesh);
        this._previewMeshes.push(mesh);
      }
    }

    // Render shield lines for any SHIELD_GENERATOR
    for (const b of this.placedBuildings) {
      if (b.type === 'SHIELD_GENERATOR') {
        const shieldY = b.y - 2;
        if (shieldY < 0) continue;
        for (let sx = Math.max(0, b.x - 6); sx <= Math.min(SIZE - 1, b.x + 6); sx++) {
          // Skip if another building is there
          if (this.placedBuildings.some(pb => pb.x === sx && pb.y === shieldY)) continue;
          const geo = new THREE.BoxGeometry(1, 1.5, 1);
          const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25 });
          const block = new THREE.Mesh(geo, mat);
          block.position.set(sx + 0.5, 0.75, shieldY + 0.5);
          this.renderer.addMesh(block);
          this._previewMeshes.push(block);
        }
      }
    }

    // Spawn marker (green diamond)
    if (this.spawnPosition) {
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.set(this.spawnPosition.x + 0.5, 0.3, this.spawnPosition.y + 0.5);
      marker.rotation.y = Math.PI / 4;
      this.renderer.addMesh(marker);
      this._spawnMesh = marker;
      this._previewMeshes.push(marker);
    }

    this.renderer.render();
  }

  _updateHover(hit) {
    if (this._hoverMesh) {
      this.renderer.removeMesh(this._hoverMesh);
      this._hoverMesh = null;
    }

    if (!hit || !this.selectedTool) return;

    const { gridX, gridY } = hit;
    const canPlace = this._canPlaceAt(gridX, gridY);

    const geo = new THREE.BoxGeometry(1, 0.05, 1);
    const color = canPlace ? 0x00ff00 : 0xff0000;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
    this._hoverMesh = new THREE.Mesh(geo, mat);
    this._hoverMesh.position.set(gridX + 0.5, 0.03, gridY + 0.5);
    this.renderer.addMesh(this._hoverMesh);
    this.renderer.render();
  }

  _canPlaceAt(x, y) {
    if (!this.selectedTool) return false;
    if (this.selectedTool === 'ERASE') return this.placedBuildings.some(b => b.x === x && b.y === y);
    if (this.selectedTool === 'SPAWN') return y <= 6;
    if (this.selectedTool === 'HQ') return y >= 16 && !this.placedBuildings.some(b => b.x === x && b.y === y && b.type !== 'HQ');
    if (this._isOccupied(x, y)) return false;
    const cost = BALANCE.BUILDINGS[this.selectedTool]?.goldCost || 0;
    if (this._goldSpent() + cost > this._getBudget()) return false;
    if (this._buildingCount() >= this._getMaxBuildings()) return false;
    return true;
  }

  _buildLayout() {
    if (!this.hqPosition) return null;

    const layout = {
      hq: { x: this.hqPosition.x, y: this.hqPosition.y },
      cannons: [],
      walls: [],
      mines: [],
      shield: [],
      spawn: { x: this.spawnPosition.x, y: this.spawnPosition.y },
    };

    for (const b of this.placedBuildings) {
      switch (b.type) {
        case 'HQ': break; // Already set
        case 'CANNON':
          layout.cannons.push({ x: b.x, y: b.y });
          break;
        case 'WALL':
          layout.walls.push([b.x, b.y]);
          break;
        case 'MINE':
          layout.mines.push([b.x, b.y]);
          break;
        case 'SHIELD_GENERATOR': {
          // Auto-generate shield line
          const shieldY = b.y - 2;
          if (shieldY >= 0) {
            for (let sx = Math.max(0, b.x - 6); sx <= Math.min(SIZE - 1, b.x + 6); sx++) {
              if (!this.placedBuildings.some(pb => pb.x === sx && pb.y === shieldY)) {
                layout.shield.push([sx, shieldY]);
              }
            }
          }
          break;
        }
      }
    }

    return layout;
  }

  // --- Save / Load ---
  save(name) {
    const data = {
      version: 1,
      playerLevel: this.playerLevel,
      buildings: this.placedBuildings.map(b => ({ type: b.type, x: b.x, y: b.y })),
      spawn: { ...this.spawnPosition },
    };
    localStorage.setItem(`base_editor_${name}`, JSON.stringify(data));
    this._refreshSaveList();
  }

  load(name) {
    const raw = localStorage.getItem(`base_editor_${name}`);
    if (!raw) return;
    const data = JSON.parse(raw);

    this.playerLevel = data.playerLevel || 1;
    this.placedBuildings = data.buildings || [];
    this.spawnPosition = data.spawn || { x: 16, y: 2 };
    this.hqPosition = this.placedBuildings.find(b => b.type === 'HQ') || null;
    if (this.hqPosition) this.hqPosition = { x: this.hqPosition.x, y: this.hqPosition.y };

    // Update UI
    const levelSelect = this.container.querySelector('#editor-level');
    if (levelSelect) levelSelect.value = this.playerLevel;
    this._rebuildPalette();
    this._updateBudget();
    this._validatePath();
    this._updatePreview();
  }

  _refreshSaveList() {
    const select = this.container.querySelector('#editor-load-list');
    if (!select) return;
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('base_editor_')) {
        saves.push(key.replace('base_editor_', ''));
      }
    }
    select.innerHTML = '<option value="">-- Load saved --</option>' +
      saves.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  dispose() {
    this.renderer.canvas.removeEventListener('click', this._onMouseClick);
    this.renderer.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.renderer.canvas.classList.remove('editor-active');

    // Clean up preview meshes
    for (const mesh of this._previewMeshes) {
      this.renderer.removeMesh(mesh);
    }
    if (this._hoverMesh) this.renderer.removeMesh(this._hoverMesh);
    this._previewMeshes = [];
    this._hoverMesh = null;
    this._spawnMesh = null;
  }
}
