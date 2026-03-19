// Roster.js — Manages a roster of individually-trained soldiers.
// Each soldier has its own PPO brain, class, name, and training history.
// Persists to localStorage.

import { PPO } from '../ml/PPO.js';
import { BALANCE } from './Balance.js';
import { rosterSlotsAtLevel, recruitCost } from './Balance.js';

const STORAGE_KEY = 'toySoldiersRoster';

let nextSoldierId = 1;

// Generate a random soldier name
const FIRST_NAMES = [
  'Ace', 'Blaze', 'Colt', 'Duke', 'Echo', 'Flint', 'Ghost', 'Hawk',
  'Iron', 'Jax', 'Knox', 'Lynx', 'Mace', 'Nova', 'Onyx', 'Pike',
  'Rex', 'Sage', 'Tank', 'Vex', 'Wolf', 'Zeke', 'Ash', 'Bolt',
  'Chip', 'Dash', 'Edge', 'Finn', 'Grit', 'Haze',
];

function randomName() {
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const num = Math.floor(Math.random() * 100);
  return `${name}-${num}`;
}

// Serialize Float32Arrays to plain arrays for JSON storage
function serializeWeights(saved) {
  return {
    policy: {
      weights: saved.policy.weights.map(w => Array.from(w)),
      biases: saved.policy.biases.map(b => Array.from(b)),
    },
    value: {
      weights: saved.value.weights.map(w => Array.from(w)),
      biases: saved.value.biases.map(b => Array.from(b)),
    },
  };
}

// Deserialize plain arrays back to Float32Arrays
function deserializeWeights(data) {
  return {
    policy: {
      weights: data.policy.weights.map(w => new Float32Array(w)),
      biases: data.policy.biases.map(b => new Float32Array(b)),
    },
    value: {
      weights: data.value.weights.map(w => new Float32Array(w)),
      biases: data.value.biases.map(b => new Float32Array(b)),
    },
  };
}

export class SoldierRecord {
  constructor(id, name, soldierClass, brain) {
    this.id = id;
    this.name = name;
    this.soldierClass = soldierClass; // 'ASSAULT' | 'SCOUT' | 'SUPPORT'
    this.brain = brain;               // PPO instance
    this.totalEpisodes = 0;           // total training episodes completed
    this.drillHistory = {};           // { drillName: episodeCount }
    this.createdAt = Date.now();
  }

  // Get stat multipliers from class definition
  get classStats() {
    return BALANCE.SOLDIER_CLASSES[this.soldierClass];
  }

  // Record training episodes for a drill
  recordTraining(drillName, episodes) {
    this.totalEpisodes += episodes;
    this.drillHistory[drillName] = (this.drillHistory[drillName] || 0) + episodes;
  }

  // Serialize for localStorage (brain weights + metadata)
  serialize() {
    return {
      id: this.id,
      name: this.name,
      soldierClass: this.soldierClass,
      totalEpisodes: this.totalEpisodes,
      drillHistory: this.drillHistory,
      createdAt: this.createdAt,
      weights: serializeWeights(this.brain.save()),
    };
  }

  // Restore from serialized data
  static deserialize(data) {
    const brain = new PPO();
    brain.load(deserializeWeights(data.weights));
    const record = new SoldierRecord(data.id, data.name, data.soldierClass, brain);
    record.totalEpisodes = data.totalEpisodes || 0;
    record.drillHistory = data.drillHistory || {};
    record.createdAt = data.createdAt || Date.now();
    return record;
  }
}

export class Roster {
  constructor() {
    this.soldiers = [];   // SoldierRecord[]
    this.playerLevel = 1;
    this.gold = 500;      // starting gold
    this._load();
  }

  // Max roster slots at current level
  get maxSlots() {
    return rosterSlotsAtLevel(this.playerLevel);
  }

  get size() {
    return this.soldiers.length;
  }

  // Recruit a new soldier (creates fresh PPO brain)
  recruit(soldierClass) {
    if (this.soldiers.length >= this.maxSlots) {
      return { ok: false, reason: `Roster full (${this.maxSlots} slots at level ${this.playerLevel})` };
    }

    const classDef = BALANCE.SOLDIER_CLASSES[soldierClass];
    if (!classDef) {
      return { ok: false, reason: `Unknown class: ${soldierClass}` };
    }

    const cost = classDef.recruitCost;
    if (this.gold < cost) {
      return { ok: false, reason: `Not enough gold (need ${cost}, have ${this.gold})` };
    }

    this.gold -= cost;
    const id = nextSoldierId++;
    const name = randomName();
    const brain = new PPO(); // fresh random weights
    const record = new SoldierRecord(id, name, soldierClass, brain);
    this.soldiers.push(record);
    this._save();

    return { ok: true, soldier: record };
  }

  // Get a soldier by ID
  getById(id) {
    return this.soldiers.find(s => s.id === id);
  }

  // Remove a soldier from the roster (retire)
  retire(id) {
    const idx = this.soldiers.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.soldiers.splice(idx, 1);
    this._save();
    return true;
  }

  // Save entire roster to localStorage
  _save() {
    try {
      const data = {
        playerLevel: this.playerLevel,
        gold: this.gold,
        nextSoldierId: nextSoldierId,
        soldiers: this.soldiers.map(s => s.serialize()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Roster save failed:', e.message);
    }
  }

  // Load roster from localStorage
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.playerLevel = data.playerLevel || 1;
      this.gold = data.gold ?? 500;
      nextSoldierId = data.nextSoldierId || 1;
      this.soldiers = (data.soldiers || []).map(s => SoldierRecord.deserialize(s));
    } catch (e) {
      console.warn('Roster load failed, starting fresh:', e.message);
      this.soldiers = [];
    }
  }

  // Force save (call after training batches, etc.)
  save() {
    this._save();
  }

  // Wipe roster and start fresh
  reset() {
    this.soldiers = [];
    this.playerLevel = 1;
    this.gold = 500;
    nextSoldierId = 1;
    localStorage.removeItem(STORAGE_KEY);
  }
}
