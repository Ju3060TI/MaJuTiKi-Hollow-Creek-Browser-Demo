// Cabin, watchtower and prop SDFs

import { CABIN, TOWER } from './constants.js';
import { terrainHeight } from './terrain.js';

export const STRUCT_EMPTY = -1000;

// ---- SDF helpers ----
function sdBox(px, py, pz, cx, cy, cz, hx, hy, hz) {
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  const qz = Math.abs(pz - cz) - hz;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.min(Math.max(qx, Math.max(qy, qz)), 0) +
    Math.sqrt(mx * mx + my * my + mz * mz);
}

function sdBoxRotX(px, py, pz, cx, cy, cz, hx, hy, hz, ang) {
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  const c = Math.cos(ang), s = Math.sin(ang);
  const ry = dy * c + dz * s;
  const rz = -dy * s + dz * c;
  const qx = Math.abs(dx) - hx;
  const qy = Math.abs(ry) - hy;
  const qz = Math.abs(rz) - hz;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.min(Math.max(qx, Math.max(qy, qz)), 0) +
    Math.sqrt(mx * mx + my * my + mz * mz);
}

function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const denom = bax * bax + bay * bay + baz * baz || 1e-6;
  let t = (pax * bax + pay * bay + paz * baz) / denom;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = pax - bax * t, dy = pay - bay * t, dz = paz - baz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// Solid box -> positive inside
const solidBox = (...a) => -sdBox(...a);
// Hollow shell -> positive inside wall
const shell = (t, ...a) => t - Math.abs(sdBox(...a));

// ---- Anchor heights ----
export const CABIN_Y = Math.round(terrainHeight(CABIN.x, CABIN.z));
export const TOWER_Y = Math.round(terrainHeight(TOWER.x, TOWER.z));

const CX = CABIN.x, CZ = CABIN.z, CY = CABIN_Y;
const TX = TOWER.x, TZ = TOWER.z, TY = TOWER_Y;

const ROOF_ANG = 0.515;

// Ramp base height
const RAMP_BX = TX + 22, RAMP_BZ = TZ + 18;
const RAMP_BY = Math.round(terrainHeight(RAMP_BX, RAMP_BZ)) + 1.0;

// ---- Cabin ----
function cabinDensity(x, y, z) {
  let d = STRUCT_EMPTY;

  // Floor slab
  d = Math.max(d, solidBox(x, y, z, CX, CY - 0.5, CZ, 4.6, 0.5, 4.1));

  // Walls
  let wall = shell(0.55, x, y, z, CX, CY + 1.75, CZ, 4.5, 1.75, 4.0);

  // Doorway (+Z)
  wall = Math.min(wall, sdBox(x, y, z, CX, CY + 1.15, CZ + 4.0, 0.9, 1.15, 1.5));
  // Window (-X)
  wall = Math.min(wall, sdBox(x, y, z, CX - 4.5, CY + 2.15, CZ - 1.0, 1.5, 0.72, 0.72));

  d = Math.max(d, wall);

  // Roof slabs
  d = Math.max(d, solidBox(
    x, y, z, CX, CY + 4.75, CZ + 2.35, 5.3, 0.32, 2.0
  ));
  d = Math.max(d, -sdBoxRotX(x, y, z, CX, CY + 4.75, CZ + 2.35, 5.3, 0.32, 2.0, ROOF_ANG));
  d = Math.max(d, -sdBoxRotX(x, y, z, CX, CY + 4.75, CZ - 2.35, 5.3, 0.32, 2.0, -ROOF_ANG));

  // Campfire ring
  const fx = CX + 6.5, fz = CZ + 3.5;
  const fy = terrainHeight(fx, fz);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const sx = fx + Math.cos(a) * 1.15;
    const sz = fz + Math.sin(a) * 1.15;
    d = Math.max(d, 0.5 - Math.hypot(x - sx, y - (fy + 0.2), z - sz));
  }
  // Fire logs
  d = Math.max(d, 0.28 - sdCapsule(x, y, z, fx - 0.9, fy + 0.25, fz - 0.5, fx + 0.9, fy + 0.5, fz + 0.5, 0.22));
  d = Math.max(d, 0.28 - sdCapsule(x, y, z, fx + 0.9, fy + 0.25, fz - 0.5, fx - 0.9, fy + 0.5, fz + 0.5, 0.22));

  // Path stones toward the creek
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const px = CX + 5 + t * 14 + Math.sin(i * 2.1) * 0.9;
    const pz = CZ + 6 + t * 8 + Math.cos(i * 1.7) * 0.9;
    const py = terrainHeight(px, pz);
    d = Math.max(d, 0.42 - sdCapsule(x, y, z, px, py + 0.1, pz, px + 1.0, py + 0.15, pz + 0.6, 0.3));
  }

  return d;
}

