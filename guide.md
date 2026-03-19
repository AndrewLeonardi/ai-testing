# How the ML Works: A Complete Guide

## The Big Picture

A neural network controls the soldier. Every tick (10 times per second), the network looks at what the soldier can see, and picks one of 8 actions. After many episodes of trial and error, the network's weights shift so that it picks BETTER actions — actions that lead to winning.

No human ever tells the soldier "go left here" or "shoot now." The soldier discovers strategy entirely through reward signals.

```
OBSERVE → DECIDE → ACT → GET REWARD → LEARN → REPEAT
```

## Step 1: What the Soldier Sees (Observations)

**File: `src/ml/Observations.js`**

Every tick, we build a 145-number vector that describes the world from the soldier's perspective. This is the neural network's ONLY input.

### The 5x5 Egocentric Grid (125 numbers)

Imagine the soldier looking forward. We take a 5x5 window of the grid centered on the soldier, rotated so "forward" is always "up" regardless of which direction the soldier is actually facing.

This window has 5 channels (layers), each 25 numbers (5x5):

| Channel | What It Encodes | Values |
|---------|----------------|--------|
| 0: Obstacles | Walls, shields, out-of-bounds | 1.0 = blocked, 0.0 = clear |
| 1: Enemies | Enemy soldiers in view | 1.0 = enemy here |
| 2: Allies | Friendly soldiers in view | 1.0 = ally here |
| 3: Buildings | HQ, cannons in view | 1.0 = building here |
| 4: Mines | Mines in view | 1.0 = mine here |

**Why egocentric?** If we used absolute coordinates, the network would need to learn "go to (16, 18)" which is brittle. With egocentric view, the network learns "move toward the thing in front-left" which generalizes to any position.

### Scalar Features (20 numbers)

Beyond the local view, the soldier gets global context:

```
scalars[0]  = HP / maxHP                    → How healthy am I? (0 to 1)
scalars[1]  = ammo / maxAmmo                → How much ammo left? (0 to 1)
scalars[2]  = ducking ? 1 : 0               → Am I ducking?
scalars[3]  = sin(facing)                   → Which way am I facing (sin component)
scalars[4]  = cos(facing)                   → Which way am I facing (cos component)
scalars[5]  = distance_to_HQ / maxDist      → How far is the target? (0 to 1)
scalars[6]  = sin(relative_angle_to_HQ)     → HQ compass: sin
scalars[7]  = cos(relative_angle_to_HQ)     → HQ compass: cos
scalars[8]  = shield_active ? 1 : 0         → Is the force field still up?
scalars[9]  = nearest_cannon_dist / maxDist  → How far is nearest cannon?
scalars[10] = sin(relative_angle_to_cannon) → Cannon compass: sin
scalars[11] = cos(relative_angle_to_cannon) → Cannon compass: cos
scalars[12] = alive_cannons / total_cannons → Fraction of cannons still alive
scalars[13] = shoot_cooldown / max_cooldown → Can I shoot yet?
scalars[14] = nearest_mine_dist / maxDist   → Mine compass: distance (0 to 1)
scalars[15] = sin(relative_angle_to_mine)   → Mine compass: sin
scalars[16] = cos(relative_angle_to_mine)   → Mine compass: cos
scalars[17] = nearest_ally_dist / maxDist   → Ally compass: distance (0 to 1)
scalars[18] = sin(relative_angle_to_ally)   → Ally compass: sin
scalars[19] = cos(relative_angle_to_ally)   → Ally compass: cos
```

**The compass trick (sin/cos encoding):** Instead of giving raw angles (which wrap around discontinuously at 360°→0°), we give sin and cos of the relative angle. This creates a smooth, continuous signal that the neural network can easily learn from. "Target is to my front-left" = specific sin/cos values regardless of absolute orientation.

## Step 2: How the Soldier Decides (Neural Network)

**File: `src/ml/Network.js`**

The 145-number observation goes into a feedforward neural network:

```
INPUT (145) → Hidden Layer 1 (64 neurons, ReLU) → Hidden Layer 2 (32 neurons, ReLU) → OUTPUT
```

There are actually TWO networks:

### Policy Network (the "actor")
```
145 → 64 → 32 → 8 (one per action) → softmax → probabilities
```
Output: probability distribution over 8 actions. Example: `[0.02, 0.01, 0.05, 0.03, 0.60, 0.20, 0.05, 0.04]` means "60% chance of SHOOT, 20% chance of DUCK, etc."

