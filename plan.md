# Plan: Next Steps for the AI Soldiers Engine

## What We've Proven

- Single soldier learns multi-phase tactics via PPO (navigate mines, destroy cannons, drop shield, destroy HQ)
- Curriculum learning with weight transfer works (Level 1 skills carry into Level 2)
- 100% win rate achieved on the full scenario in ~1,500 episodes
- Vanilla JS ML pipeline (no TensorFlow) runs in-browser at 100x speed

## The Core Insight

**Offense and defense are the SAME system.** Every building we add must:
1. Force the AI to learn a new, visible behavior (offense side)
2. Give the player a meaningful defensive choice (defense side)
3. Have a corresponding attacker upgrade that creates counterplay

If a building doesn't teach the AI something new, it's cosmetic. If an attacker upgrade doesn't unlock a new strategy, it's just stat inflation. The game is the ARMS RACE between the two sides.

## The Building/Weapon Matrix

Every row is a paired unlock. Defense gets a building, offense gets a counter-tool. The AI must learn to use the tool against the building.

| Level | Defense Unlock | What It Forces AI To Learn | Offense Unlock | What It Enables |
|-------|---------------|---------------------------|----------------|-----------------|
| 1 | Mines | Avoidance, cautious pathing | (base kit) | Navigate safely |
| 2 | Cannon + Shield | Target prioritization, multi-phase | (base kit) | Shoot, destroy sequence |
| 3 | Walls | Pathfinding around obstacles | — | Longer routes, patience |
| 4 | Sniper Tower | Use cover, timing (advance between shots) | Sprint | Dash through danger zones |
| 5 | Mortar | Don't stand still, avoid AoE zones | Grenade | Arc damage over walls |
| 6 | Heal Station | Target prioritization (kill healer first) | — | Strategic target order |
| 7 | (combinations) | Multi-threat assessment | Shield (personal) | Absorb burst, tank a push |
| 8+ | Dense compound bases | Squad coordination | Heal Pack | Self-sustain, retreat & push |

## Implementation Priority (What To Build Next)

### Phase 1: Lock Down Single-Agent Curriculum (NOW)

The mine learning is inconsistent across random seeds. Before adding more complexity, make Level 1 rock-solid.

**1.1 — Add mine compass to observations**
- Add nearest mine distance + sin/cos direction as scalar features (like we have for cannons and HQ)
- The agent currently can only see mines in its 5x5 view (2 tiles). A compass gives early warning
- Files: `Observations.js` (add 3 scalars, OBS_SIZE 139 → 142), `Grid.js` (helper to find nearest mine)

