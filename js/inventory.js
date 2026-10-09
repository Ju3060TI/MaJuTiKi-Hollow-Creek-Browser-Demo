// Backpack: 5x4 grid with a weight limit

import { MAX_WEIGHT } from './constants.js';
import { getItem } from './items.js';

export class Inventory {
  constructor(cols = 5, rows = 4) {
    this.cols = cols;
    this.rows = rows;
    this.slots = new Array(cols * rows).fill(null);
    this.version = 0;
  }

  get size() { return this.slots.length; }

  add(id, count = 1) {
    const def = getItem(id);
    if (!def) return false;
    if (this.weight() + def.weight * count > MAX_WEIGHT) return false;

    // Non-stackable: first free slot
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { id, count };
        this.version++;
        return true;
      }
    }
    return false;
  }

  remove(id) {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        this.slots[i] = null;
        this.version++;
        return true;
      }
    }
    return false;
  }

  has(id) {
    return this.slots.some((s) => s && s.id === id);
  }

  weight() {
    let w = 0;
    for (const s of this.slots) {
      if (!s) continue;
      const def = getItem(s.id);
      if (def) w += def.weight * s.count;
    }
    return w;
  }

  // 0..1 slowdown factor from carried weight
  loadFactor() {
    const w = this.weight() / MAX_WEIGHT;
    return 1 - Math.min(0.42, w * 0.42);
  }

  count() {
    return this.slots.filter(Boolean).length;
  }
}
