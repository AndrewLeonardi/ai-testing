// Minimal tensor math for small neural networks. No dependencies.
// All data is Float32Array. Shapes tracked externally.

export function zeros(n) {
  return new Float32Array(n);
}

export function randn(n, scale = 1.0) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2) * scale;
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * u2) * scale;
  }
  return out;
}

// Xavier/Glorot uniform initialization
export function xavierInit(fanIn, fanOut) {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  const n = fanIn * fanOut;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (Math.random() * 2 - 1) * limit;
  }
  return out;
}

// Matrix multiply: A(rows_a x cols_a) * B(cols_a x cols_b) = C(rows_a x cols_b)
export function matmul(a, b, rows_a, cols_a, cols_b) {
  const out = new Float32Array(rows_a * cols_b);
  for (let i = 0; i < rows_a; i++) {
    for (let k = 0; k < cols_a; k++) {
      const aik = a[i * cols_a + k];
      if (aik === 0) continue;
      for (let j = 0; j < cols_b; j++) {
        out[i * cols_b + j] += aik * b[k * cols_b + j];
      }
    }
  }
  return out;
}

// Transpose matmul: A^T(cols_a x rows_a) * B(rows_a x cols_b)
export function matmulTransA(a, b, rows_a, cols_a, cols_b) {
  const out = new Float32Array(cols_a * cols_b);
  for (let k = 0; k < rows_a; k++) {
    for (let i = 0; i < cols_a; i++) {
      const aki = a[k * cols_a + i];
      if (aki === 0) continue;
      for (let j = 0; j < cols_b; j++) {
        out[i * cols_b + j] += aki * b[k * cols_b + j];
      }
    }
  }
  return out;
}

// Matmul with B transposed: A(rows_a x cols_a) * B^T(cols_b x cols_a)
export function matmulTransB(a, b, rows_a, cols_a, cols_b) {
  const out = new Float32Array(rows_a * cols_b);
  for (let i = 0; i < rows_a; i++) {
    for (let j = 0; j < cols_b; j++) {
      let sum = 0;
      for (let k = 0; k < cols_a; k++) {
        sum += a[i * cols_a + k] * b[j * cols_a + k];
      }
      out[i * cols_b + j] = sum;
    }
  }
  return out;
}

// Element-wise add (mutates dst)
export function addInPlace(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] += src[i];
}

// Add bias to each row: out[i*cols+j] += bias[j]
export function addBias(out, bias, rows, cols) {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i * cols + j] += bias[j];
    }
  }
}

// ReLU forward: returns [output, mask]
export function relu(x) {
  const out = new Float32Array(x.length);
  const mask = new Uint8Array(x.length);
  for (let i = 0; i < x.length; i++) {
    if (x[i] > 0) {
      out[i] = x[i];
      mask[i] = 1;
    }
  }
  return [out, mask];
}

// ReLU backward: dInput = dOutput * mask
export function reluBackward(dOut, mask) {
  const dx = new Float32Array(dOut.length);
  for (let i = 0; i < dOut.length; i++) {
    dx[i] = mask[i] ? dOut[i] : 0;
  }
  return dx;
}

// Softmax (numerically stable, per-row for batched)
export function softmax(logits, batchSize, numActions) {
  const out = new Float32Array(logits.length);
  for (let b = 0; b < batchSize; b++) {
    const offset = b * numActions;
    let max = -Infinity;
    for (let i = 0; i < numActions; i++) {
      if (logits[offset + i] > max) max = logits[offset + i];
    }
    let sum = 0;
    for (let i = 0; i < numActions; i++) {
      out[offset + i] = Math.exp(logits[offset + i] - max);
      sum += out[offset + i];
    }
    for (let i = 0; i < numActions; i++) {
      out[offset + i] /= sum;
    }
  }
  return out;
}

// Log-softmax (numerically stable)
export function logSoftmax(logits, batchSize, numActions) {
  const out = new Float32Array(logits.length);
  for (let b = 0; b < batchSize; b++) {
    const offset = b * numActions;
    let max = -Infinity;
    for (let i = 0; i < numActions; i++) {
      if (logits[offset + i] > max) max = logits[offset + i];
    }
    let logSumExp = 0;
    for (let i = 0; i < numActions; i++) {
      logSumExp += Math.exp(logits[offset + i] - max);
    }
    logSumExp = max + Math.log(logSumExp);
    for (let i = 0; i < numActions; i++) {
      out[offset + i] = logits[offset + i] - logSumExp;
    }
  }
  return out;
}

// Sample from categorical distribution (single row of probs)
export function sampleCategorical(probs, offset, numActions) {
  let r = Math.random();
  for (let i = 0; i < numActions; i++) {
    r -= probs[offset + i];
    if (r <= 0) return i;
  }
  return numActions - 1;
}

// Entropy of a probability distribution: -sum(p * log(p))
export function entropy(probs, offset, numActions) {
  let h = 0;
  for (let i = 0; i < numActions; i++) {
    const p = probs[offset + i];
    if (p > 1e-8) h -= p * Math.log(p);
  }
  return h;
}

// Global L2 gradient clipping
export function clipGradNorm(gradArrays, maxNorm) {
  let totalNormSq = 0;
  for (const g of gradArrays) {
    for (let i = 0; i < g.length; i++) {
      totalNormSq += g[i] * g[i];
    }
  }
  const totalNorm = Math.sqrt(totalNormSq);
  if (totalNorm > maxNorm) {
    const scale = maxNorm / totalNorm;
    for (const g of gradArrays) {
      for (let i = 0; i < g.length; i++) {
        g[i] *= scale;
      }
    }
  }
  return totalNorm;
}

// Sum columns (used for bias gradients): sum across rows
export function sumRows(mat, rows, cols) {
  const out = new Float32Array(cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[j] += mat[i * cols + j];
    }
  }
  return out;
}

// Scale array in-place
export function scale(arr, s) {
  for (let i = 0; i < arr.length; i++) arr[i] *= s;
}

// Copy array
export function copy(src) {
  return new Float32Array(src);
}
