// Adam optimizer for neural network training.
// Maintains per-parameter first and second moment estimates.

import { zeros } from './Tensor.js';

export class Adam {
  constructor(network, lr = 3e-4, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-5) {
    this.network = network;
    this.baseLR = lr;
    this.lr = lr;
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.epsilon = epsilon;
    this.t = 0;

    // First moment (mean) and second moment (variance) for each parameter
    this.mWeights = network.weights.map(w => zeros(w.length));
    this.vWeights = network.weights.map(w => zeros(w.length));
    this.mBiases = network.biases.map(b => zeros(b.length));
    this.vBiases = network.biases.map(b => zeros(b.length));
  }

  // Linear LR annealing: lr decreases linearly from baseLR to 0
  setProgress(fraction) {
    this.lr = this.baseLR * (1 - fraction);
  }

  step(weightGrads, biasGrads) {
    this.t++;
    const bc1 = 1 - Math.pow(this.beta1, this.t);
    const bc2 = 1 - Math.pow(this.beta2, this.t);

    for (let l = 0; l < this.network.weights.length; l++) {
      this._updateParam(
        this.network.weights[l], weightGrads[l],
        this.mWeights[l], this.vWeights[l], bc1, bc2
      );
      this._updateParam(
        this.network.biases[l], biasGrads[l],
        this.mBiases[l], this.vBiases[l], bc1, bc2
      );
    }
  }

  _updateParam(param, grad, m, v, bc1, bc2) {
    for (let i = 0; i < param.length; i++) {
      m[i] = this.beta1 * m[i] + (1 - this.beta1) * grad[i];
      v[i] = this.beta2 * v[i] + (1 - this.beta2) * grad[i] * grad[i];
      const mHat = m[i] / bc1;
      const vHat = v[i] / bc2;
      param[i] -= this.lr * mHat / (Math.sqrt(vHat) + this.epsilon);
    }
  }
}
