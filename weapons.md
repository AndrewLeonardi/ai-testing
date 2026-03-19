# Weapons & Offense Registry

> Two sides of the same coin. Every weapon here exists because a defense item in `defense.md` forces the AI to need it. If a weapon doesn't counter a specific defense, it's stat inflation — cut it.
>
> **Gold costs and combat stats are defined in `src/game/Balance.js` — that file is the single source of truth.** Values in this doc are for design discussion; the code is authoritative. See `/balance.html` for the interactive economy calculator.

---

## Design Rule

A new weapon is justified ONLY when:
1. A defense building creates a problem the current toolkit can't solve
2. The AI must learn a NEW behavior to use it (not just "more damage")
3. It creates counterplay — the defender can react to it with placement/strategy

---

## Current Weapons (Implemented)

### Base Kit — Rifle
| Stat | Value | Notes |
|------|-------|-------|
| Damage | 25 | Per shot |
| Range | 8 tiles | Cardinal directions only (N/E/S/W) |
| Ammo | 30 | Per episode |
| Cooldown | 2 ticks | Between shots |
| Gold cost | — | Free, starting equipment |

**What it teaches the AI:** Aim alignment (must face target on same row/column), ammo conservation, timing shots between cannon fire.

**Countered by:** Walls (block shots), distance (8-tile range limit), cannon suppression (forces ducking).

**Status:** IMPLEMENTED and validated. Core weapon for Level 1-2 curriculum.

---

### Duck/Cover (Ability)
| Stat | Value | Notes |
|------|-------|-------|
| Damage reduction | 50% | While ducking |
| Movement | Blocked | Must STAND before moving |
| Gold cost | — | Free, starting ability |

**What it teaches the AI:** Damage mitigation, timing (duck during cannon volleys, stand to advance).

**Countered by:** Mortars (AoE ignores ducking position), time pressure (ducking = not advancing).

**Status:** IMPLEMENTED. AI learns to duck situationally.

---

## Planned Weapons (Not Yet Implemented)

### Sprint
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| Speed | 2 tiles/tick | Double normal speed |
| Duration | 3 ticks | Then forced cooldown |
| Cooldown | 10 ticks | Can't spam it |
| Gold cost | 600 | Mid-tier unlock |

**Why it exists:** Sniper Tower (defense.md) creates kill lanes the AI can't cross at normal speed. Sprint lets soldiers dash through danger zones.

**What it teaches the AI:** Timing (sprint BETWEEN sniper shots), resource management (when to burn the cooldown).

**Countered by:** Walls (can't sprint through them), mortar (AoE catches sprinters who run into splash zone).

**Balance check:** Sprint + rifle must NOT trivialize cannons. Sprint is for crossing, not for closing to point-blank.

**Status:** NOT IMPLEMENTED. Unlocks with Sniper Tower (Phase 5).

---

### Grenade
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| Damage | 40 | In 3x3 AoE |
| Range | 6 tiles | Arc trajectory, ignores walls |
| Ammo | 3 | Very limited |
| Cooldown | 5 ticks | Slow reload |
| Gold cost | 1500 | High-tier unlock |

**Why it exists:** Walls (defense.md) block rifle shots. Grenades arc OVER walls to hit buildings behind them.

**What it teaches the AI:** Spatial planning (position for arc shots), ammo management (only 3 grenades — pick targets carefully), wall-awareness (use grenades on walled targets, rifle on open ones).

**Countered by:** Spread-out bases (3x3 AoE wasted on isolated buildings), high-HP buildings (40 damage might not kill).

**Balance check:** 3 grenades at 40 damage = 120 total AoE damage. Should NOT be enough to solo a well-built base. Grenades open a path; the rifle finishes the job.

**Status:** NOT IMPLEMENTED. Unlocks with Walls/Mortar (Phase 5).

---

### Personal Shield
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| Absorb | 60 HP | Then breaks |
| Duration | Until broken | No time limit |
| Cooldown | Once per episode | One-time use |
| Gold cost | 1800 | High-tier unlock |

**Why it exists:** Late-game bases with multiple damage sources (cannons + snipers + mortars) overwhelm raw HP. Shield lets a soldier tank one push.

**What it teaches the AI:** Timing (activate shield before entering kill zone, not randomly), aggression windows (shield up = push hard NOW).

**Countered by:** Sustained DPS (60 HP burns fast against multiple cannons), heal stations (buildings regenerate what the shielded push damaged).

**Balance check:** 200 HP soldier + 60 shield = 260 effective HP for one push. Must not be enough to solo a late-game base — forces squad coordination (one tanks, others flank).

**Status:** NOT IMPLEMENTED. Unlocks Phase 5+.

---

### Heal Pack
| Stat | Value (Proposed) | Balance Notes |
|------|------------------|---------------|
| Heal | 50 HP | Instant self-heal |
| Uses | 2 per episode | Limited |
| Cooldown | 8 ticks | Between uses |
| Gold cost | 700 | Mid-tier unlock |

**Why it exists:** Extended engagements against complex bases drain HP. Heal packs enable retreat-and-push tactics instead of YOLO rushes.

**What it teaches the AI:** Retreat behavior (fall back when low, heal, re-engage), HP awareness (use heal pack at the RIGHT time, not too early/too late).

**Countered by:** Burst damage (sniper one-shots ignore healing), time pressure (healing = not attacking = timeout risk).

**Balance check:** 2 heals × 50 HP = 100 extra HP per episode. Combined with 200 base HP = 300 effective HP. Spread across an entire episode, this is sustain — not invincibility.

**Status:** NOT IMPLEMENTED. Unlocks Phase 5+.

---

## Gold Cost Framework (Offense)

| Tier | Items | Approximate Gold Cost | Rationale |
|------|-------|----------------------|-----------|
| Free | Rifle, Duck | 0 | Starting kit, always available |
| Mid | Sprint, Heal Pack | ~500-800 gold | First meaningful upgrades, affordable after a few raids |
| High | Grenade, Personal Shield | ~1200-2000 gold | Late unlocks, require investment |

**Principle:** Training costs (per session) should be ~2-5x a single raid reward. You should need to win 2-5 raids to fund a serious training session. Equipment is a one-time buy that permanently expands your toolkit.

---

## Balance Validation Checklist

For EVERY new weapon, before shipping:

- [ ] Does it counter a specific defense building? (Name it)
- [ ] Does the AI learn a visibly NEW behavior with it?
- [ ] Can the defender react to it with building placement?
- [ ] Does it NOT make any existing weapon obsolete?
- [ ] Is the gold cost proportional to its impact?
- [ ] Has it been tested in curriculum (does the AI actually learn to use it)?
- [ ] Does it work in multi-agent (MAPPO) without breaking squad dynamics?
