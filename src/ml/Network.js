// Simple feedforward neural network with manual backprop.
// Supports batched forward/backward for PPO minibatch updates.

import {
  xavierInit, zeros, matmul, matmulTransA, matmulTransB,
  addBias, relu, reluBackward, softmax, logSoftmax,
  sumRows, copy
} from './Tensor.js';

export class Network {
  constructor(layerSizes, outputType = 'softmax') {
    // layerSizes e.g. [108, 64, 32, 8]
    this.layerSizes = layerSizes;
    this.outputType = outputType; // 'softmax' for policy, 'linear' for value
    this.numLayers = layerSizes.length - 1;

    // Initialize weights and biases
    this.weights = [];
    this.biases = [];
    for (let l = 0; l < this.numLayers; l++) {
      const fanIn = layerSizes[l];
      const fanOut = layerSizes[l + 1];
      // Last layer of policy uses small init for near-uniform initial distribution
      const isLastPolicy = (l === this.numLayers - 1 && outputType === 'softmax');
      if (isLastPolicy) {
        const w = xavierInit(fanIn, fanOut);
        for (let i = 0; i < w.length; i++) w[i] *= 0.01;
        this.weights.push(w);
      } else {
        this.weights.push(xavierInit(fanIn, fanOut));
      }
      this.biases.push(zeros(fanOut));
    }
  }

  // Forward pass (batched). input: Float32Array of batchSize * inputSize
  // Returns { output, cache } where cache is needed for backward
  forward(input, batchSize) {
    const cache = { inputs: [input], preActs: [], reluMasks: [] };
    let x = input;

    for (let l = 0; l < this.numLayers; l++) {
      const inSize = this.layerSizes[l];
      const outSize = this.layerSizes[l + 1];

      // Linear: z = x * W + b
      const z = matmul(x, this.weights[l], batchSize, inSize, outSize);
      addBias(z, this.biases[l], batchSize, outSize);
      cache.preActs.push(z);

      if (l < this.numLayers - 1) {
        // Hidden layer: ReLU
        const [activated, mask] = relu(z);
        cache.reluMasks.push(mask);
        cache.inputs.push(activated);
        x = activated;
      } else {
        // Output layer
        if (this.outputType === 'softmax') {
          // Return raw logits - softmax applied externally for numerical stability
          cache.inputs.push(z);
          x = z;
        } else {
          cache.inputs.push(z);
          x = z;
        }
      }
    }

    return { output: x, cache };
  }

  // Backward pass. dOutput: gradient w.r.t. output (batchSize * outputSize)
  // Returns { weightGrads, biasGrads } arrays matching this.weights/biases
  backward(dOutput, cache, batchSize) {
    const weightGrads = [];
    const biasGrads = [];
    let dx = dOutput;

    for (let l = this.numLayers - 1; l >= 0; l--) {
      const inSize = this.layerSizes[l];
      const outSize = this.layerSizes[l + 1];

      // If not last layer, backprop through ReLU
      if (l < this.numLayers - 1) {
        dx = reluBackward(dx, cache.reluMasks[l]);
      }

      // Gradient w.r.t. weights: input^T * dx
      const layerInput = cache.inputs[l];
      const dW = matmulTransA(layerInput, dx, batchSize, inSize, outSize);

      // Gradient w.r.t. bias: sum of dx across batch
      const dB = sumRows(dx, batchSize, outSize);

      // Note: caller is responsible for mean-reduction (dividing by batchSize)
      weightGrads.unshift(dW);
      biasGrads.unshift(dB);

      // Gradient w.r.t. input (for next layer back): dx * W^T
      if (l > 0) {
        dx = matmulTransB(dx, this.weights[l], batchSize, outSize, inSize);
      }
    }

    return { weightGrads, biasGrads };
  }

  // Get all parameters as flat arrays (for gradient clipping)
  getParamArrays() {
    return [...this.weights, ...this.biases];
  }

  // Clone weights (for parameter sharing / checkpointing)
  cloneWeights() {
    return {
      weights: this.weights.map(w => copy(w)),
      biases: this.biases.map(b => copy(b)),
    };
  }

  loadWeights(saved) {
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i].set(saved.weights[i]);
    }
    for (let i = 0; i < this.biases.length; i++) {
      this.biases[i].set(saved.biases[i]);
    }
  }

  // Count total parameters
  paramCount() {
    let count = 0;
    for (const w of this.weights) count += w.length;
    for (const b of this.biases) count += b.length;
    return count;
  }
}
