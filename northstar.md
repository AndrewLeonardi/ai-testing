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
- Player builds their own base, then trains soldiers against IT
- Soldiers visibly get smarter over episodes — the fun is WATCHING this happen
- Trained soldiers are then sent to attack OTHER PLAYERS' bases (not their own)
- **The AI must GENERALIZE.** It trains on YOUR base but fights on UNKNOWN layouts
- This is the core skill gap: build a base that teaches your soldiers transferable skills
- A player who builds a diverse, challenging training base produces smarter soldiers
- Training costs gold — limited budget forces strategic training decisions

### Defense (Base Building)
- Player places buildings on a grid to create a defensive layout
- Each building forces the AI to learn a specific skill
- Good base design serves DUAL purpose:
  1. **Defense:** harder for enemy soldiers to crack = higher defense rating
  2. **Training ground:** teaches YOUR soldiers skills that transfer to enemy bases
- Bases are attacked asynchronously by other players' trained soldiers
- The tension: a base optimized for defense might not be the best training ground, and vice versa

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
- Monetization — gold coin IAP (buys time, not power), cosmetics later, never pay-to-win
- Complex terrain — add elevation/water as late-game unlocks
- Tournaments — emerge naturally from matchmaking infrastructure

---

## Economy: Gold Coins

Gold coins are the universal currency. Every player action that matters costs gold, and every achievement earns gold. The economy is what ties offense and defense together — you can't build a great base AND train elite soldiers without earning (or buying) enough gold. This forces strategic spending decisions.

### How You EARN Gold

| Source | Amount | Notes |
|--------|--------|-------|
| **Passive gold mine** | X/hour | Every base has a gold mine that accumulates over time. Always ticking, even offline. |
| **Successful raid** | Variable | Attack another player's base and win. Payout scales with their defense rating. |
| **Defense victory** | Small bonus | Your base repels an attacker. Smaller reward than raiding — offense is the active play. |
| **Purchase (IAP)** | Tiered packs | Real money → gold. Convenience, not power — everything is earnable through play. |

### How You SPEND Gold

| Action | Cost | Notes |
|--------|------|-------|
| **Train soldiers** | Per training session | More episodes = more gold. You're paying for compute time. |
| **Buy equipment/weapons** | Per item | Unlock new soldier abilities (grenades, sprint, shields). Permanent once bought. |
| **Build defenses** | Per building | Place walls, cannons, mortars, etc. Each has a gold cost. |
| **Upgrade buildings** | Per upgrade | Increase HP, damage, range of existing buildings. |
| **Upgrade gold mine** | Tiered | Increases passive generation rate. Long-term investment. |

### Balance Principles

1. **Passive income alone should NOT sustain a competitive player.** You must raid to keep up. This drives the core loop.
2. **Training costs scale with soldier count and episode budget.** Bigger squads and longer training = more gold. Prevents everyone from having max-trained armies.
3. **Defense is cheaper per unit of effectiveness than offense.** Matches the 1.15x vs 1.12x scaling — defense has the edge, which means attackers need to be SMARTER, not just richer.
4. **IAP buys time, not power.** A paying player gets gold faster. A free player gets there eventually. No exclusive items behind paywalls.
5. **Gold sinks prevent inflation.** Training, upgrades, and building replacement (after raids damage your base) keep gold flowing OUT. The mine keeps it flowing IN. The raid economy circulates it between players.

### Single Source of Truth

All gold costs, combat stats, reward constants, and scaling formulas live in **`src/game/Balance.js`**. Both the game code and the balance calculator (`/balance.html`) import from this file. Never hardcode balance numbers elsewhere — if a number affects gold or gameplay balance, it belongs in Balance.js.

### Economy ↔ Balance Connection

The gold economy is the BALANCING LEVER for the entire game. If offense is too strong → raise training costs. If defense is too strong → lower building costs so more players can build up. If progression is too fast → reduce raid payouts. Every balance knob in the game ultimately maps to a gold flow rate.

```
GOLD MINE (passive) ──→ GOLD POOL ──→ TRAINING (offense)
                            ↑    └──→ BUILDINGS (defense)
                            │    └──→ EQUIPMENT (upgrades)
RAID REWARDS ───────────────┘
IAP ────────────────────────┘
```

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
