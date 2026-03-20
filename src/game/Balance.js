// Balance.js — Single source of truth for ALL game economy and combat constants.
// Both the game code and the balance calculator (balance.html) import from here.
// No imports, no side effects, deep-frozen.

function deepFreeze(obj) {
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const BALANCE = deepFreeze({

  // --- Grid ---
  GRID: { SIZE: 32 },

  // --- Buildings (Defense) ---
  // goldCost: cost to place one instance. upgrades: per-level improvements.
  // status: 'implemented' or 'planned'
  BUILDINGS: {
    HQ: {
      hp: 200, damage: 0, range: 0, fireRate: 0,
      goldCost: 0, tier: 'free', status: 'implemented',
      description: 'Headquarters. Destroy to win.',
      upgrades: [
        { level: 2, hp: 300, cost: 500 },
        { level: 3, hp: 450, cost: 1200 },
      ],
    },
    CANNON: {
      hp: 80, damage: 15, range: 8, fireRate: 3,
      goldCost: 400, tier: 'mid', status: 'implemented',
      description: 'Auto-fires at soldiers in range. Protects shield.',
      upgrades: [
        { level: 2, hp: 100, damage: 18, range: 9, cost: 600 },
        { level: 3, hp: 130, damage: 22, range: 10, cost: 1000 },
      ],
    },
    WALL: {
      hp: 120, damage: 0, range: 0, fireRate: 0,
      goldCost: 80, tier: 'cheap', status: 'implemented',
      description: 'Blocks movement. Must path around.',
      upgrades: [
        { level: 2, hp: 180, cost: 120 },
        { level: 3, hp: 260, cost: 200 },
      ],
    },
    MINE: {
      hp: 0, damage: 999, range: 0, fireRate: 0,
      goldCost: 60, tier: 'cheap', status: 'implemented',
      description: 'Instant kill on contact. Hidden threat.',
      upgrades: [],
    },
    SHIELD_GENERATOR: {
      hp: 0, damage: 0, range: 0, fireRate: 0,
      goldCost: 500, tier: 'mid', status: 'implemented',
      description: 'Creates shield line. Drops when all cannons destroyed.',
      upgrades: [],
    },
    SNIPER_TOWER: {
      hp: 60, damage: 40, range: 12, fireRate: 6,
      goldCost: 1000, tier: 'high', status: 'planned',
      description: 'Long range, high damage, slow fire rate.',
      upgrades: [
        { level: 2, hp: 75, damage: 48, range: 13, cost: 1500 },
      ],
    },
    MORTAR: {
      hp: 70, damage: 30, range: 10, fireRate: 8,
      goldCost: 1200, tier: 'high', status: 'planned',
      telegraphTicks: 3, splashRadius: 1,
      description: 'Area damage with telegraph. Punishes standing still.',
      upgrades: [
        { level: 2, hp: 90, damage: 38, splashRadius: 2, cost: 1800 },
      ],
    },
    HEAL_STATION: {
      hp: 50, damage: 0, range: 0, fireRate: 0,
      goldCost: 900, tier: 'high', status: 'planned',
      healRate: 2, healRange: 4,
      description: 'Heals nearby defense buildings over time.',
      upgrades: [
        { level: 2, hp: 65, healRate: 3, healRange: 5, cost: 1400 },
      ],
    },
  },

  // --- Soldier (Offense) ---
  // Base stats shared by all classes. Class modifiers adjust these.
  SOLDIER: {
    hp: 200,
    damage: 25,
    range: 8,
    ammo: 30,
    shootCooldown: 2,
    duckDamageReduction: 0.5,
  },

  // --- Soldier Classes ---
  // Two classes with stat multipliers applied to SOLDIER base stats.
  // Any class can train on any drill. All classes use the same neural network shape.
  SOLDIER_CLASSES: {
    SOLDIER: {
      hpMultiplier: 1.0, damageMultiplier: 1.0,
      recruitCost: 200, status: 'implemented',
      description: 'Standard infantry. Balanced HP and damage.',
      recommendedDrills: ['MINE_FIELD', 'SHIELD_SIEGE'],
    },
    ARMORED: {
      hpMultiplier: 1.5, damageMultiplier: 0.6,
      recruitCost: 300, status: 'implemented',
      description: 'Heavy armor. Takes hits, but weaker offense.',
      recommendedDrills: ['CANNON_ALLEY', 'SHIELD_SIEGE'],
    },
  },

  // --- Roster ---
  // Players maintain a roster of individually-trained soldiers.
  // Each soldier = its own PPO brain (~15K parameters).
  ROSTER: {
    baseSlotsAtLevel1: 3,     // roster slots at level 1
    slotsPerLevel: 0.5,       // additional slots per level (rounded down)
    maxSlots: 10,             // hard cap on roster size
    // Derived: level 1 = 3, level 5 = 5, level 10 = 7, level 15 = 10
  },

  // --- Training Drills ---
  // Dedicated training scenarios. Training does NOT happen against the player's own base.
  // Solo drills train one soldier at a time. Group drills train 2+ soldiers together.
  // Each drill uses randomized layouts each episode to force generalization.
  DRILLS: {
    MINE_FIELD: {
      type: 'solo', minLevel: 1, status: 'implemented',
      description: 'Navigate through randomized mine fields.',
      teaches: 'Hazard avoidance, cautious pathing',
    },
    CANNON_ALLEY: {
      type: 'solo', minLevel: 2, status: 'planned',
      description: 'Survive and destroy cannons under fire.',
      teaches: 'Threat assessment, shooting accuracy, cover usage',
    },
    SHIELD_SIEGE: {
      type: 'solo', minLevel: 2, status: 'implemented',
      description: 'Destroy cannons to drop shield, then assault HQ.',
      teaches: 'Multi-phase planning, target prioritization',
    },
    THE_MAZE: {
      type: 'solo', minLevel: 3, status: 'implemented',
      description: 'Navigate wall mazes to reach the objective.',
      teaches: 'Pathfinding around obstacles',
    },
    KILL_ZONE: {
      type: 'solo', minLevel: 4, status: 'planned',
      description: 'Survive overlapping sniper and cannon fields of fire.',
      teaches: 'Timing advances, using cover, burst movement',
    },
    SQUAD_BASICS: {
      type: 'group', minLevel: 1, minSoldiers: 2, status: 'implemented',
      description: 'Two soldiers learn to cooperate without clustering.',
      teaches: 'Spacing, not blocking allies, basic coordination',
    },
    FLANKING_DRILL: {
      type: 'group', minLevel: 2, minSoldiers: 2, status: 'implemented',
      description: 'Multiple soldiers attack from different angles.',
      teaches: 'Flanking, splitting attention of defenses',
    },
    FULL_ASSAULT: {
      type: 'group', minLevel: 7, minSoldiers: 3, status: 'planned',
      description: 'Full squad vs complex defense layout.',
      teaches: 'Role specialization, coordinated multi-phase assault',
    },
  },

  // --- Weapons (Offense) ---
  WEAPONS: {
    RIFLE: {
      damage: 25, range: 8, ammo: 30, cooldown: 2,
      goldCost: 0, tier: 'free', status: 'implemented',
      description: 'Standard weapon. Reliable at medium range.',
    },
    SPRINT: {
      speedMultiplier: 2, durationTicks: 3, cooldownTicks: 10,
      goldCost: 600, tier: 'mid', status: 'planned',
      description: 'Burst of speed. Dodge cannons, close gaps.',
    },
    GRENADE: {
      damage: 40, range: 6, ammo: 3, cooldown: 5, splashRadius: 1,
      goldCost: 1500, tier: 'high', status: 'planned',
      description: 'Area damage. Good against clustered buildings.',
    },
    PERSONAL_SHIELD: {
      absorbHP: 60, uses: 1,
      goldCost: 1800, tier: 'high', status: 'planned',
      description: 'One-time damage absorb. Survive cannon fire.',
    },
    HEAL_PACK: {
      healAmount: 50, uses: 2, cooldown: 8,
      goldCost: 700, tier: 'mid', status: 'planned',
      description: 'Self-heal. Extends combat survivability.',
    },
  },

  // --- Player Levels ---
  // Each level unlocks new equipment for both offense and defense.
  // buildBudget: total gold available for placing buildings.
  // maxBuildings: max number of buildings on the grid.
  PLAYER_LEVELS: {
    MAX: 15,
    progression: [
      null, // index 0 unused (levels are 1-based)
      // Level 1: Tutorial — mines only
      { level: 1, unlocks: ['MINE'],
        buildBudget: 800,   maxBuildings: 10,
        passiveGoldPerHour: 50,  trainingCostPer1000: 100 },
      // Level 2: Cannons + Shield (matches curriculum: mines → combat → walls)
      { level: 2, unlocks: ['CANNON', 'SHIELD_GENERATOR'],
        buildBudget: 1200,  maxBuildings: 14,
        passiveGoldPerHour: 60,  trainingCostPer1000: 115 },
      // Level 3: Walls (pathfinding layers on top of combat skills)
      { level: 3, unlocks: ['WALL'],
        buildBudget: 2000,  maxBuildings: 18,
        passiveGoldPerHour: 72,  trainingCostPer1000: 132 },
      // Level 4: Sniper Tower + Sprint (paired: burst damage → dash counter)
      { level: 4, unlocks: ['SNIPER_TOWER', 'SPRINT'],
        buildBudget: 2800,  maxBuildings: 22,
        passiveGoldPerHour: 86,  trainingCostPer1000: 152 },
      // Level 5: Mortar + Grenade (paired: AoE defense → AoE offense counter)
      { level: 5, unlocks: ['MORTAR', 'GRENADE'],
        buildBudget: 3800,  maxBuildings: 26,
        passiveGoldPerHour: 103, trainingCostPer1000: 175 },
      // Level 6: Heal Station (pure AI challenge — no weapon counter needed)
      { level: 6, unlocks: ['HEAL_STATION'],
        buildBudget: 5000,  maxBuildings: 30,
        passiveGoldPerHour: 124, trainingCostPer1000: 201 },
      // Level 7: Personal Shield (offense tankiness for multi-threat bases)
      { level: 7, unlocks: ['PERSONAL_SHIELD'],
        buildBudget: 6500,  maxBuildings: 34,
        passiveGoldPerHour: 149, trainingCostPer1000: 231 },
      // Level 8: Heal Pack (sustain for dense compound bases)
      { level: 8, unlocks: ['HEAL_PACK'],
        buildBudget: 8500,  maxBuildings: 38,
        passiveGoldPerHour: 179, trainingCostPer1000: 266 },
      // Level 9-15: Scaling with upgrades, higher tiers
      { level: 9, unlocks: [],
        buildBudget: 11000, maxBuildings: 42,
        passiveGoldPerHour: 215, trainingCostPer1000: 306 },
      { level: 10, unlocks: [],
        buildBudget: 14000, maxBuildings: 46,
        passiveGoldPerHour: 258, trainingCostPer1000: 352 },
      { level: 11, unlocks: [],
        buildBudget: 18000, maxBuildings: 50,
        passiveGoldPerHour: 310, trainingCostPer1000: 405 },
      { level: 12, unlocks: [],
        buildBudget: 23000, maxBuildings: 54,
        passiveGoldPerHour: 372, trainingCostPer1000: 466 },
      { level: 13, unlocks: [],
        buildBudget: 29000, maxBuildings: 58,
        passiveGoldPerHour: 446, trainingCostPer1000: 536 },
      { level: 14, unlocks: [],
        buildBudget: 37000, maxBuildings: 62,
        passiveGoldPerHour: 535, trainingCostPer1000: 616 },
      { level: 15, unlocks: [],
        buildBudget: 47000, maxBuildings: 66,
        passiveGoldPerHour: 642, trainingCostPer1000: 709 },
    ],
  },

  // --- Training Economy ---
  // Training costs are PER SOLDIER PER DRILL BATCH.
  // A group drill with 3 soldiers costs 3x a solo drill (each brain trains independently).
  TRAINING: {
    costPer1000Runs: 100,       // base gold cost per 1000 training episodes PER SOLDIER
    costScalePerLevel: 1.15,    // compound multiplier per player level
    runsPerBatch: 1000,         // episodes per training batch
    groupDrillMultiplier: 1.0,  // no surcharge — cost is just per-soldier (3 soldiers = 3x)
  },

  // --- Loot / Raid Rewards ---
  LOOT: {
    raidRewardPct: 0.15,        // attacker steals 15% of defender's stored gold
    raidRewardCap: 5000,        // max gold per raid at level 1 (scales 1.3x/level)
    raidRewardCapScale: 1.3,    // cap multiplier per player level
    raidRewardFloor: 50,        // minimum gold per raid
    defenseReward: 30,          // gold for successful defense (passive, lower)
    defenseRewardScale: 1.2,    // defense reward multiplier per level
  },

  // --- Passive Income ---
  PASSIVE_INCOME: {
    baseGoldPerHour: 50,        // level 1 passive income
    scalePerLevel: 1.2,         // compound multiplier per level
    // At level 1: 50/hr, level 5: ~104/hr, level 10: ~258/hr, level 15: ~642/hr
  },

  // --- In-App Purchases ---
  IAP: {
    packs: [
      { name: 'Pouch',    gold: 500,    priceUSD: 0.99 },
      { name: 'Sack',     gold: 2800,   priceUSD: 4.99 },
      { name: 'Chest',    gold: 6500,   priceUSD: 9.99 },
      { name: 'Vault',    gold: 15000,  priceUSD: 19.99 },
      { name: 'Armory',   gold: 42000,  priceUSD: 49.99 },
      { name: 'Treasury', gold: 100000, priceUSD: 99.99 },
    ],
  },

  // --- Reward Shaping (ML Training) ---
  REWARDS: {
    survivalTick: -0.01,
    idlePenalty: -0.02,
    damageDealtMultiplier: 0.1,
    hqKillBonus: 1.0,
    damageTakenMultiplier: -0.03,
    shotMissedPenalty: -0.05,
    shotHitBonus: 0.5,
    distanceApproachMultiplier: 0.5,
    mineApproachPenalty: -0.3,
    cannonDestroyedBonus: 5.0,
    winReward: 20.0,
    mineDeathPenalty: -5.0,
    killedPenalty: -3.0,
    timeoutPenalty: -2.0,
    mineProximityThreshold: 5,
    // Multi-agent coordination
    clusterRadius: 3,           // distance threshold for clustering penalty
    clusterPenalty: -0.05,      // penalty per nearby ally (discourages stacking)
    allyDeathPenalty: -1.0,     // negative when a teammate dies this tick
  },

  // --- PPO Hyperparameters ---
  PPO: {
    gamma: 0.99,
    lambda: 0.95,
    clipEpsilon: 0.2,
    entropyCoeff: 0.05,
    valueCoeff: 0.5,
    epochs: 4,
    minibatchSize: 64,
    maxGradNorm: 0.5,
    learningRate: 3e-4,
    horizon: 128,
    networkLayers: [64, 32], // hidden layer sizes (input/output added dynamically)
  },

  // --- Scenarios ---
  SCENARIOS: {
    maxStepsSimple: 200,   // levels without cannons
    maxStepsCombat: 500,   // levels with cannons
    maxStepsSquad: 600,    // multi-soldier coordination levels
  },
});

// --- Derived Calculations ---
// Pure functions that compute from the constants above.
// Used by both game code and balance calculator.

export function trainingCostAtLevel(level) {
  const base = BALANCE.TRAINING.costPer1000Runs;
  return Math.round(base * Math.pow(BALANCE.TRAINING.costScalePerLevel, level - 1));
}

export function passiveIncomeAtLevel(level) {
  const base = BALANCE.PASSIVE_INCOME.baseGoldPerHour;
  return Math.round(base * Math.pow(BALANCE.PASSIVE_INCOME.scalePerLevel, level - 1));
}

export function raidRewardForGold(defenderGold, attackerLevel) {
  const pct = BALANCE.LOOT.raidRewardPct;
  const cap = BALANCE.LOOT.raidRewardCap * Math.pow(BALANCE.LOOT.raidRewardCapScale, attackerLevel - 1);
  const floor = BALANCE.LOOT.raidRewardFloor;
  const raw = defenderGold * pct;
  return Math.round(Math.max(floor, Math.min(cap, raw)));
}

export function defenseRewardAtLevel(level) {
  return Math.round(BALANCE.LOOT.defenseReward * Math.pow(BALANCE.LOOT.defenseRewardScale, level - 1));
}

export function raidRewardCapAtLevel(level) {
  return Math.round(BALANCE.LOOT.raidRewardCap * Math.pow(BALANCE.LOOT.raidRewardCapScale, level - 1));
}

export function goldPerDollar(packIndex) {
  const pack = BALANCE.IAP.packs[packIndex];
  if (!pack) return 0;
  return Math.round(pack.gold / pack.priceUSD);
}

export function breakEvenRaids(level, avgDefenderGold) {
  const cost = trainingCostAtLevel(level);
  const reward = raidRewardForGold(avgDefenderGold, level);
  if (reward <= 0) return Infinity;
  return Math.ceil(cost / reward);
}

export function hoursToEarn(targetGold, level) {
  const passive = passiveIncomeAtLevel(level);
  if (passive <= 0) return Infinity;
  return targetGold / passive;
}

export function buildBudgetAtLevel(level) {
  const prog = BALANCE.PLAYER_LEVELS.progression[level];
  return prog ? prog.buildBudget : 0;
}

export function maxBuildingsAtLevel(level) {
  const prog = BALANCE.PLAYER_LEVELS.progression[level];
  return prog ? prog.maxBuildings : 0;
}

export function rosterSlotsAtLevel(level) {
  const base = BALANCE.ROSTER.baseSlotsAtLevel1;
  const extra = Math.floor((level - 1) * BALANCE.ROSTER.slotsPerLevel);
  return Math.min(base + extra, BALANCE.ROSTER.maxSlots);
}

export function squadSizeAtLevel(level) {
  // Squad size for raids: 1 at level 1, scales up
  if (level <= 1) return 1;
  if (level <= 4) return 2;
  if (level <= 7) return 3;
  if (level <= 11) return 4;
  return 5;
}

export function recruitCost(soldierClass) {
  const cls = BALANCE.SOLDIER_CLASSES[soldierClass];
  return cls ? cls.recruitCost : 0;
}

export function drillTrainingCost(level, numSoldiers) {
  // Cost = base per 1000 runs * level scaling * number of soldiers
  const baseCost = trainingCostAtLevel(level);
  return baseCost * numSoldiers;
}
