# North Star: AI Soldiers Game Design

## What We Proved

A single soldier learned multi-phase tactics entirely through PPO reinforcement learning in the browser:
1. Navigate toward cannons
2. Align and destroy both cannons
3. Shield drops
4. Push through to HQ
5. Destroy HQ

100% win rate by ~1,500 episodes. No scripting, no behavior trees — pure learned behavior from reward signals and observations. The key technical breakthroughs: egocentric compass observations (sin/cos relative angles), phase-dependent reward shaping, and discoverable geometry (objectives placed where the agent can stumble into success).

---

## The Core Insight

**Offense and defense are two sides of the same coin.** Players build bases to defend against AI soldiers. AI soldiers train against player bases to attack. Each side's quality drives the other:

- A clever base forces smarter soldiers
- Smarter soldiers force cleverer bases
- This arms race IS the game

---

## The Core Loop

```
BUILD BASE → TRAIN SOLDIERS → ATTACK ENEMY BASES → DEFEND YOUR BASE → REPEAT
     ↑                                                                    |
     └────────────── earn rewards, unlock buildings, level up ────────────┘
```

### Offense (AI Training)
- Player watches their squad train against practice scenarios
- Soldiers visibly get smarter over episodes — the fun is WATCHING this happen
- Trained soldiers are sent to attack other players' bases
- Higher-level soldiers handle more complex defenses

### Defense (Base Building)
- Player places buildings on a grid to create a defensive layout
- Each building forces the AI to learn a specific skill
- Good base design = harder for attackers = higher defense rating
- Bases are attacked asynchronously by other players' trained soldiers

---

## The Building Set

Every building exists to force a specific AI learning challenge:

| Building | What It Does | What AI Must Learn |
|----------|-------------|-------------------|
| **Wall** | Blocks movement | Pathfinding, finding gaps |
| **Cannon** | Ranged damage in radius | Threat avoidance, using cover, prioritizing targets |
| **Shield Generator** | Force field blocks area until generator destroyed | Multi-phase planning, sub-objectives before main goal |
| **Mortar** | Slow AoE damage, splash zone | Predicting danger zones, not clustering |
| **Sniper Tower** | High damage, long range, slow fire rate | Using cover, timing advances between shots |

Each building is a teaching tool. The combination creates emergent complexity — a base with walls + cannons + shield generators requires pathfinding + threat avoidance + multi-phase planning simultaneously.

---

## Balance Framework

**Defense scales slightly faster than offense.** This is intentional — it means players always feel pressure to improve their soldiers, and a well-designed base always has value.

| Level | Offense Multiplier | Defense Multiplier |
|-------|-------------------|-------------------|
| 1 | 1.00x | 1.00x |
| 5 | 1.57x | 1.75x |
| 10 | 3.11x | 4.05x |
| 20 | 9.65x | 16.37x |

- Offense scales at **1.12x per level** (more soldiers, better stats, longer training)
- Defense scales at **1.15x per level** (more buildings, higher HP, new building types)
- Gap widens over time → late-game defense is formidable → offense needs real strategy to win

### What Scales

**Offense (per level):**
- Squad size increases (1 → 2 → 3 → 5 soldiers)
- Soldier stats improve (HP, damage, ammo)
- Training budget increases (more episodes before attack)
- New action types unlock (grenades, sprinting, formation commands)

**Defense (per level):**
- Grid size increases (16x16 → 32x32 → 48x48 → 64x64)
- Building count cap increases
- Building HP and damage scale up
- New building types unlock
- Terrain features unlock (elevation, water, destructible cover)

---

## Training Curriculum

Training difficulty maps directly to game progression. Each level introduces scenarios that teach the next required skill:

### Phase 1: Basics (Levels 1-5)
- Single soldier vs. undefended HQ → learn to navigate
- Add walls → learn pathfinding
- Add one cannon → learn threat awareness
- Add shield generator → learn multi-phase objectives

### Phase 2: Tactics (Levels 5-10)
- Two soldiers → learn not to bunch up
- Multiple cannons → learn prioritization
- Walls + cannons → learn to use cover
- Mixed defenses → learn to adapt strategy per layout

### Phase 3: Strategy (Levels 10-20)
- Full squad (3-5 soldiers) → learn coordination
- Complex bases → learn role specialization (tank, flanker, sniper)
- High-level defenses → learn timing, distraction, sacrifice plays

