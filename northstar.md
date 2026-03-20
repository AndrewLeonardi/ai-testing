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

**Offense and defense are two sides of the same coin.** Players build bases to defend their gold. Players recruit, train, and compose squads of AI soldiers to raid other players' bases. Each side's quality drives the other:

- A clever base forces smarter soldiers
- Smarter soldiers force cleverer bases
- This arms race IS the game

---

## The Core Loop

```
DEFENSE:  BUILD BASE ─────────────────────────────→ DEFEND vs enemy raids
                                                          |
OFFENSE:  RECRUIT SOLDIERS → TRAIN (drills) → COMPOSE SQUAD → RAID enemy bases
               ↑                                                      |
               └──────────── earn gold, unlock classes, level up ─────┘
```

### Offense (Soldiers & Training)
- Player **recruits** soldiers from available classes (Assault, Scout, Support, etc.)
- Each soldier has its own **individual brain** — a separate neural network trained independently
- Training happens in **dedicated drills** — pre-designed scenarios that teach specific skills
- Soldiers visibly get smarter over episodes — the fun is WATCHING this happen
- Player **composes a squad** by selecting soldiers from their roster for a raid
- Raids are **one-shot attacks** on another player's base — no learning during the raid, only execution
- **The AI must GENERALIZE.** It trains on drills but fights on UNKNOWN player-built layouts
- The core skill gap: train soldiers on drills that produce transferable combat skills
- Training costs gold PER SOLDIER — limited budget forces strategic training decisions

### Defense (Base Building)
- Player places buildings on a grid to create a defensive layout
- Each building forces attacking AI to deal with a specific challenge
- Your base has ONE purpose: **defend your gold from raiders**
- Base design does NOT affect your own soldiers' training (drills are separate)
- Bases are attacked asynchronously by other players' trained squads

---

## The Soldier System

### Individual Brains (Not Shared)

Every soldier has its own neural network (~15,000 parameters). This is a deliberate design choice:

- **Parameter sharing (old approach):** All soldiers share one brain. Training one trains all. Additional soldiers are free. Everyone behaves identically. No specialization possible.
- **Individual brains (current design):** Each soldier is a separate training investment. Different soldiers develop different instincts based on their training history. Squads composed of differently-trained soldiers produce emergent coordination that shared brains can never achieve.

Individual brains are what make the game interesting. A scout who spent 10,000 episodes on mine drills and an assault soldier who spent 10,000 episodes on cannon drills will behave VERY differently when placed in the same raid — and that difference is where emergent strategy lives.

### Soldier Classes

Classes define starting stats and recommended training paths. They do NOT constrain what a soldier can be trained on — any class can run any drill.

| Class | Starting Stats | Recommended Drills | Role |
|-------|---------------|-------------------|------|
| **SOLDIER** | Standard HP (1.0x), high damage (1.25x) | Cannon destruction, shield breaking | DPS, flanking |
| **ARMORED** | High HP (1.5x), low damage (0.75x) | Mine navigation, survival drills | Tank, frontline |

Currently 2 classes are implemented. The system is designed to support more:
- Classes are data in `Balance.js`, not hardcoded logic
- Each class = stat modifiers + UI metadata (icon, description, recommended drills)
- The brain architecture is identical across classes (same observation space, same action space)
- What makes soldiers different is their TRAINING, not their class — class just gives a stat nudge and a suggested path

### Roster

- Players maintain a **roster** of individually-trained soldiers
- Roster size scales with player level (e.g., 3 slots at level 1, up to 10+ at high levels)
- Each soldier in the roster has its own saved brain weights
- Creating a new soldier costs gold (one-time recruitment cost, scales by class)
- Every new soldier starts fresh — random network weights, no cloning
- Soldiers persist until the player retires them (frees the roster slot)

### Squad Composition

For a raid, the player selects a **squad** from their roster:
- Squad size depends on player level (1 soldier at level 1, up to 5 at high levels)
- Player chooses WHICH soldiers to bring — this is a strategic decision
- A squad of 3 assault soldiers plays very differently from 1 scout + 1 assault + 1 support
- The raid is one-shot: soldiers execute using their trained brains, no learning happens during the raid

---

## Training Drills

Training does NOT happen against the player's own base. Instead, players select from **dedicated training drills** — pre-designed scenarios that teach specific skills.

### Why Drills Instead of Training on Your Base

1. **Cleaner separation:** Your base is purely defense. Training is purely offense. No dual-purpose tension.
2. **Better skill transfer:** Drills are designed with randomized layouts to force generalization. A drill that randomizes mine positions every episode teaches "mine avoidance" not "this specific mine layout."
3. **Progression gating:** New drills unlock at higher player levels, creating a natural training progression.
4. **Group training design:** Drills can be specifically designed for multi-soldier coordination scenarios.

