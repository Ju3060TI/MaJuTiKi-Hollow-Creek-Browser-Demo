// First-person controller: walk, look, dig, place

import * as THREE from 'three';
import {
  GRAVITY, WALK_SPEED, JUMP_SPEED, EYE_HEIGHT,
  PLAYER_HEIGHT, DIG_RADIUS, REACH
} from './constants.js';
import { COLLIDERS } from './landmarks.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;

    this.pos = new THREE.Vector3(0, 40, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;

    this.onGround = false;
    this.frozen = true;
    this.speedScale = 1;
    this.bino = false;

    this.bobT = 0;
    this.stepAccum = 0;
    this.landTimer = 0;

    this.keys = Object.create(null);
    this._tmp = new THREE.Vector3();
    this._grad = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); });
  }

  setLookFromEvent(dx, dy) {
    const s = 0.0022;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  // ---- collision ----
  _pushOut(px, py, pz) {
    const d = this.world.sample(px, py, pz);
    if (d <= 0) return null;
    const e = 0.35;
    const gx = this.world.sample(px + e, py, pz) - this.world.sample(px - e, py, pz);
    const gy = this.world.sample(px, py + e, pz) - this.world.sample(px, py - e, pz);
    const gz = this.world.sample(px, py, pz + e) - this.world.sample(px, py, pz - e);
    const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (gl < 1e-5) return null;
    let amt = d / gl;
    if (amt > 0.6) amt = 0.6;
    return { x: -gx / gl * amt, y: -gy / gl * amt, z: -gz / gl * amt };
  }

  _resolveCollisions() {
    const heights = [0.4, 1.05, 1.68];
    for (let iter = 0; iter < 2; iter++) {
      let moved = false;
      for (const h of heights) {
        const p = this._pushOut(this.pos.x, this.pos.y + h, this.pos.z);
        if (p) {
          this.pos.x += p.x;
          this.pos.y += p.y;
          this.pos.z += p.z;
          moved = true;
        }
      }
      if (!moved) break;
    }
    this._resolveAABB();
  }

  _resolveAABB() {
    const r = 0.34;
    const y0 = this.pos.y + 0.1;
    const y1 = this.pos.y + PLAYER_HEIGHT - 0.1;
    for (const b of COLLIDERS) {
      if (y1 < b.y0 || y0 > b.y1) continue;
      const x = this.pos.x, z = this.pos.z;
      if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;

      const dxl = x - (b.x0 - r);
      const dxr = (b.x1 + r) - x;
      const dzl = z - (b.z0 - r);
      const dzr = (b.z1 + r) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) this.pos.x -= dxl;
      else if (m === dxr) this.pos.x += dxr;
      else if (m === dzl) this.pos.z -= dzl;
      else this.pos.z += dzr;
    }
  }

  // ---- raycast ----
  raycast(maxDist = REACH) {
    const o = this.camera.position;
    const dir = this._tmp.set(0, 0, -1).applyQuaternion(this.camera.quaternion).clone();
    let prev = null;
    for (let t = 0; t <= maxDist; t += 0.07) {
      const x = o.x + dir.x * t;
      const y = o.y + dir.y * t;
      const z = o.z + dir.z * t;
      if (this.world.sample(x, y, z) > 0) {
        return {
          inside: new THREE.Vector3(x, y, z),
          outside: prev ? prev.clone() : new THREE.Vector3(x, y, z),
          dir
        };
      }
      if (!prev) prev = new THREE.Vector3();
      prev.set(x, y, z);
    }
    return null;
  }

  aimingAtSolid() {
    const hit = this.raycast(REACH);
    return hit ? hit.inside : null;
  }

  dig() {
    const hit = this.raycast(REACH);
    if (!hit) return false;
    this.world.dig(hit.inside.x, hit.inside.y, hit.inside.z, DIG_RADIUS);
    return true;
  }

  place() {
    const hit = this.raycast(REACH);
    if (!hit) return false;
    const p = hit.outside;
    // Do not place inside the player
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dy = p.y - (this.pos.y + 0.9);
    if (dx * dx + dz * dz + dy * dy < 1.6) return false;
    this.world.place(p.x, p.y, p.z, DIG_RADIUS * 0.65);
    return true;
  }

  // ---- update ----
  update(dt) {
    if (this.frozen) {
      this._applyCamera(0);
      return;
    }

    const k = this.keys;
    let ix = 0, iz = 0;
    if (k['KeyW'] || k['ArrowUp']) iz += 1;
    if (k['KeyS'] || k['ArrowDown']) iz -= 1;
    if (k['KeyD'] || k['ArrowRight']) ix += 1;
    if (k['KeyA'] || k['ArrowLeft']) ix -= 1;

    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }

    const speed = WALK_SPEED * this.speedScale;

    this._fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const wishX = this._fwd.x * iz + this._right.x * ix;
    const wishZ = this._fwd.z * iz + this._right.z * ix;

    // Horizontal acceleration
    const accel = this.onGround ? 14 : 4;
    const tx = wishX * speed;
    const tz = wishZ * speed;
    this.vel.x += (tx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (tz - this.vel.z) * Math.min(1, accel * dt);

    // Gravity
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -60) this.vel.y = -60;

    // Jump
    if ((k['Space']) && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }

    // Integrate
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    this._resolveCollisions();

    // Ground check
    const gd = this.world.sample(this.pos.x, this.pos.y + 0.08, this.pos.z);
    const wasAir = !this.onGround;
    this.onGround = gd > -0.22;
    if (this.onGround && this.vel.y < 0) {
      if (wasAir && this.vel.y < -6) {
        this.audio.footstep(1.4);
      }
      this.vel.y = 0;
    }

    if (this.pos.y < -20) {
      this.pos.y = 60;
      this.vel.set(0, 0, 0);
    }

    // Head bob + footsteps
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hspeed > 0.4) {
      this.bobT += dt * hspeed * 1.85;
      this.stepAccum += hspeed * dt;
      if (this.stepAccum > 2.35) {
        this.stepAccum = 0;
        this.audio.footstep(1.0);
      }
    } else {
      this.bobT += dt * 0.6;
      this.stepAccum = 2.0;
    }

    this._applyCamera(hspeed);
  }

  _applyCamera(hspeed) {
    const bobAmp = this.onGround ? Math.min(0.055, hspeed * 0.014) : 0;
    const bobY = Math.sin(this.bobT * 2.0) * bobAmp;
    const bobX = Math.cos(this.bobT) * bobAmp * 0.6;

    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.camera.position.set(
      this.pos.x + rightX * bobX,
      this.pos.y + EYE_HEIGHT + bobY,
      this.pos.z + rightZ * bobX
    );
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
