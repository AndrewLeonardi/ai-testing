// RosterPanel.js — UI for managing the soldier roster.
// Recruit soldiers, view stats, select for training drills.

import { BALANCE } from '../game/Balance.js';

const CLASS_COLORS = { SOLDIER: '#ffab40', ARMORED: '#40c4ff' };

export class RosterPanel {
  constructor(container, roster) {
    this.container = container;
    this.roster = roster;

    // Callbacks set by main.js
    this.onTrainSoldier = null;   // (soldierId, drillName) => void
    this.onGroupTrain = null;     // (soldierIds[], drillName) => void
    this.onEditBase = null;       // () => void

    this.selectedForGroup = new Set();
    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    // Gold display
    const goldRow = document.createElement('div');
    goldRow.className = 'stat-row';
    goldRow.innerHTML = `<span class="label">Gold</span><span class="value" style="color:#ffd700">${this.roster.gold}</span>`;
    this.container.appendChild(goldRow);

    // Roster slots
    const slotsRow = document.createElement('div');
    slotsRow.className = 'stat-row';
    slotsRow.innerHTML = `<span class="label">Roster</span><span class="value">${this.roster.size} / ${this.roster.maxSlots}</span>`;
    this.container.appendChild(slotsRow);

    // Recruit section — stat comparison cards
    const recruitHeader = document.createElement('div');
    recruitHeader.style.cssText = 'font-size:11px;color:#8bc34a;text-transform:uppercase;letter-spacing:1px;margin-top:8px';
    recruitHeader.textContent = 'Recruit';
    this.container.appendChild(recruitHeader);

    const recruitRow = document.createElement('div');
    recruitRow.style.cssText = 'display:flex;gap:6px';

    for (const [className, classDef] of Object.entries(BALANCE.SOLDIER_CLASSES)) {
      const hp = Math.round(BALANCE.SOLDIER.hp * classDef.hpMultiplier);
      const dmg = Math.round(BALANCE.SOLDIER.damage * classDef.damageMultiplier);
      const color = CLASS_COLORS[className] || '#e0e0e0';

      const card = document.createElement('button');
      card.className = 'btn';
      card.style.cssText = `flex:1;padding:8px 6px;font-size:10px;text-align:center;line-height:1.5;border-color:${color}`;
      card.title = classDef.description;
      card.innerHTML = `
        <div style="font-weight:bold;color:${color};font-size:12px;margin-bottom:4px">${className}</div>
        <div>HP: <b>${hp}</b></div>
        <div>DMG: <b>${dmg}</b></div>
        <div style="color:#ffd700;margin-top:4px">${classDef.recruitCost}g</div>
      `;
      card.addEventListener('click', () => this._recruit(className));
      recruitRow.appendChild(card);
    }
    this.container.appendChild(recruitRow);

    // Message area
    this.msgEl = document.createElement('div');
    this.msgEl.style.cssText = 'font-size:11px;min-height:16px;color:#ff9800;text-align:center';
    this.container.appendChild(this.msgEl);

    // Soldiers list
    const soldiersHeader = document.createElement('div');
    soldiersHeader.style.cssText = 'font-size:11px;color:#8bc34a;text-transform:uppercase;letter-spacing:1px;margin-top:4px';
    soldiersHeader.textContent = 'Your Soldiers';
    this.container.appendChild(soldiersHeader);

    if (this.roster.soldiers.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:#666;text-align:center;padding:12px 0';
      empty.textContent = 'No soldiers yet. Recruit one above!';
      this.container.appendChild(empty);
    } else {
      for (const soldier of this.roster.soldiers) {
        this.container.appendChild(this._buildSoldierCard(soldier));
      }
    }

    // Group Training section
    this._buildGroupSection();

    // Edit Base button at bottom
    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.style.cssText = 'width:100%;margin-top:12px;background:#1a2a3a;color:#ff9800;border-color:#ff9800';
    editBtn.textContent = 'EDIT BASE';
    editBtn.addEventListener('click', () => {
      if (this.onEditBase) this.onEditBase();
    });
    this.container.appendChild(editBtn);
  }

