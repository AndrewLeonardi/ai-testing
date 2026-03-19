// Main entry point: wires Simulation, ML, and Visualization together.
// Modes: 'roster' (home), 'drill' (training), 'edit' (base editor), 'test' (test base)

import { LEVELS, getHQ, createFromLayout } from './sim/Scenario.js';
import { SimLoop } from './sim/SimLoop.js';
import { PPO } from './ml/PPO.js';
import { buildObservation } from './ml/Observations.js';
import { computeReward } from './ml/Rewards.js';
import { Renderer } from './viz/Renderer.js';
import { Interpolator } from './viz/Interpolator.js';
import { Dashboard } from './ui/Dashboard.js';
import { BaseEditor } from './ui/BaseEditor.js';
import { MetricsChart } from './ui/MetricsChart.js';
import { StatusBar } from './ui/StatusBar.js';
import { RosterPanel } from './ui/RosterPanel.js';
import { Roster } from './game/Roster.js';
import { BALANCE } from './game/Balance.js';

// --- State ---
let sim, grid, soldiers, buildings, hq;
let renderer, interpolator;
let dashboard, metricsChart, statusBar;
let rosterPanel = null;
let editor = null;
let roster;

// Mode: 'roster' | 'drill' | 'edit' | 'test'
let mode = 'roster';
let testLayout = null;

// Drill training state (per-soldier brain)
let trainingSoldierRecord = null; // SoldierRecord being trained
let trainingDrillName = null;     // which drill
let drillLevelDef = null;         // the LEVELS entry used for the drill

// Training stats
let episode = 0;
let totalSteps = 0;
let episodeReward = 0;
let speed = 1;
let paused = false;
let winHistory = [];
const HORIZON = BALANCE.PPO.horizon;
let stepsSinceUpdate = 0;
let lastEntropy = 0;
let numTeamSoldiers = 1;

// --- Drill → Level mapping ---
// Maps drill names to LEVELS entries (drills reuse existing level factories).
// This is the bridge between the drill system and the existing scenario system.
function getDrillLevel(drillName) {
  const drillToLevel = {
    MINE_FIELD: 0,      // Level 1: mines only
    CANNON_ALLEY: 1,    // Level 2: mines + cannons + shield
    SHIELD_SIEGE: 1,    // Level 2: mines + cannons + shield
    THE_MAZE: 2,        // Level 3: walls + mines + cannons
    KILL_ZONE: 3,       // Level 4: mine walls + dense defenses
  };
  const idx = drillToLevel[drillName];
  if (idx !== undefined && idx < LEVELS.length) return LEVELS[idx];
  return LEVELS[0]; // fallback to level 1
}

// --- Init ---
function init() {
  roster = new Roster();

  // Renderer
  const canvas = document.getElementById('game-canvas');
  renderer = new Renderer(canvas);
  interpolator = new Interpolator();

  // UI
  metricsChart = new MetricsChart(document.getElementById('metrics'));
  statusBar = new StatusBar(document.getElementById('status'));

  // Start in roster mode
  enterRosterMode();

  // Start game loop
  scheduleLoop();
}

// =============================================================================
// MODE: ROSTER (home screen)
// =============================================================================
function enterRosterMode() {
  mode = 'roster';
  paused = true;

  // Hide metrics and status
  document.getElementById('metrics').style.display = 'none';
  document.getElementById('status').style.display = 'none';

  // Clear any existing mode toggle button
  const oldBtn = document.getElementById('btn-mode-toggle');
  if (oldBtn) oldBtn.remove();

  const controlsEl = document.getElementById('controls');
  rosterPanel = new RosterPanel(controlsEl, roster);
  rosterPanel.onTrainSoldier = (soldierId, drillName) => {
    enterDrillMode(soldierId, drillName);
  };
  rosterPanel.onEditBase = () => {
    enterEditMode();
  };

  renderer.clear();
  renderer.render(); // flush empty scene to canvas
}

