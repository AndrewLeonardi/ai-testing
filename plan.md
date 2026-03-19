# Plan: Next Steps for the AI Soldiers Engine

## What We've Proven

- Single soldier learns multi-phase tactics via PPO (navigate mines, destroy cannons, drop shield, destroy HQ)
- Curriculum learning with weight transfer works (Level 1 skills carry into Level 2)
- 100% win rate achieved on the full scenario in ~1,500 episodes
- Vanilla JS ML pipeline (no TensorFlow) runs in-browser at 100x speed
- Multi-agent coordination works with parameter sharing (MAPPO prototype)
- Base editor with click-to-place, budget system, path validation

## The Core Insight

**Offense and defense are the SAME system.** Every building we add must:
1. Force the AI to learn a new, visible behavior (offense side)
2. Give the player a meaningful defensive choice (defense side)
3. Have a corresponding attacker upgrade that creates counterplay

If a building doesn't teach the AI something new, it's cosmetic. If an attacker upgrade doesn't unlock a new strategy, it's just stat inflation. The game is the ARMS RACE between the two sides.

## Critical Design Decision: Individual Brains, Not Shared

The Phase 4 MAPPO prototype used **parameter sharing** — all soldiers share one neural network. This was a useful stepping stone to validate multi-agent sim mechanics, but it is NOT the target architecture.

