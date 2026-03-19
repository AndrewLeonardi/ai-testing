// Base entity class for anything on the grid.

let nextId = 0;

export class Entity {
  constructor(x, y, hp, team) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.team = team; // 0=attacker, 1=defender
    this.alive = true;
    this.destroyedThisStep = false;
  }

  takeDamage(amount) {
    const wasAlive = this.alive;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.alive = false;
      if (wasAlive) this.destroyedThisStep = true;
    }
    return this.hp <= 0;
  }

  hpFraction() {
    return this.hp / this.maxHp;
  }
}

export function resetEntityIds() {
  nextId = 0;
}
