// DOM overlay: splash, crosshair, prompts, backpack

import { MAX_WEIGHT } from './constants.js';
import { getItem } from './items.js';

export class UI {
  constructor(inventory) {
    this.inv = inventory;
    this.prompt = document.getElementById('prompt');
    this.toastEl = document.getElementById('toast');
    this.clockEl = document.getElementById('clock');
    this.weightEl = document.getElementById('weight');
    this.backpackEl = document.getElementById('backpack');
    this.gridEl = document.getElementById('bp-grid');
    this.bpWeightEl = document.getElementById('bp-weight');
    this.crosshair = document.getElementById('crosshair');
    this.splash = document.getElementById('splash');
    this.vignette = document.getElementById('vignette');

    this.open = false;
    this._toastTimer = 0;
    this._lastVersion = -1;
    this._lastPrompt = '';
    this._lastWeight = '';
    this._crossActive = false;

    this._buildGrid();
  }

  _buildGrid() {
    this.slotEls = [];
    for (let i = 0; i < this.inv.size; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      this.gridEl.appendChild(el);
      this.slotEls.push(el);
    }
  }

  fadeSplash() {
    this.splash.classList.add('fade');
    setTimeout(() => this.splash.classList.add('hidden'), 950);
  }

  hideSplash() {
    this.splash.classList.add('hidden');
  }

  setCrosshairActive(active) {
    if (active === this._crossActive) return;
    this._crossActive = active;
    this.crosshair.classList.toggle('active', active);
  }

  setPrompt(text) {
    if (text === this._lastPrompt) return;
    this._lastPrompt = text;
    if (text) {
      this.prompt.textContent = text;
      this.prompt.classList.add('show');
    } else {
      this.prompt.classList.remove('show');
    }
  }

  toast(name, note) {
    this.toastEl.innerHTML =
      '<span class="t-name">' + name + '</span>' + note;
    this.toastEl.classList.add('show');
    this._toastTimer = 6.0;
  }

  setClock(str) {
    if (this.clockEl.textContent !== str) this.clockEl.textContent = str;
  }

  setWeight(w) {
    const s = w.toFixed(1) + ' / ' + MAX_WEIGHT + ' kg';
    if (s !== this._lastWeight) {
      this._lastWeight = s;
      this.weightEl.textContent = s;
      this.bpWeightEl.textContent = s;
    }
  }

  setBinoculars(on) {
    this.vignette.classList.toggle('hidden', !on);
  }

  toggleBackpack() {
    this.open = !this.open;
    this.backpackEl.classList.toggle('hidden', !this.open);
    if (this.open) this.renderBackpack();
  }

  closeBackpack() {
    if (!this.open) return;
    this.open = false;
    this.backpackEl.classList.add('hidden');
  }

  renderBackpack() {
    for (let i = 0; i < this.inv.size; i++) {
      const el = this.slotEls[i];
      const s = this.inv.slots[i];
      if (s) {
        const def = getItem(s.id);
        el.classList.add('filled');
        el.innerHTML = def.name + '<span class="w">' + def.weight.toFixed(2) + '</span>';
      } else {
        el.classList.remove('filled');
        el.innerHTML = '';
      }
    }
    this._lastVersion = this.inv.version;
    this.bpWeightEl.textContent = this.inv.weight().toFixed(1) + ' / ' + MAX_WEIGHT + ' kg';
  }

  update(dt) {
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    if (this.open && this.inv.version !== this._lastVersion) {
      this.renderBackpack();
    }
  }
}
