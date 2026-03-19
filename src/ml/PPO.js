// PPO-Clip agent with separate policy and value networks.
// Trajectory collection, GAE advantage estimation, clipped surrogate loss.

import { Network } from './Network.js';
import { Adam } from './Adam.js';
import {
  softmax, logSoftmax, sampleCategorical, entropy,
  clipGradNorm, zeros, copy
} from './Tensor.js';
import { OBS_SIZE } from './Observations.js';
import { NUM_ACTIONS } from '../sim/Soldier.js';
import { BALANCE } from '../game/Balance.js';

// Hyperparameters — from Balance.js single source of truth
const GAMMA = BALANCE.PPO.gamma;
const LAMBDA = BALANCE.PPO.lambda;
const CLIP_EPSILON = BALANCE.PPO.clipEpsilon;
const ENTROPY_COEFF = BALANCE.PPO.entropyCoeff;
const VALUE_COEFF = BALANCE.PPO.valueCoeff;
const EPOCHS = BALANCE.PPO.epochs;
const MINIBATCH_SIZE = BALANCE.PPO.minibatchSize;
const MAX_GRAD_NORM = BALANCE.PPO.maxGradNorm;

export class PPO {
  constructor() {
    // Policy network: obs -> action probabilities
    const layers = BALANCE.PPO.networkLayers;
    this.policy = new Network([OBS_SIZE, ...layers, NUM_ACTIONS], 'softmax');
    // Value network: obs -> state value
    this.value = new Network([OBS_SIZE, ...layers, 1], 'linear');

    this.policyOpt = new Adam(this.policy, BALANCE.PPO.learningRate);
    this.valueOpt = new Adam(this.value, BALANCE.PPO.learningRate);

    // Trajectory buffer
    this.observations = [];
    this.actions = [];
    this.logProbs = [];
    this.values = [];
    this.rewards = [];
    this.dones = [];

    // Metrics
    this.lastMetrics = {
      policyLoss: 0, valueLoss: 0, entropy: 0, approxKL: 0,
    };
    this.totalUpdates = 0;
  }

  // Select action for a single observation
  selectAction(obs) {
    // Forward pass (batch size 1)
    const { output: logits } = this.policy.forward(obs, 1);
    const probs = softmax(logits, 1, NUM_ACTIONS);
    const lp = logSoftmax(logits, 1, NUM_ACTIONS);

    // Sample action
    const action = sampleCategorical(probs, 0, NUM_ACTIONS);

    // Get value estimate
    const { output: val } = this.value.forward(obs, 1);

    // Compute entropy for metrics
    const ent = entropy(probs, 0, NUM_ACTIONS);

    return {
      action,
      logProb: lp[action],
      value: val[0],
      entropy: ent,
      probs: Array.from(probs),
    };
  }

  // Store a transition
  store(obs, action, logProb, value, reward, done) {
    this.observations.push(copy(obs));
    this.actions.push(action);
    this.logProbs.push(logProb);
    this.values.push(value);
    this.rewards.push(reward);
    this.dones.push(done ? 1 : 0);
  }

  // Get number of stored transitions
  bufferSize() {
    return this.observations.length;
  }

  // Clear buffer (used on level graduation to avoid stale data)
  clearBuffer() {
    this.observations = [];
    this.actions = [];
    this.logProbs = [];
    this.values = [];
    this.rewards = [];
    this.dones = [];
  }

  // Compute GAE advantages and returns
  _computeGAE(lastValue) {
    const T = this.rewards.length;
    const advantages = new Float32Array(T);
    const returns = new Float32Array(T);

    let lastGAE = 0;
    for (let t = T - 1; t >= 0; t--) {
      const nextValue = t === T - 1 ? lastValue : this.values[t + 1];
      const nextDone = t === T - 1 ? 0 : this.dones[t + 1];

      const delta = this.rewards[t] + GAMMA * nextValue * (1 - this.dones[t]) - this.values[t];
      lastGAE = delta + GAMMA * LAMBDA * (1 - this.dones[t]) * lastGAE;
      advantages[t] = lastGAE;
      returns[t] = advantages[t] + this.values[t];
    }

    return { advantages, returns };
  }