### Drill Types

| Drill | What It Teaches | Type | Unlocked At |
|-------|----------------|------|-------------|
| **Mine Field** | Hazard avoidance, cautious pathing | Solo | Level 1 |
| **Cannon Alley** | Threat assessment, shooting under fire | Solo | Level 2 |
| **Shield Siege** | Multi-phase planning (cannons → shield → HQ) | Solo | Level 2 |
| **The Maze** | Pathfinding around walls | Solo | Level 3 |
| **Kill Zone** | Surviving sniper + cannon crossfire | Solo | Level 4 |
| **Squad Basics** | 2 soldiers cooperating, not clustering | Group | Level 5 |
| **Flanking Drill** | 2+ soldiers attacking from different angles | Group | Level 6 |
| **Full Assault** | 3+ soldiers vs complex defense | Group | Level 7 |

- **Solo drills:** Train one soldier at a time. Each drill focuses on a specific skill.
- **Group drills:** Train 2+ soldiers together. Each soldier uses its own brain. They learn to cooperate with teammates who may have different training histories.
- All drills use **randomized layouts** each episode to prevent memorization.
- Training costs gold per soldier per 1,000 episodes.

### Group Training: Where the Magic Happens

When multiple soldiers with DIFFERENT training histories enter a group drill together:
- Each soldier acts from its own brain (not shared weights)
- They see each other via ally observations (distance + compass)
- They learn to cooperate with teammates who have different instincts
- A scout that learned mine-avoidance paired with an assault that learned cannon-destruction develops emergent coordination: the scout navigates safely while the assault follows and provides firepower

This heterogeneous cooperation is the design's core innovation. It produces emergent squad tactics that homogeneous (shared-brain) teams can never develop.

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
| 15 | 5.47x | 8.14x |

- Offense scales at **1.12x per level** (more roster slots, better stats, harder drills)
- Defense scales at **1.15x per level** (more buildings, higher HP, new building types)
- Gap widens over time → late-game defense is formidable → offense needs real strategy to win

### What Scales

**Offense (per level):**
- Roster size increases (more soldiers to recruit and train)
- Squad size increases (1 → 2 → 3 → 5 soldiers per raid)
- Soldier stats improve (HP, damage, ammo via class upgrades)
- New soldier classes unlock
- New drills unlock (harder scenarios, group training)
- New action types unlock (grenades, sprinting, formation commands)

**Defense (per level):**
- Grid size increases (16x16 → 32x32 → 48x48 → 64x64)
- Building count cap increases
- Building HP and damage scale up
- New building types unlock
- Terrain features unlock (elevation, water, destructible cover)

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

3. **Individual brains scale with roster.** Each soldier is ~15K parameters — tiny to store, fast to train. Going from 1 to 10 soldiers per player is a storage/UI concern, not an architecture limit. Adding a new soldier never affects existing ones.

4. **New soldier classes = new strategic dimensions.** Adding a class is data in Balance.js — stat modifiers, recommended drills, UI metadata. No architecture changes needed.

5. **New drills = new training content.** Each drill is a scenario factory function. Adding a drill is adding a function to Scenario.js and a row to Balance.js.

6. **Player creativity is infinite content.** Every base layout is a new puzzle for the AI. Players ARE the content creators. Two players with identical buildings will create different challenges based on layout.

7. **Meta evolves organically.** As players discover effective base designs, attackers must adapt. As attackers get smarter, defenders must innovate. The meta-game shifts without developer intervention.

8. **Seasons and events slot in.** New building types, temporary modifiers, challenge scenarios — all drop into the existing engine without structural changes.

### What We Don't Build Until We Need It

- Social features (clans, chat) — bolt on later
- Monetization — gold coin IAP (buys time, not power), cosmetics later, never pay-to-win
- Complex terrain — add elevation/water as late-game unlocks
- Tournaments — emerge naturally from matchmaking infrastructure

---

## Economy: Gold Coins

Gold coins are the universal currency. Every player action that matters costs gold, and every achievement earns gold. The economy is what ties offense and defense together — you can't build a great base AND recruit and train elite soldiers without earning (or buying) enough gold. This forces strategic spending decisions.

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
| **Recruit soldiers** | Per soldier | One-time cost to add a new soldier to your roster. Scales by class. |
| **Train soldiers** | Per soldier per drill batch | Pay gold per 1,000 training episodes, PER SOLDIER in the drill. Group drills cost more (more soldiers = more compute). |
| **Buy equipment/weapons** | Per item | Unlock new soldier abilities (grenades, sprint, shields). Permanent once bought. |
| **Build defenses** | Per building | Place walls, cannons, mortars, etc. Each has a gold cost. |
| **Upgrade buildings** | Per upgrade | Increase HP, damage, range of existing buildings. |
| **Upgrade gold mine** | Tiered | Increases passive generation rate. Long-term investment. |

