// Shared materials

import * as THREE from 'three';

export function makeChunkMaterial() {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.FrontSide
  });
}

export function makeWaterMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0x38484a,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

export function makePickupMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xd8b26a });
}

export function makeStoneMaterial() {
  return new THREE.MeshLambertMaterial({ color: 0x6b6459 });
}
