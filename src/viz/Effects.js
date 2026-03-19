// Visual effects: muzzle flash, cannon fire, hit indicators.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.activeEffects = [];
  }

  processEvent(evt) {
    switch (evt.type) {
      case 'shot_hit':
        this._createShotLine(evt.shooter, evt.tx, evt.ty, 0x76ff03);
        this._createHitFlash(evt.tx, evt.ty);
        break;
      case 'shot_miss':
        this._createMuzzleFlash(evt.shooter);
        break;
      case 'cannon_fire':
        this._createShotLine(evt.cannon, evt.target.x, evt.target.y, 0xff6600);
        this._createHitFlash(evt.target.x, evt.target.y);
        break;
      case 'mine_explode':
        this._createMineExplosion(evt.x, evt.y);
        break;
    }
  }

  _createShotLine(shooter, tx, ty, color) {
    const points = [
      new THREE.Vector3(shooter.x + 0.5, 0.5, shooter.y + 0.5),
      new THREE.Vector3(tx + 0.5, 0.5, ty + 0.5),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.activeEffects.push({ mesh: line, life: 8, maxLife: 8 });
  }

  _createMuzzleFlash(entity) {
    const geo = new THREE.SphereGeometry(0.15, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.set(entity.x + 0.5, 0.5, entity.y + 0.5);
    this.scene.add(flash);
    this.activeEffects.push({ mesh: flash, life: 4, maxLife: 4 });
  }

  _createHitFlash(x, y) {
    const geo = new THREE.SphereGeometry(0.2, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.set(x + 0.5, 0.5, y + 0.5);
    this.scene.add(flash);
    this.activeEffects.push({ mesh: flash, life: 6, maxLife: 6 });
  }

  _createMineExplosion(x, y) {
    // Larger orange/red burst for mine explosion
    const geo = new THREE.SphereGeometry(0.6, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true });
    const blast = new THREE.Mesh(geo, mat);
    blast.position.set(x + 0.5, 0.3, y + 0.5);
    this.scene.add(blast);
    this.activeEffects.push({ mesh: blast, life: 12, maxLife: 12 });

    // Debris ring
    const ringGeo = new THREE.TorusGeometry(0.5, 0.08, 4, 8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x + 0.5, 0.1, y + 0.5);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.activeEffects.push({ mesh: ring, life: 10, maxLife: 10 });
  }

  update() {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const fx = this.activeEffects[i];
      fx.life--;
      const alpha = fx.life / fx.maxLife;
      if (fx.mesh.material) fx.mesh.material.opacity = alpha;
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        if (fx.mesh.geometry) fx.mesh.geometry.dispose();
        if (fx.mesh.material) fx.mesh.material.dispose();
        this.activeEffects.splice(i, 1);
      }
    }
  }

  clear() {
    for (const fx of this.activeEffects) {
      this.scene.remove(fx.mesh);
      if (fx.mesh.geometry) fx.mesh.geometry.dispose();
      if (fx.mesh.material) fx.mesh.material.dispose();
    }
    this.activeEffects = [];
  }
}
