# Defense & Buildings Registry

> Two sides of the same coin. Every building here exists to force the AI to learn a new behavior. If the AI doesn't need to change its strategy to beat it, the building is cosmetic — cut it. Check `weapons.md` for the corresponding offense counters.
>
> **Gold costs and combat stats are defined in `src/game/Balance.js` — that file is the single source of truth.** Values in this doc are for design discussion; the code is authoritative. See `/balance.html` for the interactive economy calculator.

---

## Design Rule

A new building is justified ONLY when:
1. It forces the AI to learn a NEW, visible behavior (not just "take more damage")
2. It gives the player a meaningful placement decision (WHERE matters, not just WHAT)
3. There's a corresponding offense counter that creates counterplay (or it unlocks one)

---

## Current Buildings (Implemented)

### HQ (Headquarters)
| Stat | Value | Notes |
|------|-------|-------|
| HP | 200 | Primary objective |
| Damage | 0 | No attacks |
| Range | — | — |
| Gold cost | — | Free, every base has one (fixed position) |

**Role:** The win condition. Destroy the HQ = win the raid. Everything else exists to PROTECT the HQ.

**Placement:** Fixed position (currently 16,24 in Level 2). In base editor, player-chosen but must be on the grid.

**What it forces the AI to learn:** Navigation toward a target, distance optimization, the concept of an objective.

**Status:** IMPLEMENTED. Core of every scenario.

---

### Cannon
| Stat | Value | Notes |
|------|-------|-------|
| HP | 80 | Destructible |
| Damage | 15 | Per shot |
| Range | 8 tiles | Line-of-sight required |
| Fire rate | Every 3 ticks | Stochastic targeting (distance-weighted) |
| Gold cost | 400 | Mid tier |

**Role:** Active DPS defense. Damages soldiers as they approach. Primary threat in early-mid game.

**Placement matters:** Near HQ = last line of defense. Forward = suppression. Behind walls = protected DPS.

**What it forces the AI to learn:** Threat avoidance, target prioritization (kill cannons to reduce DPS), ducking to mitigate damage, approach angles that minimize exposure time.

**Countered by:** Rifle (direct fire), positioning (approach from blind angles), ducking (50% damage reduction). Later: grenades (arc over walls protecting cannons).

**Balance check:** 2 cannons at 15 damage every 3 ticks = 10 DPS combined. Soldier has 200 HP = ~20 ticks of sustained fire to kill. With ducking, ~40 ticks. This gives enough time to approach and destroy them.

**Status:** IMPLEMENTED. 2 cannons in Level 2. AI learns to prioritize and destroy them.

---

### Shield Generator
| Stat | Value | Notes |
|------|-------|-------|
| HP | — | Indirect — drops when all cannons destroyed |
| Effect | Force field blocks movement and shots | Horizontal line |
| Gold cost | 500 | Mid tier (paired with cannons) |

**Role:** Creates multi-phase gameplay. Forces "destroy cannons FIRST, then push through to HQ." Without it, soldiers would just rush past cannons straight to HQ.

**Placement matters:** Shield line position determines HOW MUCH of the base is protected. Wider shield = more area covered = harder to flank.

**What it forces the AI to learn:** Multi-phase planning (Phase 1: destroy cannons → Phase 2: push HQ), sub-objective identification, phase-aware strategy switching.

**Countered by:** Destroying all cannons (the ONLY counter right now). Later: grenades might damage generators directly.

**Balance check:** Shield is binary (up or down). The cost is in the CANNONS the player must place to keep it active. More cannons = shield stays up longer = more gold spent on defense.

**Status:** IMPLEMENTED. Shield line at y=20 in Level 2. Drops when both cannons destroyed. AI learns the two-phase approach.

---

### Mine
| Stat | Value | Notes |
|------|-------|-------|
| HP | — | Consumed on trigger |
| Damage | Instant kill | One-hit kill on contact |
| Visibility | Only in 5x5 view (2 tiles) | Hard to see coming |
| Gold cost | 60 | Cheap (expendable) |

