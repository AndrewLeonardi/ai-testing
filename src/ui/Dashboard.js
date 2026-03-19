// Training controls: speed, pause, reset, episode counter.

export class Dashboard {
  constructor(container) {
    this.container = container;
    this.speed = 1;
    this.paused = false;
    this.onSpeedChange = null;
    this.onPauseToggle = null;
    this.onReset = null;
    this.onResetTraining = null;
    this.onGraduate = null;
    this.onRerollWeights = null;

    this._build();
  }

  _build() {
    this.container.innerHTML = `
      <div class="control-group">
        <label>Speed: <span id="speed-label">1x</span></label>
        <input type="range" id="speed-slider" min="0" max="4" step="1" value="0">
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn" id="btn-pause" style="flex:1">PAUSE</button>
        <button class="btn" id="btn-reset" style="flex:1">RESET EP</button>
      </div>
      <button class="btn" id="btn-reset-training" style="width:100%">RESET TRAINING</button>
      <button class="btn" id="btn-reroll" style="width:100%;background:#3a2a1a;color:#ffab40;border-color:#ffab40">REROLL WEIGHTS</button>
      <button class="btn" id="btn-graduate" style="width:100%;background:#1a3a1a;color:#76ff03;border-color:#76ff03">GRADUATE TO LEVEL 2</button>
      <div class="stat-row"><span class="label">Level</span><span class="value" id="stat-level">1</span></div>
      <div class="stat-row"><span class="label">Episode</span><span class="value" id="stat-episode">0</span></div>
      <div class="stat-row"><span class="label">Step</span><span class="value" id="stat-step">0</span></div>
      <div class="stat-row"><span class="label">Total Steps</span><span class="value" id="stat-total-steps">0</span></div>
      <div class="stat-row"><span class="label">Ep Reward</span><span class="value" id="stat-reward">0.00</span></div>
      <div class="stat-row"><span class="label">Win Rate (100)</span><span class="value" id="stat-winrate">0%</span></div>
      <div class="stat-row"><span class="label">Entropy</span><span class="value" id="stat-entropy">-</span></div>
      <div class="stat-row"><span class="label">Policy Loss</span><span class="value" id="stat-ploss">-</span></div>
      <div class="stat-row"><span class="label">Value Loss</span><span class="value" id="stat-vloss">-</span></div>
    `;

    const speedSteps = [1, 5, 20, 50, 100];
    const slider = this.container.querySelector('#speed-slider');
    const label = this.container.querySelector('#speed-label');

    slider.addEventListener('input', () => {
      this.speed = speedSteps[parseInt(slider.value)];
      label.textContent = this.speed + 'x';
      if (this.onSpeedChange) this.onSpeedChange(this.speed);
    });

    this.container.querySelector('#btn-pause').addEventListener('click', () => {
      this.paused = !this.paused;
      this.container.querySelector('#btn-pause').textContent = this.paused ? 'RESUME' : 'PAUSE';
      this.container.querySelector('#btn-pause').classList.toggle('active', this.paused);
      if (this.onPauseToggle) this.onPauseToggle(this.paused);
    });

    this.container.querySelector('#btn-reset').addEventListener('click', () => {
      if (this.onReset) this.onReset();
    });

    this.container.querySelector('#btn-reset-training').addEventListener('click', () => {
      if (this.onResetTraining) this.onResetTraining();
    });

    this.container.querySelector('#btn-reroll').addEventListener('click', () => {
      if (this.onRerollWeights) this.onRerollWeights();
    });

    this.container.querySelector('#btn-graduate').addEventListener('click', () => {
      if (this.onGraduate) this.onGraduate();
    });
  }

  updateStats(stats) {
    const set = (id, val) => {
      const el = this.container.querySelector('#' + id);
      if (el) el.textContent = val;
    };
    if (stats.level !== undefined) set('stat-level', stats.level);
    set('stat-episode', stats.episode);
    set('stat-step', stats.step);
    set('stat-total-steps', stats.totalSteps);
    set('stat-reward', stats.episodeReward.toFixed(2));
    set('stat-winrate', (stats.winRate * 100).toFixed(1) + '%');
    if (stats.entropy !== undefined) set('stat-entropy', stats.entropy.toFixed(4));
    if (stats.policyLoss !== undefined) set('stat-ploss', stats.policyLoss.toFixed(4));
    if (stats.valueLoss !== undefined) set('stat-vloss', stats.valueLoss.toFixed(4));
  }
}