**Why parameter sharing is wrong for this game:**
- Additional soldiers are essentially free (no training cost for a new unit)
- All soldiers behave identically (no specialization possible)
- No strategic depth in squad composition (every soldier is interchangeable)
- No attachment to individual soldiers (they're all clones)

**The target: individual brains per soldier.**
- Each soldier has its own PPO network (~15K parameters)
- Each soldier is a separate training investment (gold sink)
- Different soldiers develop different instincts based on their training history
- Squad composition becomes a strategic decision (which soldiers to bring)
- Group training produces emergent coordination from heterogeneous teams

See `northstar.md` for the full design of the soldier system, roster, classes, and training drills.

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

### Phase 1: Lock Down Single-Agent Curriculum ✅ DONE

**1.1 — Add mine compass to observations** ✅ DONE
- Added nearest mine distance + sin/cos direction as scalar features (scalars 14-16)
- OBS_SIZE 139 → 142, mine compass implemented in `Observations.js`, `Grid.js`

**1.2 — Tune mine death signal** ✅ DONE
- Added `soldier.killedByMine` flag and mine-specific death penalty (-5.0 vs general -3.0)
- Files: `SimLoop.js`, `Soldier.js`, `Rewards.js`

**1.3 — Validate consistency** ✅ DONE
- Consistent convergence across random seeds

### Phase 2: Add Walls (Level 3) ✅ DONE

- Wall maze between soldier spawn and cannon/HQ area
- Pathfinding emergence validated via distance reward gradient

### Phase 3: Base Editor Prototype ✅ DONE

- Grid editor UI with click-to-place buildings
- Budget system (gold + building count limits)
- Path validation (soldier spawn → HQ must be reachable)
- Save/load bases to localStorage

### Phase 4: Multi-Agent Prototype (MAPPO) ✅ DONE (stepping stone)

Parameter sharing validated the multi-agent sim mechanics:
- Multiple soldiers in the same episode
- Inter-agent observations (ally compass)
- Clustering penalty, ally death penalty
- Squad curriculum levels 5-6

**NOTE:** This phase proved multi-agent works but used shared brains. Phase 5 replaces this with individual brains — the target architecture for the game.

### Phase 5: Individual Soldier Brains (NEXT)

This is the critical architecture shift. Replace the single shared PPO agent with per-soldier brains.

**5.1 — Roster System**
- Each soldier = its own PPO instance with saved weights
- Roster stored in localStorage (later: server)
- Recruit new soldiers (costs gold, starts with random weights)
- Retire soldiers (frees roster slot)
- Roster size scales with player level
- Files: New `src/game/Roster.js`, modify `main.js`, `Balance.js`

**5.2 — Soldier Classes**
- Define 2-3 classes in Balance.js (Assault, Scout, Support)
- Classes provide stat modifiers (HP, damage, vision range)
- Classes have recommended drills (UI hint, not a constraint)
- Any class can train on any drill
- Files: `Balance.js`, new `src/ui/ClassPicker.js`

**5.3 — Drill-Based Training (replaces "train on own base")**
- Training happens in dedicated drills, NOT against the player's own base
- Drill scenarios defined as factory functions (like current Scenario.js levels)
- Each drill teaches a specific skill with randomized layouts
- Player selects a soldier from roster + a drill, then watches training
- Training costs gold per soldier per 1,000 episodes
- Files: `Scenario.js` (add drill definitions), `Balance.js` (drill costs), modify `main.js` (drill selector flow)

**5.4 — Group Training**
- Group drills accept 2+ soldiers from the roster
- Each soldier uses its OWN brain (not shared weights)
- All soldiers' transitions go to their INDIVIDUAL PPO buffers
- Soldiers see each other via ally observations
- This is where emergent heterogeneous coordination develops
- Files: `main.js` (multi-agent loop with separate PPO instances), `Rewards.js` (group drill rewards)

**5.5 — Squad Composition for Raids**
- Player picks soldiers from roster to form a raid squad
- Squad size limited by player level
- During raid: inference only, no training (one-shot attack)
- Files: New `src/ui/SquadPicker.js`, modify raid flow in `main.js`

### Phase 6: Advanced Buildings

Each one introduces a new tactical dimension:

**6.1 — Sniper Tower**
- Long range (12), high damage (40), slow fire rate (6 ticks)
- Forces timing: advance BETWEEN shots
- Pairs with Sprint upgrade: dash through sniper lanes

**6.2 — Mortar**
- AoE splash (3x3 area), telegraphed (shows target zone 3 ticks before impact)
- Forces movement: never stand still in open areas
- Deadly vs. clustered squads

**6.3 — Heal Station**
- Heals nearby buildings (2 HP/tick within range 4)
- Forces target prioritization: kill heal station before cannons, or cannons regenerate
- Strategic depth: placement near cannons vs. near HQ

### Phase 7: Async PvP

**7.1 — Raid other players' bases**
- Player composes a squad from their roster
- Squad attacks another player's base (one-shot, no training)
- Battle runs as deterministic simulation, result sent back
- No real-time multiplayer needed — it's all async

**7.2 — BPR matchmaking**
- Separate offense rating (how good your soldiers are) and defense rating (how good your base is)
- Match by similar combined rating
- Defense scales 1.15x per level, offense 1.12x

**7.3 — Replay system**
- Record action sequences (compact: just action indices per tick)
- Replay attacks on your base to see how you got beaten
- Identify weak spots, redesign base

## Economy & Balance Architecture

**Single source of truth:** `src/game/Balance.js` — every combat stat, reward constant, PPO hyperparameter, building cost, training cost, soldier class, drill cost, roster limit, loot formula, passive income rate, and IAP tier lives here. Deep-frozen, no imports, pure data.

**Balance calculator:** `/balance.html` — web-based tool that imports Balance.js and visualizes the entire economy. Player level slider shows how all numbers scale. Includes roster cost projections and drill cost breakdowns.

**How to add new constants:** Add to the relevant section in Balance.js. Both the game code and the calculator automatically pick it up. Never hardcode balance numbers in game files — always import from Balance.js.

**Key economy design:**
- Buildings: buy once, upgrade incrementally, auto-repair FREE
- Soldiers: recruit once (gold cost), train per drill batch (gold per 1,000 episodes PER SOLDIER)
- Loot: attacker steals 15% of defender's stored gold (capped, scales with level)
- Passive income: 5-15% of costs, retention tool not progression
- IAP: 6 tiers ($0.99-$99.99), ~43% volume discount at top tier

---

## Architecture Principle: The Engine Must Scale

This is NOT a game with 10 levels and an ending. It's an ENGINE that supports years of play.

**What scales:**
- New building types (just add to BUILDING_TYPES, create AI behavior, add observation channel)
- New attacker abilities (just add to ACTIONS, extend action space, add reward signal)
- New soldier classes (just add to SOLDIER_CLASSES in Balance.js)
- New drills (just add scenario factory to Scenario.js + cost in Balance.js)
- Bigger grids (change SIZE constant, observation stays egocentric so it scales)
- More soldiers per player (individual brains are ~15KB each, trivial to store)

**What stays fixed:**
- The PPO algorithm (proven, battle-tested)
- The observation framework (egocentric view + scalar compass features)
- The reward structure (phase-dependent distance + combat + terminal)
- The per-soldier brain architecture (one PPO per soldier, same network shape across classes)

**The scaling IS the game.** Every new building × weapon × soldier class combination creates a new strategic dimension. The player's base evolves, their soldiers evolve, and the arms race never ends.
