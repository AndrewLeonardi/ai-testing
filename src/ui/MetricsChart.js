// Simple canvas-based chart for training metrics.

export class MetricsChart {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'metrics-canvas';
    this.canvas.width = 280;
    this.canvas.height = 150;
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Add label
    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;color:#8bc34a;text-align:center;margin-top:4px;';
    label.textContent = 'EPISODE REWARD (50-ep avg)';
    this.container.appendChild(label);

    // Entropy chart
    this.entropyCanvas = document.createElement('canvas');
    this.entropyCanvas.className = 'metrics-canvas';
    this.entropyCanvas.width = 280;
    this.entropyCanvas.height = 100;
    this.container.appendChild(this.entropyCanvas);
    this.entropyCtx = this.entropyCanvas.getContext('2d');

    const entropyLabel = document.createElement('div');
    entropyLabel.style.cssText = 'font-size:10px;color:#8bc34a;text-align:center;margin-top:4px;';
    entropyLabel.textContent = 'ENTROPY (confidence)';
    this.container.appendChild(entropyLabel);

    this.rewardHistory = [];
    this.entropyHistory = [];
    this.maxPoints = 500;
  }

  addPoint(reward, entropy) {
    this.rewardHistory.push(reward);
    if (this.rewardHistory.length > this.maxPoints) this.rewardHistory.shift();
    if (entropy !== undefined) {
      this.entropyHistory.push(entropy);
      if (this.entropyHistory.length > this.maxPoints) this.entropyHistory.shift();
    }
    this._draw();
  }

  _draw() {
    this._drawChart(this.ctx, this.canvas, this.rewardHistory, '#4caf50', '#0a2a0a');
    if (this.entropyHistory.length > 0) {
      this._drawChart(this.entropyCtx, this.entropyCanvas, this.entropyHistory, '#ff9800', '#0a2a0a');
    }
  }

  _drawChart(ctx, canvas, data, color, bg) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (data.length < 2) return;

    // Rolling average
    const windowSize = Math.min(50, Math.floor(data.length / 2)) || 1;
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        sum += data[j];
        count++;
      }
      smoothed.push(sum / count);
    }

    let min = Infinity, max = -Infinity;
    for (const v of smoothed) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max === min) { max += 1; min -= 1; }

    const pad = 4;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // Zero line
    if (min < 0 && max > 0) {
      const zy = pad + plotH * (1 - (0 - min) / (max - min));
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(pad, zy);
      ctx.lineTo(w - pad, zy);
      ctx.stroke();
    }

    // Data line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < smoothed.length; i++) {
      const x = pad + (i / (smoothed.length - 1)) * plotW;
      const y = pad + plotH * (1 - (smoothed[i] - min) / (max - min));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Raw data (faint)
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad + (i / (data.length - 1)) * plotW;
      const y = pad + plotH * (1 - (data[i] - min) / (max - min));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.fillText(max.toFixed(1), pad, pad + 8);
    ctx.fillText(min.toFixed(1), pad, h - pad);
  }
}
