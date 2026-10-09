// Terrain heightfield + vertex colouring

import { fbm2, noise2 } from './noise.js';
import { WATER_LEVEL, CABIN, TOWER } from './constants.js';

// Winding river centre line
export function riverCenterX(z) {
  return Math.sin(z * 0.021) * 24 + Math.sin(z * 0.0071 + 1.7) * 10 + 2;
}

// 0 = dry, 1 = river bed
export function riverFactor(x, z) {
  const d = Math.abs(x - riverCenterX(z));
  const w = 13.0;
  const t = Math.max(0, 1 - d / w);
  return t * t * (3 - 2 * t);
}

export function terrainHeight(x, z) {
  let h = 15.5;
  h += fbm2(x * 0.0075, z * 0.0075, 4) * 11.0;
  h += fbm2(x * 0.032, z * 0.032, 3) * 2.4;
  h += noise2(x * 0.11, z * 0.11) * 0.5;

  // Ridge under the watchtower
  const rx = x - TOWER.x;
  const rz = z - TOWER.z;
  const ca = Math.cos(-0.6), sa = Math.sin(-0.6);
  const ax = ca * rx - sa * rz;
  const az = sa * rx + ca * rz;
  h += Math.exp(-(ax * ax / (2 * 30 * 30) + az * az / (2 * 88 * 88))) * 16.0;

  // Secondary shoulder
  const sx = x - 30, sz = z + 40;
  h += Math.exp(-(sx * sx + sz * sz) / (2 * 62 * 62)) * 6.5;

  // Cabin clearing flattens
  const cx = x - CABIN.x, cz = z - CABIN.z;
  const flat = Math.exp(-(cx * cx + cz * cz) / (2 * 13 * 13));
  h = h * (1 - flat) + 14.2 * flat;

  // River carve
  const t = riverFactor(x, z);
  if (t > 0.001) {
    const bed = WATER_LEVEL - 2.7 - t * 1.6;
    h = h * (1 - t) + bed * t;
  }

  return h;
}

// sRGB -> linear
function lin(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function terrainColor(x, y, z, slope) {
  const n = noise2(x * 0.19, z * 0.19) * 0.5 + noise2(x * 0.73, z * 0.73) * 0.28;

  let r, g, b;

  if (y < WATER_LEVEL + 0.9) {
    r = 0.30; g = 0.245; b = 0.175;          // river mud
  } else if (y < WATER_LEVEL + 2.3) {
    r = 0.41; g = 0.375; b = 0.285;          // gravel bank
  } else if (y > 27.5) {
    r = 0.435; g = 0.425; b = 0.405;         // exposed rock
  } else if (y > 22.5) {
    r = 0.335; g = 0.335; b = 0.275;         // high forest floor
  } else {
    r = 0.255; g = 0.305; b = 0.175;         // meadow grass
  }

  // Steep faces turn to rock
  if (slope > 0.52) {
    const t = Math.min(1, (slope - 0.52) / 0.36);
    r = r * (1 - t) + 0.40 * t;
    g = g * (1 - t) + 0.395 * t;
    b = b * (1 - t) + 0.375 * t;
  }

  // Autumn tinting near the canopy line
  if (y > 12 && y < 26 && slope < 0.5) {
    const a = (noise2(x * 0.05 + 40, z * 0.05 - 12) + 1) * 0.5;
    const leaf = Math.max(0, Math.min(1, (a - 0.35) * 2.0)) * 0.45;
    r = r * (1 - leaf) + 0.36 * leaf;
    g = g * (1 - leaf) + 0.245 * leaf;
    b = b * (1 - leaf) + 0.135 * leaf;
  }

  const v = 1 + n * 0.13;
  return [lin(r * v), lin(g * v), lin(b * v)];
}
