// Surface Nets isosurface mesher

import * as THREE from 'three';
import { CHUNK_SIZE } from './constants.js';

const N = CHUNK_SIZE;
const S = N + 1;
const SS = S * S;

// Corner offsets: bit0=x, bit1=y, bit2=z
const CX = new Int8Array(8);
const CY = new Int8Array(8);
const CZ = new Int8Array(8);
for (let c = 0; c < 8; c++) {
  CX[c] = c & 1;
  CY[c] = (c >> 1) & 1;
  CZ[c] = (c >> 2) & 1;
}

// Twelve cube edges
const EDGE_A = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3];
const EDGE_B = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];

export function buildChunkGeometry(ox, oy, oz, sampler, colorFn) {
  const dens = new Float32Array(S * S * S);
  for (let k = 0; k < S; k++) {
    for (let j = 0; j < S; j++) {
      const base = j * S + k * SS;
      for (let i = 0; i < S; i++) {
        dens[base + i] = sampler(i, j, k);
      }
    }
  }

  const cellIdx = new Int32Array(N * N * N).fill(-1);
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];

  const d0 = new Float32Array(8);

  // ---- pass 1: cell vertices ----
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const b000 = i + j * S + k * SS;
        d0[0] = dens[b000];
        d0[1] = dens[b000 + 1];
        d0[2] = dens[b000 + S];
        d0[3] = dens[b000 + S + 1];
        d0[4] = dens[b000 + SS];
        d0[5] = dens[b000 + SS + 1];
        d0[6] = dens[b000 + SS + S];
        d0[7] = dens[b000 + SS + S + 1];

        let neg = 0;
        for (let c = 0; c < 8; c++) if (d0[c] < 0) neg++;
        if (neg === 0 || neg === 8) continue;

        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (let e = 0; e < 12; e++) {
          const a = EDGE_A[e], b = EDGE_B[e];
          const va = d0[a], vb = d0[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          sx += CX[a] + (CX[b] - CX[a]) * t;
          sy += CY[a] + (CY[b] - CY[a]) * t;
          sz += CZ[a] + (CZ[b] - CZ[a]) * t;
          cnt++;
        }
        if (cnt === 0) continue;

        const vx = i + sx / cnt;
        const vy = j + sy / cnt;
        const vz = k + sz / cnt;

        // Gradient normal (points into solid)
        let gx = (d0[1] + d0[3] + d0[5] + d0[7]) - (d0[0] + d0[2] + d0[4] + d0[6]);
        let gy = (d0[2] + d0[3] + d0[6] + d0[7]) - (d0[0] + d0[1] + d0[4] + d0[5]);
        let gz = (d0[4] + d0[5] + d0[6] + d0[7]) - (d0[0] + d0[1] + d0[2] + d0[3]);
        const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        const nx = -gx / gl, ny = -gy / gl, nz = -gz / gl;
        const slope = 1 - Math.abs(ny);

        const col = colorFn(ox + vx, oy + vy, oz + vz, slope);

        cellIdx[i + j * N + k * N * N] = positions.length / 3;
        positions.push(ox + vx, oy + vy, oz + vz);
        normals.push(nx, ny, nz);
        colors.push(col[0], col[1], col[2]);
      }
    }
  }

  if (positions.length === 0) return null;

  // ---- pass 2: quads along X edges ----
  for (let k = 1; k < N; k++) {
    for (let j = 1; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const p = dens[i + j * S + k * SS];
        const q = dens[i + 1 + j * S + k * SS];
        if ((p < 0) === (q < 0)) continue;

        const a = cellIdx[i + (j - 1) * N + (k - 1) * N * N];
        const b = cellIdx[i + j * N + (k - 1) * N * N];
        const c = cellIdx[i + j * N + k * N * N];
        const d = cellIdx[i + (j - 1) * N + k * N * N];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;

        if (p > 0) indices.push(a, b, c, a, c, d);
        else indices.push(d, c, b, d, b, a);
      }
    }
  }

  // ---- pass 3: quads along Y edges ----
  for (let j = 0; j < N; j++) {
    for (let k = 1; k < N; k++) {
      for (let i = 1; i < N; i++) {
        const p = dens[i + j * S + k * SS];
        const q = dens[i + (j + 1) * S + k * SS];
        if ((p < 0) === (q < 0)) continue;

        const a = cellIdx[(i - 1) + j * N + (k - 1) * N * N];
        const b = cellIdx[i + j * N + (k - 1) * N * N];
        const c = cellIdx[i + j * N + k * N * N];
        const d = cellIdx[(i - 1) + j * N + k * N * N];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;

        if (p > 0) indices.push(d, c, b, d, b, a);
        else indices.push(a, b, c, a, c, d);
      }
    }
  }

  // ---- pass 4: quads along Z edges ----
  for (let k = 0; k < N; k++) {
    for (let j = 1; j < N; j++) {
      for (let i = 1; i < N; i++) {
        const p = dens[i + j * S + k * SS];
        const q = dens[i + j * S + (k + 1) * SS];
        if ((p < 0) === (q < 0)) continue;

        const a = cellIdx[(i - 1) + (j - 1) * N + k * N * N];
        const b = cellIdx[i + (j - 1) * N + k * N * N];
        const c = cellIdx[i + j * N + k * N * N];
        const d = cellIdx[(i - 1) + j * N + k * N * N];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;

        if (p > 0) indices.push(a, b, c, a, c, d);
        else indices.push(d, c, b, d, b, a);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}