The soldier SAMPLES from this distribution — it doesn't always pick the highest probability. This randomness is crucial for exploration (trying new things).

### Value Network (the "critic")
```
145 → 64 → 32 → 1 (single number)
```
Output: estimated total future reward from this state. "How good is my current situation?" This helps the learning algorithm decide which actions were better than expected.

### What's Inside Each Layer

Each layer is a matrix multiplication + bias + activation:
```
output = ReLU(weights × input + bias)
```

- **Weights**: A matrix of numbers (e.g., 145×64 = 9,280 numbers for layer 1)
- **Bias**: One number per output neuron
- **ReLU**: `max(0, x)` — clips negative values to zero, adds non-linearity
- **Softmax** (final policy layer): Converts raw scores to probabilities that sum to 1

Total learnable parameters: ~15,000 numbers. These are what "learning" adjusts.

## Step 3: What the Soldier Does (Actions)

**File: `src/sim/Soldier.js`**

8 possible actions every tick:

| Index | Action | Effect |
|-------|--------|--------|
| 0 | MOVE_FWD | Move 1 tile in facing direction |
| 1 | MOVE_BACK | Move 1 tile backward |
| 2 | TURN_L | Rotate 90° counter-clockwise |
| 3 | TURN_R | Rotate 90° clockwise |
| 4 | SHOOT | Fire in facing direction (if cooldown ready & ammo > 0) |
| 5 | DUCK | Crouch (take 50% damage) |
| 6 | STAND | Stand up from ducking |
| 7 | STAY | Do nothing |

The soldier can only shoot in cardinal directions (N/E/S/W). To hit a target, it must be facing it AND on the same row or column. This means the soldier must learn to ALIGN with targets — a non-trivial spatial reasoning task.

## Step 4: How the Soldier Learns (PPO)

**File: `src/ml/PPO.js`**

PPO (Proximal Policy Optimization) is the algorithm that adjusts the network weights to make good actions more likely and bad actions less likely.

### The Training Loop

```
1. Collect 128 steps of experience (observations, actions, rewards)
2. Compute advantages (which actions were better than expected?)
3. Update the network weights using gradient descent
4. Repeat
```

### What Is "Advantage"?

The advantage tells us: "Was this action BETTER or WORSE than what we expected?"

```
Advantage = Actual_Reward - Predicted_Reward(from value network)
```

- Positive advantage → this action was better than expected → make it MORE likely
- Negative advantage → this action was worse than expected → make it LESS likely

We use GAE (Generalized Advantage Estimation) to compute this, which balances bias and variance using two hyperparameters:
- **gamma (γ = 0.99)**: How much to value future rewards. 0.99 = long-term thinking.
- **lambda (λ = 0.95)**: How much to smooth the advantage estimate. Higher = less bias, more variance.

### The PPO Update

For each minibatch of 64 transitions, we:

1. **Compute the policy ratio**: `r = new_probability / old_probability`
   - If we made the action MORE likely, r > 1
   - If we made it LESS likely, r < 1

2. **Clip the ratio**: `clipped_r = clip(r, 1 - ε, 1 + ε)` where ε = 0.2
   - This prevents the network from changing too much in one update
   - Without clipping, one lucky reward could catastrophically shift all weights
   - This is the "Proximal" in PPO — stay close to the previous policy

3. **Policy loss**: `min(r × advantage, clipped_r × advantage)`
   - Takes the MORE conservative estimate
   - If advantage is positive (good action), we increase probability but not too fast
   - If advantage is negative (bad action), we decrease probability but not too fast

4. **Value loss**: `(predicted_value - actual_return)²`
   - Train the critic to better predict future rewards

5. **Entropy bonus**: `-0.05 × entropy(policy)`
   - Encourages exploration by penalizing overly confident policies
   - Without this, the agent might converge to a single action too early

### The Full Loss Function

```
Loss = -PolicyLoss + 0.5 × ValueLoss - 0.05 × Entropy
```

We run 4 epochs over the buffer with minibatch size 64, using the Adam optimizer (learning rate 3e-4).

### Adam Optimizer

**File: `src/ml/Adam.js`**

Adam tracks two running averages per weight:
- **First moment (m)**: Running average of gradients (which direction to move)
- **Second moment (v)**: Running average of squared gradients (how much to scale the step)