**1.2 — Tune mine death signal**
- Add explicit mine death tracking (`soldier.killedByMine` flag)
- Increase mine-specific death penalty in rewards (the general -3.0 isn't distinctive enough)
- Files: `SimLoop.js`, `Soldier.js`, `Rewards.js`

**1.3 — Validate consistency**
- Run 10+ rerolls on Level 1, track how many converge to 80%+ win rate
- Target: 8/10 seeds should converge within 1,000 episodes
- If not, simplify mine layout (fewer mines, wider gaps) until it's reliable

### Phase 2: Add Walls (Level 3)

Walls are the simplest next building — no AI, no damage, pure pathfinding puzzle.

**2.1 — Create Level 3 scenario**
- Add wall maze between soldier spawn and cannon/HQ area
- Soldier must navigate around walls to reach targets
- Graduated from Level 2 (already knows mines + cannons + shield)
- Files: `Scenario.js` (new `createLevel3`), `main.js` (extend graduation)

**2.2 — Validate pathfinding emergence**
- Agent should learn to navigate around walls using distance reward gradient
- If walls create local minima (agent gets stuck in corners), add wall-proximity penalty or wall compass

### Phase 3: Base Editor Prototype

This is where DEFENSE comes alive. Players place buildings on a grid.

**3.1 — Grid editor UI**
- Click to place/remove buildings on the 32x32 grid
- Building palette: Wall, Cannon, Mine, Shield Generator, HQ (fixed position)
- Budget system: X points to spend, each building has a cost
- Files: New `src/ui/BaseEditor.js`, modify `Renderer.js` for edit mode

**3.2 — Train soldiers (on YOUR base)**
- Player builds a base, clicks "TRAIN"
- AI soldiers train against the player's OWN base layout
- Player watches the AI learn — this is where the fun is
- CRITICAL: soldiers then ATTACK OTHER PLAYERS' bases, NOT the one they trained on
- The AI must GENERALIZE from training — it won't get to practice on the target base
- This is the key tension: train soldiers that are smart enough to handle UNKNOWN layouts
- Training budget is limited by gold coins — you can't train forever

**3.3 — Save/load bases**
- Serialize grid state as JSON
- LocalStorage for now, server later
- Share base layouts (URL encoding or clipboard)

### Phase 4: Multi-Agent (MAPPO)

Multiple soldiers attacking together. This is where squad tactics emerge.

**4.1 — Parameter sharing**
- All soldiers share the same network weights
- Each gets its own observation (egocentric view from their position)
- Centralized training, decentralized execution
- Files: `PPO.js` (batch multiple soldiers' transitions), `main.js` (multi-agent obs/action loop)

**4.2 — Inter-agent observation**
- Add ally positions to scalar features (not just the 5x5 view)
- Nearest ally distance + direction compass
- This enables emergent coordination (spreading out, flanking)

**4.3 — Squad curriculum**
- Level N: 1 soldier (current)
- Level N+1: 2 soldiers, same base
- Level N+2: 3 soldiers, harder base
- Agents learn NOT to cluster (mortar splash), learn to split targets

### Phase 5: Advanced Buildings

Each one introduces a new tactical dimension:

**5.1 — Sniper Tower**
- Long range (12), high damage (40), slow fire rate (6 ticks)
- Forces timing: advance BETWEEN shots
- Pairs with Sprint upgrade: dash through sniper lanes

**5.2 — Mortar**
- AoE splash (3x3 area), telegraphed (shows target zone 3 ticks before impact)
- Forces movement: never stand still in open areas
- Deadly vs. clustered multi-agent squads

**5.3 — Heal Station**
- Heals nearby buildings (2 HP/tick within range 4)
- Forces target prioritization: kill heal station before cannons, or cannons regenerate
- Strategic depth: placement near cannons vs. near HQ

### Phase 6: Async PvP

**6.1 — Attack other players' bases**
- Player A builds a base and saves it
- Player B's trained soldiers attack Player A's base
- Battle runs as simulation, result sent back
- No real-time multiplayer needed — it's all async

**6.2 — BPR matchmaking**
- Separate offense rating (how good your soldiers are) and defense rating (how good your base is)
- Match by similar combined rating
- Defense scales 1.15x per level, offense 1.12x — defense has a slight edge to reward clever building

**6.3 — Replay system**
- Record action sequences (compact: just action indices per tick)
- Replay attacks on your base to see how you got beaten
- Identify weak spots, redesign base

## Architecture Principle: The Engine Must Scale

This is NOT a game with 10 levels and an ending. It's an ENGINE that supports years of play.

**What scales:**
- New building types (just add to BUILDING_TYPES, create AI behavior, add observation channel)
- New attacker abilities (just add to ACTIONS, extend action space, add reward signal)
- More curriculum levels (just add scenarios to Scenario.js)
- Bigger grids (change SIZE constant, observation stays egocentric so it scales)
- More soldiers (MAPPO with parameter sharing, same network architecture)

**What stays fixed:**
- The PPO algorithm (proven, battle-tested)
- The observation framework (egocentric view + scalar compass features)
- The reward structure (phase-dependent distance + combat + terminal)
- The curriculum graduation system (weight transfer between levels)

**The scaling IS the game.** Every new building × weapon combination creates a new strategic dimension. The player's base evolves, their soldiers evolve, and the arms race never ends.