### Phase 4: Mastery (Level 20+)
- Max-complexity bases with all building types
- AI must discover novel strategies the designer didn't anticipate
- This is where emergent behavior creates the magic moments

---

## Matchmaking (BPR System)

- Each player has an **offense rating** and a **defense rating**
- Attacking matches offense vs. defense at similar ratings
- Winning on offense raises offense rating; defending successfully raises defense rating
- Players can specialize (great attacker, weak defender or vice versa)
- Leaderboards for both offense and defense separately

---

## Scalability: The Engine, Not the Game

This is an ENGINE designed to support years of play. Every system is built to extend, not replace:

### What Makes It Scale

1. **New buildings = new skills to learn.** Adding a building type doesn't break existing training — it adds a new dimension. The PPO agent adapts because it learns from observations, not rules.

2. **Grid size scales with content.** Bigger grids = more building slots = more complex layouts = harder problems for AI = more training needed = more engagement.

3. **Multi-agent scales naturally.** MAPPO with parameter sharing means going from 1 to 5 soldiers is a hyperparameter change, not a rewrite. Soldiers share a brain but see different things.

4. **Player creativity is infinite content.** Every base layout is a new puzzle for the AI. Players ARE the content creators. Two players with identical buildings will create different challenges based on layout.

5. **Meta evolves organically.** As players discover effective base designs, attackers must adapt. As attackers get smarter, defenders must innovate. The meta-game shifts without developer intervention.

6. **Seasons and events slot in.** New building types, temporary modifiers, challenge scenarios — all drop into the existing engine without structural changes.

### What We Don't Build Until We Need It

- Social features (clans, chat) — bolt on later
- Monetization — cosmetics and training speed boosts, never pay-to-win
- Complex terrain — add elevation/water as late-game unlocks
- Tournaments — emerge naturally from matchmaking infrastructure

---

## Technical Architecture for Scale

```
Client (Browser)
├── Sim Engine (grid, entities, combat) — deterministic, replayable
├── ML Engine (PPO, observations, rewards) — runs in Web Worker
├── Renderer (Three.js) — interpolated visualization
└── UI (React or vanilla) — base editor, training dashboard, battle viewer

Server
├── Base Storage — player base layouts (just JSON grids)
├── Matchmaking — BPR-based offense vs defense pairing
├── Battle Resolution — can run headless for async attacks
└── Replay Storage — compressed action logs for playback
```

Key principle: **the simulation is the source of truth.** Everything else (rendering, UI, server) is a view or wrapper around the deterministic sim. This means:
- Battles can run headless on server for async attacks
- Replays are just action logs replayed through the sim
- Balance changes only touch the sim layer
- Client and server share the same sim code

---

## Success Metrics

### Proof of Concept (NOW)
- [x] Single soldier learns multi-phase tactics (cannon → shield → HQ)
- [x] 100% win rate achievable through training
- [x] Visible learning progression (random → directed → tactical)
- [ ] Two soldiers learning simultaneously (MAPPO)
- [ ] Player can place buildings and watch AI adapt

### MVP
- [ ] Base editor with 3 building types (wall, cannon, shield gen)
- [ ] Training mode with visible learning curve
- [ ] Attack mode against preset bases
- [ ] Basic metrics dashboard (win rate, episode count, reward chart)

### Alpha
- [ ] All 5 building types
- [ ] Multi-soldier squads (3-5)
- [ ] Async PvP (attack other players' bases)
- [ ] BPR matchmaking
- [ ] Replay system

### Beta
- [ ] Full progression system (levels, unlocks)
- [ ] Leaderboards (offense + defense)
- [ ] Balance tuning from real player data
- [ ] Mobile-responsive

---

## Guiding Principles

1. **The fun is watching AI learn.** Every design decision should make learning MORE visible, MORE dramatic, MORE satisfying to watch.

2. **Players are content creators.** Their bases are the puzzles. Their soldiers are the solvers. We build the engine; they build the game.

3. **Simple rules, emergent complexity.** Five building types create infinite combinations. Eight actions create infinite strategies. Complexity comes from interaction, not enumeration.

4. **Defense has the edge.** A well-built base should be HARD to crack. This drives the training loop — players NEED smarter soldiers, which means more engagement.

5. **Scale is the game.** If it can't grow, it's a demo. Every system we build must support years of expanding content, player progression, and meta evolution.
