// Signed density field — breaks mesher/chunks cycle

import { CHUNK_SIZE } from './constants.js';
import { noise3 } from './noise.js';
import { terrainHeight } from './terrain.js';
import { structureDensity, STRUCT_EMPTY } from './landmarks.js';

export function sampleDensity(x, y, z) {
  const h = terrainHeight(x, z);
  let d = h - y;
  d += noise3(x * 0.07, y * 0.07, z * 0.07) * 1.2;

  const s = structureDensity(x, y, z);
  if (s > STRUCT_EMPTY) d = Math.max(d, s);
  return d;
}

export function sampleGradient(x, y, z, out) {
  const e = 0.35;
  out.x = sampleDensity(x + e, y, z) - sampleDensity(x - e, y, z);
  out.y = sampleDensity(x, y + e, z) - sampleDensity(x, y - e, z);
  out.z = sampleDensity(x, y, z + e) - sampleDensity(x, y, z - e);
  return out;
}

// Per-chunk sampler with column height caching
export function makeSampler(ox, oy, oz, edits) {
  const S = CHUNK_SIZE + 1;
  const SS = S * S;

  // Cache surface height per column
  const heights = new Float32Array(SS);
  for (let k = 0; k < S; k++) {
    for (let i = 0; i < S; i++) {
      heights[i + k * S] = terrainHeight(ox + i, oz + k);
    }
  }

  // Local edit overlay (numeric keys)
  let local = null;
  if (edits && edits.size) {
    for (const [key, val] of edits) {
      const p = key.split(',');
      const i = (+p[0]) - ox;
      const j = (+p[1]) - oy;
      const k = (+p[2]) - oz;
      if (i < 0 || i >= S || j < 0 || j >= S || k < 0 || k >= S) continue;
      if (!local) local = new Map();
      local.set(i + j * S + k * SS, val);
    }
  }

  return function sample(i, j, k) {
    if (local) {
      const v = local.get(i + j * S + k * SS);
      if (v !== undefined) return v;
    }
    const wx = ox + i, wy = oy + j, wz = oz + k;
    let d = heights[i + k * S] - wy;
    d += noise3(wx * 0.07, wy * 0.07, wz * 0.07) * 1.2;
    const s = structureDensity(wx, wy, wz);
    if (s > STRUCT_EMPTY) d = Math.max(d, s);
    return d;
  };
}