### Balance Principles

1. **Passive income alone should NOT sustain a competitive player.** You must raid to keep up. This drives the core loop.
2. **Training costs are PER SOLDIER.** Each soldier is a separate investment. Players must choose: train one elite deeply, or spread training across a larger squad.
3. **Defense is cheaper per unit of effectiveness than offense.** Matches the 1.15x vs 1.12x scaling — defense has the edge, which means attackers need to be SMARTER, not just richer.
4. **IAP buys time, not power.** A paying player gets gold faster. A free player gets there eventually. No exclusive items behind paywalls.
5. **Gold sinks prevent inflation.** Recruitment, training, upgrades, and building replacement keep gold flowing OUT. The mine keeps it flowing IN. The raid economy circulates it between players.
6. **Per-soldier costs are the primary gold sink.** A player with 5 soldiers training on group drills burns gold much faster than one training a single soldier — this is the key economic lever.

### Single Source of Truth

All gold costs, combat stats, reward constants, and scaling formulas live in **`src/game/Balance.js`**. Both the game code and the balance calculator (`/balance.html`) import from this file. Never hardcode balance numbers elsewhere — if a number affects gold or gameplay balance, it belongs in Balance.js.

### Economy ↔ Balance Connection

The gold economy is the BALANCING LEVER for the entire game. If offense is too strong → raise training costs. If defense is too strong → lower building costs so more players can build up. If progression is too fast → reduce raid payouts. Every balance knob in the game ultimately maps to a gold flow rate.

```
GOLD MINE (passive) ──→ GOLD POOL ──→ RECRUIT SOLDIERS (roster)
                            ↑    └──→ TRAIN SOLDIERS (drills, per-soldier)
                            │    └──→ BUILDINGS (defense)
                            │    └──→ EQUIPMENT (upgrades)
RAID REWARDS ───────────────┘
IAP ────────────────────────┘
```

---

## Technical Architecture for Scale

```
Client (Browser)
├── Sim Engine (grid, entities, combat) — deterministic, replayable
├── ML Engine (PPO per soldier, observations, rewards) — runs in Web Worker
├── Roster Manager — stores/loads individual soldier brains
├── Renderer (Three.js) — interpolated visualization
└── UI (React or vanilla) — base editor, drill selector, training dashboard, battle viewer

Server
├── Base Storage — player base layouts (just JSON grids)
├── Soldier Storage — per-soldier brain weights (~15KB each, JSON-serializable)
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

### Proof of Concept (DONE)
- [x] Single soldier learns multi-phase tactics (cannon → shield → HQ)
- [x] 100% win rate achievable through training
- [x] Visible learning progression (random → directed → tactical)
- [x] Multi-agent coordination (MAPPO prototype with shared brain)
- [x] Base editor with click-to-place buildings

### MVP
- [x] Individual soldier brains (replace shared brain)
- [x] Soldier class system (2 classes: SOLDIER, ARMORED)
- [x] Roster management UI (recruit, view, retire soldiers)
- [x] Drill-based training (solo drills, 4+ drill types)
- [ ] Squad composition UI (pick soldiers for a raid)
- [x] Basic metrics dashboard (win rate, episode count, reward chart)

### Alpha
- [ ] All 5 building types
- [x] Group training drills (2+ soldiers with independent brains)
- [ ] Async PvP (raid other players' bases, one-shot)
- [ ] BPR matchmaking
- [ ] Replay system

### Beta
- [ ] Full progression system (levels, unlocks, new classes)
- [ ] Leaderboards (offense + defense)
- [ ] Balance tuning from real player data
- [ ] Mobile-responsive

---

## Guiding Principles

1. **The fun is watching AI learn.** Every design decision should make learning MORE visible, MORE dramatic, MORE satisfying to watch.

2. **Players are content creators.** Their bases are the puzzles. Their soldiers are the solvers. We build the engine; they build the game.

3. **Simple rules, emergent complexity.** Five building types create infinite combinations. Eight actions create infinite strategies. Complexity comes from interaction, not enumeration.

4. **Every soldier is an investment.** Individual brains mean every soldier has a unique training history. Players develop attachment to soldiers they've invested time and gold into. This creates emotional stakes that shared brains can never produce.

5. **Defense has the edge.** A well-built base should be HARD to crack. This drives the training loop — players NEED smarter soldiers, which means more engagement.

6. **Scale is the game.** If it can't grow, it's a demo. Every system we build must support years of expanding content, player progression, and meta evolution.
