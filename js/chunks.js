// Chunk streaming, editing and rebuilding

import * as THREE from 'three';
import { CHUNK_SIZE, STREAM_RADIUS, VERT_LAYERS, EDGE_SOLID, EDGE_AIR } from './constants.js';
import { buildChunkGeometry } from './mesher.js';
import { makeSampler, sampleDensity } from './density.js';
import { terrainColor } from './terrain.js';
import { makeChunkMaterial } from './materials.js';

export class ChunkManager {
  constructor(scene) {
    this.scene = scene;
    this.material = makeChunkMaterial();
    this.chunks = new Map();
    this.edits = new Map();
    this.dirty = new Set();
    this.queue = [];
    this.lastKey = '';
  }

  key(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }

  has(cx, cy, cz) { return this.chunks.has(this.key(cx, cy, cz)); }

  // ---- sampling with edits ----
  sample(x, y, z) {
    if (this.edits.size) {
      const k = Math.round(x) + ',' + Math.round(y) + ',' + Math.round(z);
      const e = this.edits.get(k);
      if (e !== undefined) return e;
    }
    return sampleDensity(x, y, z);
  }

  // ---- build one chunk ----
  build(cx, cy, cz) {
    const k = this.key(cx, cy, cz);
    const ox = cx * CHUNK_SIZE, oy = cy * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
    const sampler = makeSampler(ox, oy, oz, this.edits);
    const geo = buildChunkGeometry(ox, oy, oz, sampler, terrainColor);

    const existing = this.chunks.get(k);
    if (!geo) {
      if (existing) {
        this.scene.remove(existing);
        existing.geometry.dispose();
        this.chunks.delete(k);
      }
      return;
    }
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = geo;
    } else {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.chunks.set(k, mesh);
    }
  }

  // ---- streaming ----
  update(px, py, pz, budget) {
    const pcx = Math.floor(px / CHUNK_SIZE);
    const pcz = Math.floor(pz / CHUNK_SIZE);
    const pcy = Math.floor(py / CHUNK_SIZE);
    const stamp = pcx + ',' + pcy + ',' + pcz;

    if (stamp !== this.lastKey) {
      this.lastKey = stamp;
      this.rebuildQueue(pcx, pcy, pcz);
    }

    const desired = this.desiredSet;
    if (!desired) return;

    // Unload distant chunks
    for (const [k, mesh] of this.chunks) {
      if (!desired.has(k)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.chunks.delete(k);
      }
    }

    // Build nearest missing
    let built = 0;
    while (this.queue.length && built < budget) {
      const c = this.queue.shift();
      if (!this.chunks.has(c.k)) {
        this.build(c.cx, c.cy, c.cz);
        built++;
      }
    }
  }

  rebuildQueue(pcx, pcy, pcz) {
    const desired = new Set();
    const list = [];
    for (let dx = -STREAM_RADIUS; dx <= STREAM_RADIUS; dx++) {
      for (let dz = -STREAM_RADIUS; dz <= STREAM_RADIUS; dz++) {
        for (let cy = 0; cy < VERT_LAYERS; cy++) {
          const cx = pcx + dx, cz = pcz + dz;
          const k = this.key(cx, cy, cz);
          desired.add(k);
          if (!this.chunks.has(k)) {
            const dy = cy - pcy;
            list.push({ k, cx, cy, cz, d: dx * dx + dz * dz + dy * dy * 4 });
          }
        }
      }
    }
    list.sort((a, b) => a.d - b.d);
    this.queue = list;
    this.desiredSet = desired;
  }

  // ---- edits ----
  markDirty(x, y, z, r) {
    const lo = (v) => Math.floor((v - r - 1) / CHUNK_SIZE);
    const hi = (v) => Math.floor((v + r + 1) / CHUNK_SIZE);
    for (let cx = lo(x); cx <= hi(x); cx++) {
      for (let cy = lo(y); cy <= hi(y); cy++) {
        for (let cz = lo(z); cz <= hi(z); cz++) {
          const k = this.key(cx, cy, cz);
          if (this.chunks.has(k)) this.dirty.add(k);
        }
      }
    }
  }

  paint(cx, cy, cz, r, value) {
    const r2 = r * r;
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    const z0 = Math.floor(cz - r), z1 = Math.ceil(cz + r);

    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dxx = dx * dx;
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy, dyy = dxx + dy * dy;
        if (dyy > r2) continue;
        for (let z = z0; z <= z1; z++) {
          const dz = z - cz;
          if (dyy + dz * dz > r2) continue;
          this.edits.set(x + ',' + y + ',' + z, value);
        }
      }
    }
    this.markDirty(cx, cy, cz, r);
  }

  dig(cx, cy, cz, r) { this.paint(cx, cy, cz, r, EDGE_AIR); }

  place(cx, cy, cz, r) { this.paint(cx, cy, cz, r, EDGE_SOLID); }

  flushDirty(budget) {
    if (!this.dirty.size) return;
    let n = 0;
    for (const k of this.dirty) {
      const p = k.split(',');
      this.build(+p[0], +p[1], +p[2]);
      this.dirty.delete(k);
      if (++n >= budget) break;
    }
  }

  // Chunk fully surrounding a point?
  readyAt(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return this.chunks.has(this.key(cx, cy, cz));
  }
}