// =============================================================================
// MODE: DRILL (training a specific soldier on a specific drill)
// =============================================================================
function enterDrillMode(soldierId, drillName) {
  const soldierRecord = roster.getById(soldierId);
  if (!soldierRecord) return;

  trainingSoldierRecord = soldierRecord;
  trainingDrillName = drillName;
  drillLevelDef = getDrillLevel(drillName);

  mode = 'drill';
  paused = false;
  episode = 0;
  totalSteps = 0;
  winHistory = [];
  stepsSinceUpdate = 0;
  lastEntropy = 0;

  // Show metrics and status
  document.getElementById('metrics').style.display = '';
  document.getElementById('status').style.display = '';

  // Clear roster panel
  if (rosterPanel) { rosterPanel.dispose(); rosterPanel = null; }

  // Build drill training UI
  const controlsEl = document.getElementById('controls');
  dashboard = new Dashboard(controlsEl);

  // Override dashboard callbacks for drill context
  dashboard.onSpeedChange = (s) => { speed = s; };
  dashboard.onPauseToggle = (p) => { paused = p; };
  dashboard.onReset = () => { endEpisode(false); resetDrillEpisode(); };
  dashboard.onGraduate = () => {}; // no graduation in drill mode
  dashboard.onRerollWeights = () => {
    // Reroll THIS soldier's brain
    trainingSoldierRecord.brain = new PPO();
    winHistory = [];
    stepsSinceUpdate = 0;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    resetDrillEpisode();
    console.log(`Rerolled ${trainingSoldierRecord.name}'s brain.`);
  };
  dashboard.onResetTraining = () => {
    trainingSoldierRecord.brain = new PPO();
    trainingSoldierRecord.totalEpisodes = 0;
    trainingSoldierRecord.drillHistory = {};
    episode = 0;
    totalSteps = 0;
    winHistory = [];
    stepsSinceUpdate = 0;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    resetDrillEpisode();
  };
  dashboard.onValidateTransfer = () => { runDrillValidation(); };

  metricsChart.rewardHistory = [];
  metricsChart.entropyHistory = [];

  // Add a "BACK TO ROSTER" button above controls
  const backBtn = document.createElement('button');
  backBtn.id = 'btn-mode-toggle';
  backBtn.className = 'btn';
  backBtn.style.cssText = 'width:100%;background:#3a2a1a;color:#ffab40;border-color:#ffab40;font-size:14px;padding:10px;margin-bottom:8px';
  backBtn.textContent = 'BACK TO ROSTER';
  backBtn.addEventListener('click', () => {
    exitDrillMode();
  });
  const dashboardEl = document.getElementById('dashboard');
  dashboardEl.insertBefore(backBtn, document.getElementById('controls'));

  // Soldier info header
  const infoEl = document.createElement('div');
  infoEl.id = 'drill-soldier-info';
  infoEl.style.cssText = 'text-align:center;padding:4px 0;font-size:12px;border-bottom:1px solid #2a5a2a;margin-bottom:4px';
  const classColors = { SOLDIER: '#ffab40', ARMORED: '#40c4ff' };
  const color = classColors[trainingSoldierRecord.soldierClass] || '#e0e0e0';
  const cs = trainingSoldierRecord.classStats;
  const hp = cs ? Math.round(BALANCE.SOLDIER.hp * cs.hpMultiplier) : BALANCE.SOLDIER.hp;
  const dmg = cs ? Math.round(BALANCE.SOLDIER.damage * cs.damageMultiplier) : BALANCE.SOLDIER.damage;
  infoEl.innerHTML = `
    <span style="color:${color};font-weight:bold">${trainingSoldierRecord.name}</span>
    <span style="color:#aaa;font-size:10px">(${trainingSoldierRecord.soldierClass})</span><br>
    <span style="color:#8bc34a;font-size:10px">Drill: ${drillName.replace(/_/g, ' ')} | HP:${hp} DMG:${dmg}</span>
  `;
  dashboardEl.insertBefore(infoEl, document.getElementById('controls'));

  resetDrillEpisode();
}

function exitDrillMode() {
  // Save soldier brain and training stats
  if (trainingSoldierRecord) {
    trainingSoldierRecord.recordTraining(trainingDrillName, episode);
    roster.save();
  }

  // Remove drill info elements
  const infoEl = document.getElementById('drill-soldier-info');
  if (infoEl) infoEl.remove();

  trainingSoldierRecord = null;
  trainingDrillName = null;
  drillLevelDef = null;

  enterRosterMode();
}

