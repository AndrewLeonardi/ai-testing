// Main entry point: wires Simulation, ML, and Visualization together.

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
import { BALANCE } from './game/Balance.js';

// --- State ---
let sim, grid, soldiers, buildings, hq;
let agent;
let renderer, interpolator;
let dashboard, metricsChart, statusBar;
let editor = null;

// Mode: 'train' | 'edit' | 'test'
let mode = 'train';
let testLayout = null; // layout being tested

// Training stats
let episode = 0;
let totalSteps = 0;
let episodeReward = 0;
let speed = 1;
let paused = false;
let winHistory = []; // last 100 episode results
const HORIZON = BALANCE.PPO.horizon; // PPO update every N steps
let stepsSinceUpdate = 0;
let lastEntropy = 0;
let currentLevel = 1;
let numTeamSoldiers = 1; // tracks team=0 soldier count for reward normalization

// --- Init ---
function init() {
  // Create PPO agent
  agent = new PPO();

  // Setup first episode
  resetEpisode();

  // Renderer
  const canvas = document.getElementById('game-canvas');
  renderer = new Renderer(canvas);
  const state = sim.getState();
  renderer.initFromState(state);
  interpolator = new Interpolator();
  interpolator.pushState(state);

  // UI
  dashboard = new Dashboard(document.getElementById('controls'));
  metricsChart = new MetricsChart(document.getElementById('metrics'));
  statusBar = new StatusBar(document.getElementById('status'));

  dashboard.onSpeedChange = (s) => { speed = s; };
  dashboard.onPauseToggle = (p) => { paused = p; };
  dashboard.onReset = () => { endEpisode(false); resetEpisode(); };
  dashboard.onGraduate = () => { graduate(); };
  dashboard.onRerollWeights = () => {
    agent = new PPO();
    winHistory = [];
    stepsSinceUpdate = 0;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    // Keep level, keep episode count — just re-randomize the network
    resetEpisode();
    console.log(`Rerolled weights on Level ${currentLevel}. Fresh random init.`);
  };
  dashboard.onResetTraining = () => {
    agent = new PPO();
    episode = 0;
    totalSteps = 0;
    winHistory = [];
    stepsSinceUpdate = 0;
    currentLevel = 1;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    resetEpisode();
  };
  dashboard.onValidateTransfer = () => { runTransferValidation(); };

  // Mode toggle button — lives in #dashboard above controls
  const modeBtn = document.createElement('button');
  modeBtn.id = 'btn-mode-toggle';
  modeBtn.className = 'btn';
  modeBtn.style.cssText = 'width:100%;background:#1a2a3a;color:#ff9800;border-color:#ff9800;font-size:14px;padding:10px;margin-bottom:8px';
  modeBtn.textContent = 'EDIT BASE';
  modeBtn.addEventListener('click', () => {
    if (mode === 'train') enterEditMode();
    else if (mode === 'edit') exitEditMode();
  });
  const dashboardEl = document.getElementById('dashboard');
  dashboardEl.insertBefore(modeBtn, document.getElementById('controls'));

  // Start game loop
  requestAnimationFrame(gameLoop);
}

// --- Mode switching ---
function enterEditMode() {
  mode = 'edit';
  paused = true;
  renderer.clear();

  // Hide metrics and status during edit
  document.getElementById('metrics').style.display = 'none';
  document.getElementById('status').style.display = 'none';

  const modeBtn = document.getElementById('btn-mode-toggle');
  modeBtn.textContent = 'BACK TO TRAINING';
  modeBtn.style.background = '#2a5a2a';
  modeBtn.style.color = '#8bc34a';
  modeBtn.style.borderColor = '#4caf50';

  const controlsEl = document.getElementById('controls');
  editor = new BaseEditor(controlsEl, renderer, onTestLayout, exitEditMode);
}