**Role:** Area denial. Forces cautious pathing instead of beeline rushing. Punishes agents that haven't learned spatial awareness.

**Placement matters:** Direct paths = obvious but effective. Side paths = catches flankers. Clustered = area denial. Scattered = psychological pressure.

**What it forces the AI to learn:** Hazard avoidance, cautious pathing, NOT taking the shortest route, reading the mine channel in observations.

**Countered by:** Observation (mines visible in 5x5 view), pathing around them. Current issue: 2-tile visibility range is very tight. Plan to add mine compass (Phase 1.1).

**Balance check:** Instant kill is harsh but mines are one-use. A 6-mine field costs the defender gold but can be navigated with training. The question: how many episodes does it take the AI to learn? Currently inconsistent — Phase 1 goal is fixing this.

**Status:** IMPLEMENTED but INCONSISTENT. Level 1 has 6 mines. AI sometimes learns avoidance, sometimes doesn't. Phase 1 priority: mine compass + better death signal.

---

### Wall
| Stat | Value | Notes |
|------|-------|-------|
| HP | 120 | Destructible (but expensive to shoot down) |
| Effect | Blocks movement AND shots | Full obstruction |
| Gold cost | 80 | Cheap (structural) |

**Role:** Maze-building, channeling attackers into kill zones, protecting key buildings from direct fire.

**Placement matters:** THIS IS THE CORE OF BASE DESIGN. Wall placement defines the base topology — funnels, chokepoints, protected pockets, sniper lanes. Good wall design is the #1 skill differentiator between players.

**What it forces the AI to learn:** Pathfinding around obstacles, NOT getting stuck in dead ends, exploring alternate routes, patience (longer paths = more time under fire).

**Countered by:** Pathfinding (go around), grenades (arc over them, planned), destroying them with rifle (120 HP = 5 shots, but wastes ammo/time).

**Balance check:** 120 HP = 5 rifle shots to destroy. With 30 ammo, a soldier can break through ~6 walls max — but that leaves no ammo for cannons/HQ. Forces the choice: break through or go around?

**Status:** IMPLEMENTED in code (Entity/Grid supports walls), NOT YET in curriculum. Phase 2 will add walls to Level 3.

---

## Planned Buildings (Not Yet Implemented)

### Sniper Tower
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| HP | 60 | Glass cannon — low HP, high damage |
| Damage | 40 | Per shot — massive single hits |
| Range | 12 tiles | Longest range in game |
| Fire rate | Every 6 ticks | Very slow — creates timing windows |
| Gold cost | 1000 | High tier |

**Why it exists:** Current defense is all "constant DPS" (cannons). Sniper adds BURST damage with TIMING WINDOWS. The AI must learn to advance BETWEEN shots, not just tank through.

**What it forces the AI to learn:** Timing (count ticks between shots, advance during reload), cover usage (hide behind walls between shots), threat awareness (know where the sniper is aiming).

**Creates demand for:** Sprint (weapons.md) — dash through the kill lane during reload window.

**Placement:** At the back of the base with clear sight lines. Pairs with walls that create narrow approach lanes.