function resetDrillEpisode(skipRenderer = false) {
  const scenario = drillLevelDef.factory();
  grid = scenario.grid;
  soldiers = scenario.soldiers;
  buildings = scenario.buildings;
  hq = scenario.hq;

  // Apply class stat multipliers to team=0 soldiers
  if (trainingSoldierRecord) {
    const classStats = trainingSoldierRecord.classStats;
    if (classStats) {
      for (const s of soldiers) {
        if (s.team !== 0) continue;
        const newHp = Math.round(BALANCE.SOLDIER.hp * classStats.hpMultiplier);
        s.hp = newHp;
        s.maxHp = newHp;
        s.damage = Math.round(BALANCE.SOLDIER.damage * classStats.damageMultiplier);
      }
    }
  }

  sim = new SimLoop(grid, soldiers, buildings, hq, drillLevelDef.maxSteps);
  episodeReward = 0;
  numTeamSoldiers = soldiers.filter(s => s.team === 0).length;

  // Skip renderer rebuild during fast training — it's rebuilt once per frame after the tick loop
  if (!skipRenderer && renderer) {
    renderer.clear();
    renderer.initFromState(sim.getState());
    interpolator.pushState(sim.getState());
  }
}

function endEpisode(won) {
  episode++;
  winHistory.push(won ? 1 : 0);
  if (winHistory.length > 100) winHistory.shift();

  metricsChart.addPoint(episodeReward / numTeamSoldiers, lastEntropy);
}

function runDrillValidation() {
  if (!trainingSoldierRecord) return;
  const savedPaused = paused;
  paused = true;

  const VALIDATION_EPISODES = 100;
  let wins = 0;
  const brain = trainingSoldierRecord.brain;

  for (let ep = 0; ep < VALIDATION_EPISODES; ep++) {
    const scenario = drillLevelDef.factory();
    const vGrid = scenario.grid;
    const vSoldiers = scenario.soldiers;
    const vBuildings = scenario.buildings;
    const vHq = scenario.hq;
    const vSim = new SimLoop(vGrid, vSoldiers, vBuildings, vHq, drillLevelDef.maxSteps);

    while (!vSim.done) {
      const actions = [];
      for (const s of vSoldiers) {
        if (!s.alive || s.team !== 0) { actions.push(7); continue; }
        const obs = buildObservation(s, vGrid, vSoldiers, vBuildings, vHq, vSim.shieldActive);
        const result = brain.selectAction(obs);
        actions.push(result.action);
      }
      vSim.tick(actions);
    }
    if (vSim.won) wins++;
  }

  const transferRate = (wins / VALIDATION_EPISODES * 100).toFixed(1);
  const status = wins / VALIDATION_EPISODES >= 0.7 ? 'PASS' : (wins / VALIDATION_EPISODES >= 0.5 ? 'PARTIAL' : 'FAIL');

  console.log(`Drill Validation (${trainingSoldierRecord.name}): ${wins}/${VALIDATION_EPISODES} wins (${transferRate}%) — ${status}`);
  alert(`Drill Validation: ${trainingSoldierRecord.name}\nDrill: ${trainingDrillName}\n\n${wins}/${VALIDATION_EPISODES} wins (${transferRate}%)\n\nStatus: ${status}`);

  paused = savedPaused;
}

// =============================================================================
// MODE: EDIT (base editor — unchanged from before)
// =============================================================================
function enterEditMode() {
  mode = 'edit';
  paused = true;
  renderer.clear();

  // Hide metrics and status
  document.getElementById('metrics').style.display = 'none';
  document.getElementById('status').style.display = 'none';

  // Clean up roster panel if coming from roster
  if (rosterPanel) { rosterPanel.dispose(); rosterPanel = null; }

  // Clear existing mode button
  const oldBtn = document.getElementById('btn-mode-toggle');
  if (oldBtn) oldBtn.remove();

  // Add back button
  const backBtn = document.createElement('button');
  backBtn.id = 'btn-mode-toggle';
  backBtn.className = 'btn';
  backBtn.style.cssText = 'width:100%;background:#2a5a2a;color:#8bc34a;border-color:#4caf50;font-size:14px;padding:10px;margin-bottom:8px';
  backBtn.textContent = 'BACK TO ROSTER';
  backBtn.addEventListener('click', () => { exitEditMode(); });
  const dashboardEl = document.getElementById('dashboard');
  dashboardEl.insertBefore(backBtn, document.getElementById('controls'));

  const controlsEl = document.getElementById('controls');
  editor = new BaseEditor(controlsEl, renderer, onTestLayout, exitEditMode);
}