This makes updates adaptive: weights that get consistent gradient signals move faster; weights with noisy gradients move slower.

## Step 5: How Rewards Shape Behavior

**File: `src/ml/Rewards.js`**

The reward function is the single most important design decision. It defines WHAT the soldier learns.

### Per-Step Rewards

| Signal | Value | Purpose |
|--------|-------|---------|
| Time penalty | -0.01 | Don't dawdle, finish fast |
| Idle penalty (DUCK/STAND/STAY) | -0.02 | Don't stand around, take action |
| Damage dealt | +0.1 per HP | Reward aggression |
| Damage taken | -0.03 per HP | Punish recklessness |
| Shot hit | +0.5 | Reward accuracy |
| Shot miss | -0.05 | Punish wasted ammo |
| Move toward target | +0.5 × distance_delta | Reward progress |
| Cannon destroyed | +5.0 | Big milestone bonus |

### Phase-Dependent Distance Reward

This is the key innovation. The "target" changes based on game phase:

**Phase 1 (shield up):** Distance reward points toward NEAREST ALIVE CANNON
```
reward += (previous_distance_to_cannon - current_distance_to_cannon) × 0.5
```

**Phase 2 (shield down):** Distance reward points toward HQ
```
reward += (previous_distance_to_HQ - current_distance_to_HQ) × 0.5
```

This creates emergent multi-phase behavior WITHOUT scripting. The agent discovers: "When shield is up, get closer to cannons. When shield is down, rush HQ." The network learns to read the `shield_active` observation and change strategy accordingly.

### Terminal Rewards

| Outcome | Reward | Purpose |
|---------|--------|---------|
| Win (HQ destroyed) | +20.0 | Ultimate goal |
| Death (soldier killed) | -3.0 | Survival matters |
| Timeout (max steps) | -2.0 | Don't stall forever |

### The Reward Balance

The art is in the RATIOS. If the win reward is too high relative to per-step rewards, the agent only optimizes for lucky wins. If per-step rewards dominate, the agent might farm small rewards and never push for the win.

Current balance: a typical winning episode earns ~25-30 total reward (distance + combat + win bonus). A typical losing episode earns ~-5 to -10. This 3:1 to 6:1 ratio gives clear signal without overwhelming exploration.

## Step 6: Curriculum Learning (Graduation)

### How It Works

1. Start on Level 1 (simple scenario: just mines + HQ)
2. Train until 80% win rate over last 100 episodes
3. AUTO-GRADUATE to Level 2 (keep all network weights!)
4. On Level 2, the agent already knows how to navigate — it just needs to layer on new skills

### Why It Works

Neural networks store knowledge in their weights. When we move to a harder level:
- The weights that encode "move toward target" still work
- The weights that encode "avoid mines" still work
- The new challenge (cannons, shields) gets layered on top
- The agent doesn't need to relearn basics — it refines and extends

This is exactly like human learning: you don't forget how to walk when you learn to run. The skills compose.

### What Transfers

The observation space is the SAME across levels (145 dimensions). Some features are zero on simpler levels (e.g., cannon compass is [0,0,0] on Level 1 because there are no cannons). When cannons appear in Level 2, those weights start getting gradient signal for the first time, and the agent learns what they mean.

## Watching the Learning (What the Metrics Mean)

### Win Rate (100)
- Last 100 episodes, what % did the soldier win?
- 0% = hasn't learned anything useful yet
- 50% = learning, but inconsistent
- 80%+ = mastered this level, ready to graduate

### Entropy
- How "random" the policy is. High entropy = exploring, trying everything. Low entropy = confident, exploiting what it knows.
- Start: ~2.08 (uniform over 8 actions = ln(8) ≈ 2.08)
- Healthy learning: drops to 0.5-1.0 (has preferences but still explores)
- Converged: drops to 0.1-0.3 (very confident in its strategy)
- If entropy hits 0: OVER-FIT. Agent always does the same thing. Increase entropy coefficient.

### Episode Reward
- Total reward accumulated in one episode
- Negative = dying early or timing out
- Positive and rising = learning to get further / deal damage
- Plateauing = hit a local optimum (might need reward tuning or reroll)

### Policy Loss
- How much the policy changed this update
- Should be small and stable (±0.01)
- Large spikes = instability (reduce learning rate)
- Zero = not learning (check if buffer is filling)

