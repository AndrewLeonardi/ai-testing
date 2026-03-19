// Main entry point: wires Simulation, ML, and Visualization together.

import { createLevel1, createLevel2, getHQ } from './sim/Scenario.js';
import { SimLoop } from './sim/SimLoop.js';
import { PPO } from './ml/PPO.js';
import { buildObservation } from './ml/Observations.js';
import { computeReward } from './ml/Rewards.js';
import { Renderer } from './viz/Renderer.js';
import { Interpolator } from './viz/Interpolator.js';
import { Dashboard } from './ui/Dashboard.js';
import { MetricsChart } from './ui/MetricsChart.js';
import { StatusBar } from './ui/StatusBar.js';

// --- State ---
let sim, grid, soldiers, buildings, hq;
let agent;
let renderer, interpolator;
let dashboard, metricsChart, statusBar;

// Training stats
let episode = 0;
let totalSteps = 0;
let episodeReward = 0;
let speed = 1;
let paused = false;
let winHistory = []; // last 100 episode results
const HORIZON = 128; // PPO update every N steps
let stepsSinceUpdate = 0;
let lastEntropy = 0;
let currentLevel = 1;
const AUTO_GRADUATE_WINRATE = 0.8; // auto-graduate at 80% win rate
const AUTO_GRADUATE_MIN_EPISODES = 100; // need at least 100 episodes before auto-graduation

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

  // Start game loop
  requestAnimationFrame(gameLoop);
}

function graduate() {
  if (currentLevel >= 2) return; // already at max
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
  const scenario = currentLevel === 1 ? createLevel1() : createLevel2();
  grid = scenario.grid;
  soldiers = scenario.soldiers;
  buildings = scenario.buildings;
  hq = scenario.hq;
  sim = new SimLoop(grid, soldiers, buildings, hq);
  episodeReward = 0;

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

  metricsChart.addPoint(episodeReward, lastEntropy);
}

// --- Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (paused) {
    // Still render
    renderer.render();
    return;
  }

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

  // Auto-graduate check
  if (currentLevel < 2 && winHistory.length >= AUTO_GRADUATE_MIN_EPISODES && winRate >= AUTO_GRADUATE_WINRATE) {
    graduate();
  }

  dashboard.updateStats({
    level: currentLevel,
    episode,
    step: sim.step,
    totalSteps,
    episodeReward,
    winRate,
    entropy: lastEntropy,
    policyLoss: agent.lastMetrics.policyLoss,
    valueLoss: agent.lastMetrics.valueLoss,
  });

  statusBar.update(state);
}

// --- Start ---
init();