function exitEditMode() {
  if (editor) { editor.dispose(); editor = null; }
  renderer.clear();

  // Restore metrics and status visibility
  document.getElementById('metrics').style.display = '';
  document.getElementById('status').style.display = '';

  enterRosterMode();
}

function onTestLayout(layout) {
  mode = 'test';
  testLayout = layout;

  const controlsEl = document.getElementById('controls');
  controlsEl.innerHTML = `
    <div class="stat-row"><span class="label">Mode</span><span class="value">TESTING</span></div>
    <div class="stat-row"><span class="label">Status</span><span class="value" id="test-status">Running...</span></div>
    <div class="control-group">
      <label>Speed: <span id="test-speed-label">1x</span></label>
      <input type="range" id="test-speed-slider" min="0" max="4" step="1" value="0">
    </div>
    <button class="btn" id="btn-stop-test" style="width:100%;margin-top:12px">BACK TO EDITOR</button>
  `;

  const speedSteps = [1, 5, 20, 50, 100];
  controlsEl.querySelector('#test-speed-slider').addEventListener('input', (e) => {
    speed = speedSteps[parseInt(e.target.value)];
    controlsEl.querySelector('#test-speed-label').textContent = speed + 'x';
  });
  speed = 1;

  controlsEl.querySelector('#btn-stop-test').addEventListener('click', () => {
    mode = 'edit';
    renderer.clear();
    const controlsEl2 = document.getElementById('controls');
    editor = new BaseEditor(controlsEl2, renderer, onTestLayout, exitEditMode);
  });

  if (editor) { editor.dispose(); editor = null; }
  renderer.clear();

  const scenario = createFromLayout(layout);
  grid = scenario.grid;
  soldiers = scenario.soldiers;
  buildings = scenario.buildings;
  hq = scenario.hq;
  sim = new SimLoop(grid, soldiers, buildings, hq);

  // Use first roster soldier's brain for test mode (or a fresh PPO if none)
  renderer.initFromState(sim.getState());
  interpolator = new Interpolator();
  interpolator.pushState(sim.getState());
  paused = false;
}

// =============================================================================
// GAME LOOP
// =============================================================================
let lastTime = 0;

// Use setTimeout instead of requestAnimationFrame so the game loop runs
// even when the tab is hidden/backgrounded (rAF pauses in hidden tabs).
// Generation counter prevents stale HMR loops from continuing.
const loopGen = (window._loopGen = (window._loopGen || 0) + 1);
function scheduleLoop() {
  if (window._loopGen !== loopGen) return; // stale module — stop
  setTimeout(() => gameLoop(performance.now()), 16);
}

