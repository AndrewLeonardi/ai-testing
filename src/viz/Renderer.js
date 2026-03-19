// Three.js scene setup: orthographic camera looking down at 32x32 grid.

import * as THREE from 'three';
import { SIZE } from '../sim/Grid.js';
import { createSoldierMesh, updateSoldierMesh } from './SoldierMesh.js';
import { createBuildingMesh, updateBuildingMesh } from './BuildingMesh.js';
import { createGridOverlay } from './GridOverlay.js';
import { Effects } from './Effects.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.soldierMeshes = new Map();
    this.buildingMeshes = new Map();
    this.mineMeshes = new Map(); // keyed by "x,y"
    this.shieldMesh = null;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x2d1f0e); // dark brown ground

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x2d1f0e, 40, 60);

    // Orthographic camera (top-down)
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const viewSize = 20;
    this.camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 100
    );
    // Isometric-ish angle
    this.camera.position.set(SIZE / 2, 25, SIZE / 2 + 15);
    this.camera.lookAt(SIZE / 2, 0, SIZE / 2);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xfff4e0, 0.8);
    directional.position.set(20, 30, 10);
    directional.castShadow = false;
    this.scene.add(directional);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(SIZE / 2, -0.01, SIZE / 2);
    this.scene.add(ground);

    // Grid overlay
    this.gridOverlay = createGridOverlay(SIZE);
    this.scene.add(this.gridOverlay);

    // Effects system
    this.effects = new Effects(this.scene);

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewSize = 20;
    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();
  }

  // Initialize meshes from initial state
  initFromState(state) {
    // Buildings
    for (const b of state.buildings) {
      const mesh = createBuildingMesh(b);
      this.buildingMeshes.set(b.id, mesh);
      this.scene.add(mesh);
    }
    // Soldiers
    for (const s of state.soldiers) {
      const mesh = createSoldierMesh(s);
      this.soldierMeshes.set(s.id, mesh);
      this.scene.add(mesh);
    }
    // Mines
    if (state.mines) {
      for (const m of state.mines) {
        this._addMineMesh(m.x, m.y);
      }
    }
    // Shield
    if (state.shieldActive) {
      this._createShield();
    }
  }

  _addMineMesh(x, y) {
    const key = `${x},${y}`;
    if (this.mineMeshes.has(key)) return;
    const group = new THREE.Group();
    // Flat disc partially buried in ground
    const discGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 8);
    const discMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e }); // dark brown, blends with ground
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.03;
    group.add(disc);
    // Small red indicator dot on top
    const dotGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.y = 0.07;
    group.add(dot);
    group.position.set(x + 0.5, 0, y + 0.5);
    this.scene.add(group);
    this.mineMeshes.set(key, group);
  }

  _createShield() {
    if (this.shieldMesh) return;
    const group = new THREE.Group();
    // Shield line at y=20 from x=10 to x=22
    for (let x = 10; x <= 22; x++) {
      const geo = new THREE.BoxGeometry(1, 1.5, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.35,
      });
      const block = new THREE.Mesh(geo, mat);
      block.position.set(x + 0.5, 0.75, 20 + 0.5); // grid y maps directly to 3D z
      group.add(block);
    }
    this.shieldMesh = group;
    this.scene.add(group);
  }

  _removeShield() {
    if (this.shieldMesh) {
      this.scene.remove(this.shieldMesh);
      this.shieldMesh = null;
    }
  }

  // Update meshes from state snapshot (with interpolation alpha)
  update(state, alpha = 1) {
    // Update soldiers
    for (const s of state.soldiers) {
      let mesh = this.soldierMeshes.get(s.id);
      if (!mesh) {
        mesh = createSoldierMesh(s);
        this.soldierMeshes.set(s.id, mesh);
        this.scene.add(mesh);
      }
      updateSoldierMesh(mesh, s, alpha);
    }

    // Update buildings
    for (const b of state.buildings) {
      const mesh = this.buildingMeshes.get(b.id);
      if (mesh) updateBuildingMesh(mesh, b);
    }

    // Handle shield state
    if (state.shieldActive && !this.shieldMesh) {
      this._createShield();
    } else if (!state.shieldActive && this.shieldMesh) {
      this._removeShield();
    }
    // Pulse shield opacity
    if (this.shieldMesh) {
      const pulse = 0.25 + 0.15 * Math.sin(Date.now() * 0.005);
      this.shieldMesh.children.forEach(block => {
        block.material.opacity = pulse;
      });
    }

    // Update mines - remove meshes for consumed mines
    if (state.mines) {
      const activeMines = new Set(state.mines.map(m => `${m.x},${m.y}`));
      for (const [key, mesh] of this.mineMeshes) {
        if (!activeMines.has(key)) {
          this.scene.remove(mesh);
          this.mineMeshes.delete(key);
        }
      }
    }

    // Process events for effects
    for (const evt of state.events) {
      this.effects.processEvent(evt);
    }

    // Update effects
    this.effects.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // Raycaster: convert mouse click to grid coordinates
  getGroundIntersection(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      const gridX = Math.floor(intersection.x);
      const gridY = Math.floor(intersection.z);
      if (gridX >= 0 && gridX < SIZE && gridY >= 0 && gridY < SIZE) {
        return { gridX, gridY };
      }
    }
    return null;
  }

  // Editor preview mesh management
  addMesh(mesh) { this.scene.add(mesh); }
  removeMesh(mesh) { this.scene.remove(mesh); }

  // Clear all meshes for reset
  clear() {
    for (const [, mesh] of this.soldierMeshes) this.scene.remove(mesh);
    for (const [, mesh] of this.buildingMeshes) this.scene.remove(mesh);
    this.soldierMeshes.clear();
    this.buildingMeshes.clear();
    for (const [, mesh] of this.mineMeshes) this.scene.remove(mesh);
    this.mineMeshes.clear();
    this._removeShield();
    this.effects.clear();
  }
}