function exitEditMode() {
  mode = 'train';
  if (editor) {
    editor.dispose();
    editor = null;
  }
  renderer.clear();

  // Restore metrics and status
  document.getElementById('metrics').style.display = '';
  document.getElementById('status').style.display = '';

  const modeBtn = document.getElementById('btn-mode-toggle');
  modeBtn.textContent = 'EDIT BASE';
  modeBtn.style.background = '#1a2a3a';
  modeBtn.style.color = '#ff9800';
  modeBtn.style.borderColor = '#ff9800';

  // Rebuild dashboard
  const controlsEl = document.getElementById('controls');
  dashboard = new Dashboard(controlsEl);
  dashboard.onSpeedChange = (s) => { speed = s; };
  dashboard.onPauseToggle = (p) => { paused = p; };
  dashboard.onReset = () => { endEpisode(false); resetEpisode(); };
  dashboard.onGraduate = () => { graduate(); };
  dashboard.onRerollWeights = () => {
    agent = new PPO();
    winHistory = [];
    stepsSinceUpdate = 0;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    resetEpisode();
  };
  dashboard.onResetTraining = () => {
    agent = new PPO();
    episode = 0;
    totalSteps = 0;
    winHistory = [];
    stepsSinceUpdate = 0;
    currentLevel = 1;
    metricsChart.rewardHistory = [];
    metricsChart.entropyHistory = [];
    resetEpisode();
  };
  dashboard.onValidateTransfer = () => { runTransferValidation(); };

  paused = false;
  resetEpisode();
}

function onTestLayout(layout) {
  mode = 'test';
  testLayout = layout;

  // Hide the editor, show a minimal test UI
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
    // Return to editor
    mode = 'edit';
    renderer.clear();
    const controlsEl2 = document.getElementById('controls');
    editor = new BaseEditor(controlsEl2, renderer, onTestLayout, exitEditMode);
  });

  // Setup scenario from layout
  if (editor) { editor.dispose(); editor = null; }
  renderer.clear();

  const scenario = createFromLayout(layout);
  grid = scenario.grid;
  soldiers = scenario.soldiers;
  buildings = scenario.buildings;
  hq = scenario.hq;
  sim = new SimLoop(grid, soldiers, buildings, hq);

  renderer.initFromState(sim.getState());
  interpolator = new Interpolator();
  interpolator.pushState(sim.getState());
  paused = false;
}

function graduate() {
  if (currentLevel >= LEVELS.length) return; // already at max
  currentLevel++;
  // Keep the agent — weights transfer!
  // Reset episode tracking for new level
  episode = 0;
  winHistory = [];
  // Clear PPO buffer to avoid stale transitions from old scenario
  agent.clearBuffer();
  stepsSinceUpdate = 0;
  metricsChart.rewardHistory = [];
  metricsChart.entropyHistory = [];
  resetEpisode();
  console.log(`Graduated to Level ${currentLevel}! Weights preserved.`);
}