function gameLoop(timestamp) {
  scheduleLoop();

  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (mode === 'roster' || mode === 'edit') {
    // No simulation running
    return;
  }

  if (paused) {
    renderer.render();
    return;
  }

  // Test mode: inference only, one episode
  if (mode === 'test') {
    // Use first roster soldier's brain or a default
    const testBrain = (roster.soldiers.length > 0) ? roster.soldiers[0].brain : new PPO();
    const ticksThisFrame = speed;
    for (let t = 0; t < ticksThisFrame; t++) {
      if (sim.done) {
        const statusEl = document.getElementById('test-status');
        if (statusEl) statusEl.textContent = sim.won ? 'WIN!' : 'DEFEATED';
        paused = true;
        break;
      }
      const actions = [];
      for (const s of soldiers) {
        if (!s.alive || s.team !== 0) { actions.push(7); continue; }
        const obs = buildObservation(s, grid, soldiers, buildings, hq, sim.shieldActive);
        const result = testBrain.selectAction(obs);
        actions.push(result.action);
      }
      sim.tick(actions);
    }
    const state = sim.getState();
    interpolator.pushState(state);
    renderer.update(state, 1);
    renderer.render();
    return;
  }

  // ==========================================================================
  // DRILL MODE — training a specific soldier's individual brain
  // ==========================================================================
  if (mode === 'drill' && trainingSoldierRecord) { try {
    const brain = trainingSoldierRecord.brain;
    // When tab is hidden, browsers throttle setTimeout to ~1s intervals.
    // Compensate by running more ticks per callback (simulate ~60fps worth).
    const ticksThisFrame = document.hidden ? speed * 60 : speed;

    for (let t = 0; t < ticksThisFrame; t++) {
      if (sim.done) {
        endEpisode(sim.won);

        // PPO update for this soldier's brain
        if (brain.bufferSize() >= HORIZON) {
          const lastSoldier = soldiers.find(s => s.team === 0);
          let lastObs = null;
          if (lastSoldier && lastSoldier.alive) {
            lastObs = buildObservation(lastSoldier, grid, soldiers, buildings, hq, sim.shieldActive);
          }
          brain.update(lastObs);
        }

        // Skip renderer rebuild inside loop — done once after all ticks
        resetDrillEpisode(true);
        continue;
      }

      // Get observations and actions — all soldiers use THIS soldier's brain
      // (solo drill: only 1 soldier anyway; group drill future: each has own brain)
      const actions = [];

      for (const s of soldiers) {
        if (!s.alive || s.team !== 0) {
          actions.push(7);
          continue;
        }

        const obs = buildObservation(s, grid, soldiers, buildings, hq, sim.shieldActive);
        const prevState = { x: s.x, y: s.y };

        const result = brain.selectAction(obs);
        actions.push(result.action);
        lastEntropy = result.entropy;

        s._currentObs = obs;
        s._logProb = result.logProb;
        s._value = result.value;
        s._prevState = prevState;
      }

      sim.tick(actions);
      totalSteps++;
      stepsSinceUpdate++;

      // Compute rewards and store transitions into THIS soldier's brain buffer
      for (const s of soldiers) {
        if (s.team !== 0) continue;
        if (!s._currentObs) continue;

        const reward = computeReward(
          s, s._prevState, grid, buildings, soldiers, hq,
          sim.done, sim.won, sim.shieldActive
        );
        episodeReward += reward;

        brain.store(
          s._currentObs, s.lastAction, s._logProb, s._value,
          reward, sim.done
        );
      }

      // Mid-episode PPO update
      if (brain.bufferSize() >= HORIZON && !sim.done) {
        const activeSoldier = soldiers.find(s => s.team === 0 && s.alive);
        let lastObs = null;
        if (activeSoldier) {
          lastObs = buildObservation(activeSoldier, grid, soldiers, buildings, hq, sim.shieldActive);
        }
        brain.update(lastObs);
        stepsSinceUpdate = 0;
      }
    }

    // Update visualization — skip when tab is hidden (WebGL can stall)
    const state = sim.getState();
    if (!document.hidden) {
      if (speed > 1) {
        renderer.clear();
        renderer.initFromState(state);
      }
      interpolator.pushState(state);
      renderer.update(state, 1);
      renderer.render();
    }

    // Update dashboard stats
    const winRate = winHistory.length > 0
      ? winHistory.reduce((a, b) => a + b, 0) / winHistory.length
      : 0;

    dashboard.updateStats({
      level: 1,
      maxLevel: 1,
      levelName: trainingDrillName.replace(/_/g, ' '),
      episode,
      step: sim.step,
      totalSteps,
      episodeReward: episodeReward / numTeamSoldiers,
      soldiers: numTeamSoldiers,
      winRate,
      entropy: lastEntropy,
      policyLoss: brain.lastMetrics.policyLoss,
      valueLoss: brain.lastMetrics.valueLoss,
    });

    if (!document.hidden) statusBar.update(state);

    // Auto-save brain every 100 episodes
    if (episode > 0 && episode % 100 === 0) {
      roster.save();
    }
  } catch(e) { console.error('Drill loop error:', e); } }
}

// --- Start ---
init();