**Balance check:** 40 damage every 6 ticks = 6.7 DPS (lower than cannon's ~5 DPS per cannon). But the BURST pattern is what matters — one hit takes 20% of soldier HP. Forces different behavior than cannons.

**Status:** NOT IMPLEMENTED. Phase 5.

---

### Mortar
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| HP | 70 | Mid-range durability |
| Damage | 30 | In 3x3 AoE splash zone |
| Range | 10 tiles | Indirect fire (ignores walls) |
| Fire rate | Every 8 ticks | Very slow, but devastating |
| Telegraph | 3 ticks | Shows target zone BEFORE impact |
| Gold cost | 1200 | High tier |

**Why it exists:** Punishes STANDING STILL and CLUSTERING. Current AI can learn to sit in one spot and shoot. Mortars force constant movement. In multi-agent, mortars punish soldiers that bunch up.

**What it forces the AI to learn:** Continuous movement, reading telegraphed danger zones, NOT clustering with allies (multi-agent), spatial prediction.

**Creates demand for:** Grenade (weapons.md) — grenades arc over walls to hit mortars hiding behind fortifications.

**Placement:** Behind walls (safe from direct fire), covering open areas where soldiers must cross.

**Balance check:** 3-tick telegraph = fair warning. 30 damage in 3x3 is deadly to grouped soldiers but survivable for a single soldier who moves. This is the ANTI-CLUSTERING building for MAPPO phases.

**Status:** NOT IMPLEMENTED. Phase 5.

---

### Heal Station
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| HP | 50 | Low — it's a priority target |
| Heal rate | 2 HP/tick | To buildings within range 4 |
| Heal targets | Buildings only | Does NOT heal other heal stations |
| Gold cost | 900 | Mid-high tier |

**Why it exists:** Creates target prioritization puzzles. If the AI just attacks the nearest cannon, the heal station keeps it alive. Forces the AI to identify and eliminate the HEALER first.

**What it forces the AI to learn:** Target prioritization (kill healer before DPS), strategic sequencing, recognizing that some buildings enable others.

**Creates demand for:** No specific weapon — this is a PURE AI learning challenge. The counter is smart target ordering, not a new tool.

**Placement:** Near cannons (heals them) vs. near HQ (heals it). Player must choose what to protect.

**Balance check:** 2 HP/tick on an 80 HP cannon means the cannon regens fully in 40 ticks. If the soldier takes 5 shots to kill a cannon (25 damage × 5 = 125 damage with cooldowns), the cannon regens ~20 HP during that time. Meaningful but not insurmountable. Kill the healer first and the math reverts to normal.

**Status:** NOT IMPLEMENTED. Phase 5.

---

## Gold Cost Framework (Defense)

| Tier | Buildings | Approximate Gold Cost | Rationale |
|------|-----------|----------------------|-----------|
| Free | HQ | 0 | Every base has one |
| Cheap | Wall, Mine | ~50-150 gold | Structural, expendable. Players should be able to build MANY of these. |
| Mid | Cannon, Shield Gen | ~300-600 gold | Active defense, meaningful investment |
| High | Sniper Tower, Mortar, Heal Station | ~800-1500 gold | Specialist buildings, late-game unlocks |

**Principle:** Defense is cheaper PER UNIT of effectiveness than offense. A 500-gold cannon provides ongoing DPS across many raids. A 500-gold training session benefits ONE attack. This asymmetry is intentional — it makes defense feel rewarding and drives attackers to train harder.

---

## Base Building Budget

Current grid: 32x32. Grid scaling to larger sizes is a future feature (see northstar.md). All values from Balance.js:

| Player Level | Building Budget (Gold) | Max Buildings | Notes |
|-------------|----------------------|---------------|-------|
| 1 | 800 | 10 | Mines only |
| 2 | 1,200 | 14 | + Cannons, Shield Generator |
| 3 | 2,000 | 18 | + Walls |
| 4 | 2,800 | 22 | + Sniper Tower + Sprint |
| 5 | 3,800 | 26 | + Mortar + Grenade |
| 10 | 14,000 | 46 | Mid-game scaling |
| 15 | 47,000 | 66 | Endgame |

---

## Balance Validation Checklist

For EVERY new building, before shipping:

- [ ] Does it force a NEW, visible AI behavior? (Describe it)
- [ ] Does placement matter? (Can two players use it differently?)
- [ ] Is there a corresponding offense counter? (Name it, link to weapons.md)
- [ ] Does it NOT make any existing building obsolete?
- [ ] Is the gold cost proportional to its defensive value?
- [ ] Has it been tested in curriculum (does the AI learn to beat it)?
- [ ] Does it create interesting interactions with OTHER buildings? (Wall + cannon combo, etc.)
- [ ] In multi-agent (MAPPO), does it create squad-level challenges?