### Value Loss
- How wrong the value network's predictions were
- Should decrease over time as the critic gets better at predicting outcomes
- High values = environment is surprising the agent (new scenarios, reward changes)

## Common Failure Modes

### "Stuck at 0% after 1000+ episodes"
- **Possible causes**: Bad weight initialization, reward signal too weak, observation missing key info
- **Fix**: Hit REROLL WEIGHTS to try a new random init. If consistently fails, check reward balance.

### "Learns to DUCK and never moves"
- **Cause**: Ducking reduces damage (positive signal) and the distance reward isn't strong enough
- **Fix**: Increase idle penalty, increase distance reward coefficient

### "Runs straight into mines every time"
- **Cause**: Distance reward for approaching HQ is stronger than death penalty
- **Fix**: Add mine compass to observations, increase mine-specific death penalty

### "Wins Level 1 but fails Level 2"
- **Cause**: Level 2 requires skills not tested in Level 1 (shooting, target selection)
- **Fix**: Ensure Level 2 observation features are properly populated, check that combat rewards fire correctly

### "High entropy won't come down"
- **Cause**: Entropy coefficient too high, or contradictory reward signals
- **Fix**: Reduce ENTROPY_COEFF from 0.05 to 0.02. Check for reward signals that cancel out.

## Individual Brains vs. Shared Brains

### The Design Choice

The current codebase includes a MAPPO prototype where all soldiers share one neural network (parameter sharing). This was a useful stepping stone for validating multi-agent simulation mechanics, but it is **not the target architecture**.

**The target: every soldier gets its own PPO brain.**

### Why Individual Brains

| | Shared Brain (MAPPO) | Individual Brains |
|---|---|---|
| Training cost | Train once, all soldiers benefit | Train each soldier separately |
| Behavior | All soldiers act identically | Each soldier develops unique instincts |
| Specialization | Impossible | Emerges naturally from training history |
| Squad composition | Interchangeable units | Strategic mix of differently-trained soldiers |
| Economy impact | Additional soldiers are free | Each soldier is a gold investment |
| Emergent strategy | Limited (homogeneous teams) | Rich (heterogeneous teams coordinate differently) |

The game's core appeal is watching AI develop interesting, emergent strategy. Homogeneous teams (shared brain) converge on a single optimal policy. Heterogeneous teams (individual brains) produce emergent coordination — a mine specialist paired with a cannon specialist develops flanking behavior that neither could discover alone.

### How It Works in Code

**Shared brain (current prototype):**
```
agent = new PPO();                    // ONE agent
for (soldier of soldiers) {
  obs = buildObservation(soldier);
  action = agent.selectAction(obs);   // Same brain for all
  agent.store(obs, action, ...);      // All transitions in one buffer
}
agent.update();                       // One update trains all
```

**Individual brains (target architecture):**
```
// Each soldier in the roster has its own PPO instance
roster = [new PPO(), new PPO(), new PPO()];

// During training drill, each soldier uses its own brain
for (let i = 0; i < squad.length; i++) {
  obs = buildObservation(squad[i].soldier);
  action = roster[i].selectAction(obs);   // Each soldier's own brain
  roster[i].store(obs, action, ...);      // Each soldier's own buffer
}

// Each brain updates independently
for (agent of roster) agent.update();
```

### Group Training

When multiple soldiers with **different training histories** enter a group drill together:

1. Each soldier acts from its own brain
2. They observe each other via the ally compass features (scalars 17-19)
3. Each soldier's transitions go into its OWN buffer
4. Each brain updates independently based on its own experience

The result: soldiers learn to cooperate with teammates who have **different instincts**. A scout trained on mine drills learns "my assault teammate will push toward cannons — I should clear the path." The assault soldier learns "my scout teammate navigates safely — I should follow and provide firepower."

This heterogeneous cooperation is where the truly emergent, surprising squad tactics come from. It's the core reason for individual brains.

### Training Drills (Not Your Base)

Training happens in **dedicated drills** — pre-designed scenarios that teach specific skills. Players do NOT train soldiers against their own base.

- **Solo drills:** One soldier trains alone (mine navigation, cannon assault, pathfinding, etc.)
- **Group drills:** 2+ soldiers train together, each with their own brain
- All drills use **randomized layouts** to force generalization
- Training costs gold per soldier per 1,000 episodes

When a player raids another player's base, the raid is **one-shot** — no learning happens during the raid. The soldiers execute using their trained brains. This makes training quality the competitive differentiator.