function resetEpisode() {
  const levelDef = LEVELS[currentLevel - 1];
  const scenario = levelDef.factory();
  grid = scenario.grid;
  soldiers = scenario.soldiers;
  buildings = scenario.buildings;
  hq = scenario.hq;
  sim = new SimLoop(grid, soldiers, buildings, hq, levelDef.maxSteps);
  episodeReward = 0;
  numTeamSoldiers = soldiers.filter(s => s.team === 0).length;

  if (renderer) {
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

// --- Transfer Validation ---
// Freezes weights, runs 100 episodes on fresh random layouts (no training).
// Proves skill TRANSFER: did the agent learn "mine avoidance" or "this specific path"?
function runTransferValidation() {
  const savedPaused = paused;
  paused = true;

  const VALIDATION_EPISODES = 100;
  let wins = 0;

  const levelDef = LEVELS[currentLevel - 1];

  for (let ep = 0; ep < VALIDATION_EPISODES; ep++) {
    // Fresh random layout each episode
    const scenario = levelDef.factory();
    const vGrid = scenario.grid;
    const vSoldiers = scenario.soldiers;
    const vBuildings = scenario.buildings;
    const vHq = scenario.hq;
    const vSim = new SimLoop(vGrid, vSoldiers, vBuildings, vHq, levelDef.maxSteps);

    // Run episode with frozen weights (inference only, no learning)
    while (!vSim.done) {
      const actions = [];
      for (const s of vSoldiers) {
        if (!s.alive || s.team !== 0) {
          actions.push(7); // STAY
          continue;
        }
        const obs = buildObservation(s, vGrid, vSoldiers, vBuildings, vHq, vSim.shieldActive);
        const result = agent.selectAction(obs);
        actions.push(result.action);
      }
      vSim.tick(actions);
    }

    if (vSim.won) wins++;
  }

  const transferRate = (wins / VALIDATION_EPISODES * 100).toFixed(1);
  const status = wins / VALIDATION_EPISODES >= 0.7 ? 'PASS' : (wins / VALIDATION_EPISODES >= 0.5 ? 'PARTIAL' : 'FAIL');

  console.log(`Transfer Validation: ${wins}/${VALIDATION_EPISODES} wins (${transferRate}%) — ${status}`);
  alert(`Transfer Validation (Level ${currentLevel})\n\n${wins}/${VALIDATION_EPISODES} wins (${transferRate}%)\n\nStatus: ${status}\n\n${status === 'PASS' ? 'Skill transfer PROVEN! Ready to graduate.' : status === 'PARTIAL' ? 'Partial transfer. More training may help.' : 'Agent is memorizing, not generalizing. Investigate.'}`);

  paused = savedPaused;
}

// --- Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (mode === 'edit') {
    // Editor handles its own rendering
    return;
  }

  if (paused) {
    renderer.render();
    return;
  }

  // Test mode: inference only, one episode
  if (mode === 'test') {
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
        const result = agent.selectAction(obs);
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

  // --- Training mode ---
  // Run simulation ticks based on speed
  const ticksThisFrame = speed;
  for (let t = 0; t < ticksThisFrame; t++) {
    if (sim.done) {
      // End episode, start new one
      endEpisode(sim.won);

      // If enough steps, trigger PPO update
      if (agent.bufferSize() >= HORIZON) {
        const lastSoldier = soldiers.find(s => s.team === 0);
        let lastObs = null;
        if (lastSoldier && lastSoldier.alive) {
          lastObs = buildObservation(lastSoldier, grid, soldiers, buildings, hq, sim.shieldActive);
        }
        agent.update(lastObs);
      }

      resetEpisode();
      continue;
    }

    // Get observations and actions for each soldier
    const actions = [];
    const prevStates = [];

    for (const s of soldiers) {
      if (!s.alive || s.team !== 0) {
        actions.push(7); // STAY for dead/defender soldiers
        prevStates.push(null);
        continue;
      }

      const obs = buildObservation(s, grid, soldiers, buildings, hq, sim.shieldActive);
      const prevState = { x: s.x, y: s.y };
      prevStates.push(prevState);

      const result = agent.selectAction(obs);
      actions.push(result.action);
      lastEntropy = result.entropy;

      // Store previous obs (we'll compute reward after tick)
      s._currentObs = obs;
      s._logProb = result.logProb;
      s._value = result.value;
      s._prevState = prevState;
    }

    // Execute simulation tick
    sim.tick(actions);
    totalSteps++;
    stepsSinceUpdate++;

    // Compute rewards and store transitions
    for (const s of soldiers) {
      if (s.team !== 0) continue;
      if (!s._currentObs) continue;

      const reward = computeReward(
        s, s._prevState, grid, buildings, soldiers, hq,
        sim.done, sim.won, sim.shieldActive
      );
      episodeReward += reward;

      agent.store(
        s._currentObs, s.lastAction, s._logProb, s._value,
        reward, sim.done
      );
    }

    // PPO update check (mid-episode updates)
    if (agent.bufferSize() >= HORIZON && !sim.done) {
      const activeSoldier = soldiers.find(s => s.team === 0 && s.alive);
      let lastObs = null;
      if (activeSoldier) {
        lastObs = buildObservation(activeSoldier, grid, soldiers, buildings, hq, sim.shieldActive);
      }
      agent.update(lastObs);
      stepsSinceUpdate = 0;
    }
  }

  // Update visualization (only for last state to avoid overhead at high speed)
  const state = sim.getState();
  interpolator.pushState(state);
  const alpha = interpolator.getAlpha(dt);
  renderer.update(state, alpha);
  renderer.render();

  // Update UI
  const winRate = winHistory.length > 0
    ? winHistory.reduce((a, b) => a + b, 0) / winHistory.length
    : 0;

  // No auto-graduation — player validates transfer and graduates manually

  dashboard.updateStats({
    level: currentLevel,
    maxLevel: LEVELS.length,
    levelName: LEVELS[currentLevel - 1].name,
    episode,
    step: sim.step,
    totalSteps,
    episodeReward: episodeReward / numTeamSoldiers,
    soldiers: numTeamSoldiers,
    winRate,
    entropy: lastEntropy,
    policyLoss: agent.lastMetrics.policyLoss,
    valueLoss: agent.lastMetrics.valueLoss,
  });

  statusBar.update(state);
}

// --- Start ---
init();