// ---- Watchtower ----
function towerDensity(x, y, z) {
  let d = STRUCT_EMPTY;

  // Four legs
  const legs = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
  for (const [lx, lz] of legs) {
    const px = TX + lx, pz = TZ + lz;
    d = Math.max(d, 0.45 - sdCapsule(x, y, z, px, TY - 1, pz, px, TY + 14.3, pz, 0.45));
  }

  // Cross braces
  d = Math.max(d, 0.18 - sdCapsule(x, y, z, TX - 3, TY + 5, TZ - 3, TX + 3, TY + 11, TZ + 3, 0.18));
  d = Math.max(d, 0.18 - sdCapsule(x, y, z, TX + 3, TY + 5, TZ - 3, TX - 3, TY + 11, TZ + 3, 0.18));

  // Platform
  d = Math.max(d, solidBox(x, y, z, TX, TY + 14.4, TZ, 4.6, 0.4, 4.6));

  // Railing fragments
  d = Math.max(d, solidBox(x, y, z, TX, TY + 15.3, TZ + 4.4, 4.6, 0.5, 0.2));
  d = Math.max(d, solidBox(x, y, z, TX - 4.4, TY + 15.3, TZ, 0.2, 0.5, 4.6));

  // Hut
  let hut = shell(0.35, x, y, z, TX, TY + 16.6, TZ - 1.4, 2.2, 1.7, 2.2);
  hut = Math.min(hut, sdBox(x, y, z, TX, TY + 15.9, TZ + 0.8, 0.8, 1.1, 1.2));
  d = Math.max(d, hut);
  d = Math.max(d, solidBox(x, y, z, TX, TY + 18.5, TZ - 1.4, 2.6, 0.3, 2.6));

  // Broken stairs
  for (let i = 0; i < 6; i++) {
    const sy = TY + 1.0 + i * 0.85;
    const sz = TZ + 5.4 - i * 0.9;
    d = Math.max(d, solidBox(x, y, z, TX, sy, sz, 1.4, 0.22, 0.55));
  }
  // Stair posts
  d = Math.max(d, 0.22 - sdCapsule(x, y, z, TX - 1.4, TY, TZ + 5.6, TX - 1.4, TY + 3.2, TZ + 2.2, 0.22));

  // Fallen tree ramp
  d = Math.max(d, 1.0 - sdCapsule(
    x, y, z,
    RAMP_BX, RAMP_BY, RAMP_BZ,
    TX + 1.6, TY + 14.6, TZ + 1.6, 1.0
  ));
  // Roots at ramp base
  d = Math.max(d, 0.9 - Math.hypot(x - RAMP_BX, y - (RAMP_BY + 0.4), z - RAMP_BZ));

  return d;
}

// ---- Combined ----
export function structureDensity(x, y, z) {
  let d = STRUCT_EMPTY;

  const cdx = x - CX, cdz = z - CZ, cdy = y - CY;
  if (cdx * cdx + cdz * cdz < 144 && cdy > -4 && cdy < 14) {
    d = Math.max(d, cabinDensity(x, y, z));
  }

  const tdx = x - TX, tdz = z - TZ, tdy = y - TY;
  if (tdx * tdx + tdz * tdz < 1200 && tdy > -6 && tdy < 26) {
    d = Math.max(d, towerDensity(x, y, z));
  }

  return d;
}

// ---- AABB colliders ----
export const COLLIDERS = [
  // Tower legs
  { x0: TX - 3.5, x1: TX - 2.5, y0: TY - 1, y1: TY + 14.6, z0: TZ - 3.5, z1: TZ - 2.5 },
  { x0: TX + 2.5, x1: TX + 3.5, y0: TY - 1, y1: TY + 14.6, z0: TZ - 3.5, z1: TZ - 2.5 },
  { x0: TX + 2.5, x1: TX + 3.5, y0: TY - 1, y1: TY + 14.6, z0: TZ + 2.5, z1: TZ + 3.5 },
  { x0: TX - 3.5, x1: TX - 2.5, y0: TY - 1, y1: TY + 14.6, z0: TZ + 2.5, z1: TZ + 3.5 },
  // Cabin solid side walls
  { x0: CX - 5.1, x1: CX - 4.0, y0: CY, y1: CY + 3.5, z0: CZ - 4.0, z1: CZ + 4.0 },
  { x0: CX + 4.0, x1: CX + 5.1, y0: CY, y1: CY + 3.5, z0: CZ - 4.0, z1: CZ + 4.0 },
  { x0: CX - 4.0, x1: CX + 4.0, y0: CY, y1: CY + 3.5, z0: CZ - 5.1, z1: CZ - 4.0 }
];

// ---- Pickups ----
export const PICKUP_DEFS = [
  {
    id: 'rusted_logbook',
    x: CX - 1.6, y: CY + 0.55, z: CZ + 1.2
  },
  {
    id: 'binoculars',
    x: TX + 2.6, y: TY + 15.3, z: TZ + 2.8
  },
  {
    id: 'hand_drawn_map',
    x: TX - 0.4, y: TY + 15.9, z: TZ - 1.6
  }
];

export function getPickupDefs() { return PICKUP_DEFS; }
