// Hollow Creek — bootstrap and game loop

import * as THREE from 'three';
import {
  WATER_LEVEL, PICKUP_RANGE, SPAWN
} from './constants.js';
import { terrainHeight } from './terrain.js';
import { ChunkManager } from './chunks.js';
import { makeWaterMaterial, makePickupMaterial } from './materials.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { DayCycle } from './daycycle.js';
import { getPickupDefs } from './landmarks.js';
import { getItem } from './items.js';

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ---------- scene ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8e989c, 10, 60);

const camera = new THREE.PerspectiveCamera(
  74, window.innerWidth / window.innerHeight, 0.08, 700
);
camera.rotation.order = 'YXZ';

// ---------- systems ----------
const day = new DayCycle(scene);
const chunks = new ChunkManager(scene);
const audio = new AudioEngine();
const inventory = new Inventory(5, 4);
const ui = new UI(inventory);
const player = new Player(camera, chunks, audio);

// ---------- starting items ----------
inventory.add('stone_axe');
inventory.add('stone_pickaxe');
inventory.add('faded_photograph');

// ---------- water ----------
const waterGeo = new THREE.PlaneGeometry(700, 700, 1, 1);
const water = new THREE.Mesh(waterGeo, makeWaterMaterial());
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_LEVEL;
water.matrixAutoUpdate = false;
water.updateMatrix();
scene.add(water);

// ---------- cabin light ----------
const cabinLight = new THREE.PointLight(0xffb35c, 1.6, 22, 1.8);
cabinLight.position.set(-26, 16.5, -8.5);
scene.add(cabinLight);

const fireLight = new THREE.PointLight(0xff8a3a, 1.2, 14, 2.0);
fireLight.position.set(-19.5, terrainHeight(-19.5, -8.5) + 1.0, -8.5);
scene.add(fireLight);

// ---------- pickups ----------
const pickupGeo = new THREE.OctahedronGeometry(0.22, 0);
const pickupMat = makePickupMaterial();
const pickups = [];

for (const def of getPickupDefs()) {
  const mesh = new THREE.Mesh(pickupGeo, pickupMat);
  mesh.position.set(def.x, def.y, def.z);
  scene.add(mesh);
  pickups.push({ id: def.id, mesh, taken: false, baseY: def.y });
}

// ---------- spawn ----------
const spawnY = terrainHeight(SPAWN.x, SPAWN.z) + 4;
player.pos.set(SPAWN.x, spawnY, SPAWN.z);
player.yaw = SPAWN.yaw;
player.pitch = -0.06;
player._applyCamera(0);

// Pre-build the chunks around the player
for (let dx = -1; dx <= 1; dx++) {
  for (let dz = -1; dz <= 1; dz++) {
    chunks.build(Math.floor(SPAWN.x / 32) + dx, 0, Math.floor(SPAWN.z / 32) + dz);
  }
}

// ---------- input ----------
let pointerLocked = false;

document.getElementById('splash').addEventListener('click', () => {
  audio.init();
  audio.resume();
  ui.fadeSplash();
  canvas.requestPointerLock();
});

canvas.addEventListener('click', () => {
  if (!pointerLocked && !ui.open) canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  player.frozen = !pointerLocked;
  if (!pointerLocked) ui.closeBackpack();
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.setLookFromEvent(e.movementX, e.movementY);
});

document.addEventListener('mousedown', (e) => {
  if (!pointerLocked) return;
  if (e.button === 0) player.dig();
  else if (e.button === 2) player.place();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    ui.toggleBackpack();
    return;
  }
  if (e.code === 'Escape') {
    ui.closeBackpack();
    return;
  }
  if (e.code === 'KeyE' && pointerLocked && !ui.open) {
    tryPickup();
  }
  if (e.code === 'KeyF' && pointerLocked) {
    if (inventory.has('binoculars')) player.bino = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyF') player.bino = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- pickup logic ----------
let nearPickup = null;

function tryPickup() {
  if (!nearPickup || nearPickup.taken) return;
  const def = getItem(nearPickup.id);
  if (!def) return;
  if (!inventory.add(nearPickup.id)) {
    ui.toast('Too Heavy', 'You cannot carry any more.');
    return;
  }
  nearPickup.taken = true;
  scene.remove(nearPickup.mesh);
  ui.toast(def.name, def.note);
  nearPickup = null;
}

function updatePickups(dt, time) {
  let best = null;
  let bestD = PICKUP_RANGE * PICKUP_RANGE;

  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 1.1;
    p.mesh.position.y = p.baseY + Math.sin(time * 1.6 + p.baseY) * 0.07;

    const dx = p.mesh.position.x - player.pos.x;
    const dy = p.mesh.position.y - (player.pos.y + 1.0);
    const dz = p.mesh.position.z - player.pos.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = p; }
  }

  nearPickup = best;
  if (best && !ui.open) {
    const def = getItem(best.id);
    ui.setPrompt('[E] Take ' + def.name);
  } else {
    ui.setPrompt('');
  }
}

// ---------- binoculars ----------
let currentFov = 74;
function updateBinoculars(dt) {
  const target = player.bino ? 26 : 74;
  currentFov += (target - currentFov) * Math.min(1, dt * 9);
  if (Math.abs(camera.fov - currentFov) > 0.05) {
    camera.fov = currentFov;
    camera.updateProjectionMatrix();
  }
  ui.setBinoculars(currentFov < 55);
}

// ---------- loop ----------
let last = performance.now();
let elapsed = 0;
let aimCheck = 0;
let crossActive = false;

function loop() {
  requestAnimationFrame(loop);

  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  elapsed += dt;

  const locked = pointerLocked && !ui.open;

  // Weight slows the player
  player.speedScale = inventory.loadFactor();
  player.frozen = !locked;
  player.update(dt);

  day.update(dt);
  updateBinoculars(dt);

  chunks.update(player.pos.x, player.pos.y, player.pos.z, locked ? 2 : 1);
  chunks.flushDirty(4);

  updatePickups(dt, elapsed);

  // Crosshair state (throttled)
  aimCheck -= dt;
  if (aimCheck <= 0) {
    aimCheck = 0.08;
    const solid = locked && player.aimingAtSolid();
    if (solid !== crossActive) {
      crossActive = solid;
      ui.setCrosshairActive(!!solid);
    }
  }

  // Audio distance + ambience
  audio.setRiver(player.pos.x, player.pos.z);
  audio.update(dt);

  // HUD
  ui.setClock(day.clockString);
  ui.setWeight(inventory.weight());
  ui.update(dt);

  // Fire flicker
  fireLight.intensity = 1.1 + Math.sin(elapsed * 7.3) * 0.18 + Math.sin(elapsed * 13.1) * 0.09;

  renderer.render(scene, camera);
}

loop();