  _buildSoldierCard(soldier) {
    const card = document.createElement('div');
    card.style.cssText = 'background:#0a2a0a;border:1px solid #2a5a2a;border-radius:4px;padding:8px;margin-top:4px';

    const color = CLASS_COLORS[soldier.soldierClass] || '#e0e0e0';
    const classDef = BALANCE.SOLDIER_CLASSES[soldier.soldierClass];
    const hp = classDef ? Math.round(BALANCE.SOLDIER.hp * classDef.hpMultiplier) : BALANCE.SOLDIER.hp;
    const dmg = classDef ? Math.round(BALANCE.SOLDIER.damage * classDef.damageMultiplier) : BALANCE.SOLDIER.damage;

    // Header: checkbox + name + class
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px';

    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display:flex;align-items:center;gap:6px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.selectedForGroup.has(soldier.id);
    checkbox.title = 'Select for group drill';
    checkbox.style.cssText = 'accent-color:#8bc34a;cursor:pointer';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        this.selectedForGroup.add(soldier.id);
      } else {
        this.selectedForGroup.delete(soldier.id);
      }
      this._updateGroupSection();
    });
    leftSide.appendChild(checkbox);
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = `font-weight:bold;color:${color}`;
    nameSpan.textContent = soldier.name;
    leftSide.appendChild(nameSpan);
    header.appendChild(leftSide);
    const classSpan = document.createElement('span');
    classSpan.style.cssText = `font-size:10px;color:${color};opacity:0.7`;
    classSpan.textContent = soldier.soldierClass;
    header.appendChild(classSpan);
    card.appendChild(header);

    // Stats: class stats + training history
    const stats = document.createElement('div');
    stats.style.cssText = 'font-size:10px;color:#aaa;margin-bottom:6px';
    const ep = soldier.totalEpisodes;
    const drillList = Object.entries(soldier.drillHistory)
      .map(([d, n]) => `${d}: ${n}`)
      .join(', ') || 'none';
    stats.innerHTML = `HP: ${hp} | DMG: ${dmg} | Episodes: ${ep}<br>Drills: ${drillList}`;
    card.appendChild(stats);

    // Drill selector + Train button
    const drillRow = document.createElement('div');
    drillRow.style.cssText = 'display:flex;gap:4px;align-items:center';

    const select = document.createElement('select');
    select.className = 'editor-select';
    select.style.cssText = 'flex:1;font-size:10px;padding:4px';

    for (const [drillName, drillDef] of Object.entries(BALANCE.DRILLS)) {
      if (drillDef.type === 'group') continue;
      if (drillDef.minLevel > this.roster.playerLevel) continue;
      const opt = document.createElement('option');
      opt.value = drillName;
      opt.textContent = drillName.replace(/_/g, ' ');
      if (classDef && classDef.recommendedDrills && classDef.recommendedDrills[0] === drillName) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
    drillRow.appendChild(select);

    const trainBtn = document.createElement('button');
    trainBtn.className = 'btn';
    trainBtn.style.cssText = 'font-size:10px;padding:4px 8px;white-space:nowrap';
    trainBtn.textContent = 'TRAIN';
    trainBtn.addEventListener('click', () => {
      const drill = select.value;
      if (this.onTrainSoldier) this.onTrainSoldier(soldier.id, drill);
    });
    drillRow.appendChild(trainBtn);

    // Retire button
    const retireBtn = document.createElement('button');
    retireBtn.className = 'btn';
    retireBtn.style.cssText = 'font-size:10px;padding:4px 6px;background:#3a1a1a;color:#f44336;border-color:#f44336';
    retireBtn.textContent = 'X';
    retireBtn.title = 'Retire soldier';
    retireBtn.addEventListener('click', () => {
      if (confirm(`Retire ${soldier.name}? This is permanent.`)) {
        this.roster.retire(soldier.id);
        this._build();
      }
    });
    drillRow.appendChild(retireBtn);

    card.appendChild(drillRow);
    return card;
  }

  _buildGroupSection() {
    // Check if any group drills are available
    const availGroupDrills = Object.entries(BALANCE.DRILLS)
      .filter(([, d]) => d.type === 'group' && d.minLevel <= this.roster.playerLevel);

    if (availGroupDrills.length === 0 || this.roster.soldiers.length < 2) return;

    const section = document.createElement('div');
    section.id = 'group-training-section';
    section.style.cssText = 'margin-top:10px;padding:8px;background:#1a2a1a;border:1px solid #2a5a2a;border-radius:4px';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;color:#ff9800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px';
    header.textContent = 'Group Training';
    section.appendChild(header);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:10px;color:#8bc34a;margin-bottom:6px';
    desc.textContent = 'Check soldiers above, then start a group drill.';
    section.appendChild(desc);

    // Drill dropdown
    const drillRow = document.createElement('div');
    drillRow.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:6px';

    const select = document.createElement('select');
    select.id = 'group-drill-select';
    select.className = 'editor-select';
    select.style.cssText = 'flex:1;font-size:10px;padding:4px';
    for (const [drillName, drillDef] of availGroupDrills) {
      const opt = document.createElement('option');
      opt.value = drillName;
      opt.textContent = drillName.replace(/_/g, ' ') + ` (${drillDef.minSoldiers}+)`;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => this._updateGroupSection());
    drillRow.appendChild(select);
    section.appendChild(drillRow);

    // Status text
    const statusEl = document.createElement('div');
    statusEl.id = 'group-status';
    statusEl.style.cssText = 'font-size:10px;color:#aaa;margin-bottom:6px';
    section.appendChild(statusEl);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.id = 'group-start-btn';
    startBtn.className = 'btn';
    startBtn.style.cssText = 'width:100%;font-size:12px;padding:8px;background:#2a3a1a;color:#8bc34a;border-color:#4caf50';
    startBtn.textContent = 'START GROUP DRILL';
    startBtn.disabled = true;
    startBtn.style.opacity = '0.5';
    startBtn.addEventListener('click', () => {
      const drill = select.value;
      const ids = Array.from(this.selectedForGroup);
      if (this.onGroupTrain) this.onGroupTrain(ids, drill);
    });
    section.appendChild(startBtn);

    this.container.appendChild(section);
    this._updateGroupSection();
  }

  _updateGroupSection() {
    const statusEl = document.getElementById('group-status');
    const startBtn = document.getElementById('group-start-btn');
    const select = document.getElementById('group-drill-select');
    if (!statusEl || !startBtn || !select) return;

    const drillName = select.value;
    const drillDef = BALANCE.DRILLS[drillName];
    const needed = drillDef ? drillDef.minSoldiers : 2;
    const selected = this.selectedForGroup.size;

    // Build class composition text
    const classComposition = [];
    for (const id of this.selectedForGroup) {
      const s = this.roster.getById(id);
      if (s) classComposition.push(s.soldierClass);
    }
    const compText = classComposition.length > 0
      ? classComposition.join(' + ')
      : 'none';

    if (selected >= needed) {
      statusEl.innerHTML = `<span style="color:#4caf50">Ready!</span> ${selected} selected: <b>${compText}</b>`;
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    } else {
      statusEl.innerHTML = `<span style="color:#ff9800">Select ${needed - selected} more</span> | Selected: ${compText}`;
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
    }
  }

  _recruit(className) {
    const result = this.roster.recruit(className);
    if (result.ok) {
      this.msgEl.style.color = '#4caf50';
      this.msgEl.textContent = `Recruited ${result.soldier.name} (${className})!`;
      this._build();
    } else {
      this.msgEl.style.color = '#f44336';
      this.msgEl.textContent = result.reason;
    }
  }

  refresh() {
    this._build();
  }

  dispose() {
    this.container.innerHTML = '';
  }
}
