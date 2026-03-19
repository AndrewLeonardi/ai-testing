// Interpolates between simulation ticks for smooth 60fps rendering.

export class Interpolator {
  constructor() {
    this.prevState = null;
    this.currState = null;
    this.tickTime = 0;
    this.tickInterval = 100; // ms per sim tick at 1x speed
  }

  pushState(state) {
    this.prevState = this.currState;
    this.currState = state;
    this.tickTime = 0;
  }

  // Returns interpolation alpha (0 = prev state, 1 = current state)
  getAlpha(dtMs) {
    this.tickTime += dtMs;
    return Math.min(1, this.tickTime / this.tickInterval);
  }

  getCurrentState() {
    return this.currState;
  }
}
