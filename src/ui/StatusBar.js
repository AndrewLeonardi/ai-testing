// Status bar showing current soldier state and HQ HP.

import { ACTION_NAMES } from '../sim/Soldier.js';

export class StatusBar {
  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="control-group">
        <label>Soldier HP</label>
        <div class="hp-bar"><div class="hp-bar-fill" id="soldier-hp-fill" style="width:100%"></div></div>
      </div>
      <div class="control-group">
        <label>HQ HP</label>
        <div class="hp-bar"><div class="hp-bar-fill" id="hq-hp-fill" style="width:100%;background:#f44336"></div></div>
      </div>
      <div class="stat-row"><span class="label">Action</span><span class="value" id="stat-action">-</span></div>
      <div class="stat-row"><span class="label">Ammo</span><span class="value" id="stat-ammo">-</span></div>
      <div class="stat-row"><span class="label">Cannons</span><span class="value" id="stat-cannons">-</span></div>
    `;
  }

  update(state) {
    if (!state) return;

    // Find our soldier (team 0)
    const soldier = state.soldiers.find(s => s.team === 0);
    const hq = state.buildings.find(b => b.buildingType === 'HQ');
    const cannons = state.buildings.filter(b => b.buildingType === 'CANNON');

    if (soldier) {
      const hpPct = (soldier.hp / soldier.maxHp * 100).toFixed(0);
      const fill = this.container.querySelector('#soldier-hp-fill');
      fill.style.width = hpPct + '%';
      fill.className = 'hp-bar-fill' + (soldier.hp / soldier.maxHp < 0.3 ? ' low' : soldier.hp / soldier.maxHp < 0.6 ? ' mid' : '');

      const actionEl = this.container.querySelector('#stat-action');
      if (actionEl) actionEl.textContent = soldier.lastAction >= 0 ? ACTION_NAMES[soldier.lastAction] : '-';

      const ammoEl = this.container.querySelector('#stat-ammo');
      if (ammoEl) ammoEl.textContent = soldier.alive ? `${Math.round(soldier.hp)}hp` : 'DEAD';
    }

    if (hq) {
      const hqPct = (hq.hp / hq.maxHp * 100).toFixed(0);
      const fill = this.container.querySelector('#hq-hp-fill');
      fill.style.width = hqPct + '%';
    }

    const aliveCount = cannons.filter(c => c.alive).length;
    const cannonEl = this.container.querySelector('#stat-cannons');
    if (cannonEl) cannonEl.textContent = `${aliveCount}/${cannons.length} alive`;
  }
}