  // Run PPO update on collected trajectories
  update(lastObs) {
    const T = this.bufferSize();
    if (T === 0) return;

    // Get bootstrap value for last state
    let lastValue = 0;
    if (lastObs) {
      const { output } = this.value.forward(lastObs, 1);
      lastValue = output[0];
    }

    const { advantages, returns } = this._computeGAE(lastValue);

    // Convert trajectory to batched arrays
    const allObs = new Float32Array(T * OBS_SIZE);
    for (let t = 0; t < T; t++) {
      allObs.set(this.observations[t], t * OBS_SIZE);
    }
    const allActions = new Int32Array(this.actions);
    const allOldLogProbs = new Float32Array(this.logProbs);

    let totalPolicyLoss = 0;
    let totalValueLoss = 0;
    let totalEntropy = 0;
    let totalKL = 0;
    let updateCount = 0;

    for (let epoch = 0; epoch < EPOCHS; epoch++) {
      // Shuffle indices
      const indices = Array.from({ length: T }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Process minibatches
      for (let start = 0; start < T; start += MINIBATCH_SIZE) {
        const end = Math.min(start + MINIBATCH_SIZE, T);
        const mbSize = end - start;

        // Gather minibatch data
        const mbObs = new Float32Array(mbSize * OBS_SIZE);
        const mbActions = new Int32Array(mbSize);
        const mbOldLogProbs = new Float32Array(mbSize);
        const mbAdvantages = new Float32Array(mbSize);
        const mbReturns = new Float32Array(mbSize);

        for (let i = 0; i < mbSize; i++) {
          const idx = indices[start + i];
          mbObs.set(allObs.subarray(idx * OBS_SIZE, (idx + 1) * OBS_SIZE), i * OBS_SIZE);
          mbActions[i] = allActions[idx];
          mbOldLogProbs[i] = allOldLogProbs[idx];
          mbAdvantages[i] = advantages[idx];
          mbReturns[i] = returns[idx];
        }

        // Normalize advantages within minibatch
        let advMean = 0, advVar = 0;
        for (let i = 0; i < mbSize; i++) advMean += mbAdvantages[i];
        advMean /= mbSize;
        for (let i = 0; i < mbSize; i++) advVar += (mbAdvantages[i] - advMean) ** 2;
        advVar /= mbSize;
        const advStd = Math.sqrt(advVar) + 1e-8;
        for (let i = 0; i < mbSize; i++) {
          mbAdvantages[i] = (mbAdvantages[i] - advMean) / advStd;
        }

        // --- Policy update ---
        const { output: logits, cache: policyCache } = this.policy.forward(mbObs, mbSize);
        const newLogProbs = logSoftmax(logits, mbSize, NUM_ACTIONS);
        const newProbs = softmax(logits, mbSize, NUM_ACTIONS);

        // Compute per-sample policy loss
        const policyDOutput = new Float32Array(mbSize * NUM_ACTIONS);
        let batchPolicyLoss = 0;
        let batchEntropy = 0;
        let batchKL = 0;

        for (let i = 0; i < mbSize; i++) {
          const a = mbActions[i];
          const offset = i * NUM_ACTIONS;
          const newLP = newLogProbs[offset + a];
          const oldLP = mbOldLogProbs[i];
          const adv = mbAdvantages[i];

          const ratio = Math.exp(newLP - oldLP);
          const clippedRatio = Math.max(1 - CLIP_EPSILON, Math.min(1 + CLIP_EPSILON, ratio));
          const surr1 = ratio * adv;
          const surr2 = clippedRatio * adv;
          const pLoss = -Math.min(surr1, surr2);

          // Entropy bonus
          let ent = 0;
          for (let j = 0; j < NUM_ACTIONS; j++) {
            const p = newProbs[offset + j];
            if (p > 1e-8) ent -= p * Math.log(p);
          }

          batchPolicyLoss += pLoss;
          batchEntropy += ent;
          batchKL += oldLP - newLP;

          // Gradient of loss w.r.t. logits
          // Loss = -min(r*A, clip(r)*A), we want dLoss/dLogit
          // When unclipped: dLoss/dLogit_j = -A * r * (1_{j=a} - p_j)
          // When clipped: gradient is 0 (clipping blocks gradient flow)
          const useClipped = (surr2 < surr1); // min selected the clipped version
          const gradMultiplier = useClipped ? 0 : (-adv * ratio);

          for (let j = 0; j < NUM_ACTIONS; j++) {
            const p = newProbs[offset + j];
            const indicator = (j === a) ? 1 : 0;
            // Policy gradient: d(-min(surr1,surr2))/d(logit_j)
            policyDOutput[offset + j] = gradMultiplier * (indicator - p) / mbSize;

            // Entropy regularization: maximize entropy = minimize -entropy
            // d(-H)/d(logit_j) ≈ p_j * (log(p_j) + 1)
            // Subtract to maximize entropy (add -coeff * dH/dlogit)
            const logP = Math.log(p + 1e-8);
            const entropyGrad = p * (logP + 1);
            policyDOutput[offset + j] += ENTROPY_COEFF * entropyGrad / mbSize;
          }
        }

        batchPolicyLoss /= mbSize;
        batchEntropy /= mbSize;
        batchKL /= mbSize;

        // Backprop policy
        const { weightGrads: pWG, biasGrads: pBG } = this.policy.backward(
          policyDOutput, policyCache, mbSize
        );

        // --- Value update ---
        const { output: values, cache: valueCache } = this.value.forward(mbObs, mbSize);
        const valueDOutput = new Float32Array(mbSize);
        let batchValueLoss = 0;

        for (let i = 0; i < mbSize; i++) {
          const vErr = values[i] - mbReturns[i];
          batchValueLoss += vErr * vErr;
          valueDOutput[i] = 2 * VALUE_COEFF * vErr / mbSize;
        }
        batchValueLoss /= mbSize;

        const { weightGrads: vWG, biasGrads: vBG } = this.value.backward(
          valueDOutput, valueCache, mbSize
        );

        // Clip gradients
        clipGradNorm([...pWG, ...pBG], MAX_GRAD_NORM);
        clipGradNorm([...vWG, ...vBG], MAX_GRAD_NORM);

        // Adam steps
        this.policyOpt.step(pWG, pBG);
        this.valueOpt.step(vWG, vBG);

        totalPolicyLoss += batchPolicyLoss;
        totalValueLoss += batchValueLoss;
        totalEntropy += batchEntropy;
        totalKL += batchKL;
        updateCount++;
      }
    }

    this.totalUpdates++;
    this.lastMetrics = {
      policyLoss: totalPolicyLoss / updateCount,
      valueLoss: totalValueLoss / updateCount,
      entropy: totalEntropy / updateCount,
      approxKL: totalKL / updateCount,
    };

    // Clear buffer
    this.clearBuffer();

    return this.lastMetrics;
  }

  clearBuffer() {
    this.observations = [];
    this.actions = [];
    this.logProbs = [];
    this.values = [];
    this.rewards = [];
    this.dones = [];
  }

  // For checkpointing
  save() {
    return {
      policy: this.policy.cloneWeights(),
      value: this.value.cloneWeights(),
    };
  }

  load(saved) {
    this.policy.loadWeights(saved.policy);
    this.value.loadWeights(saved.value);
  }
}
