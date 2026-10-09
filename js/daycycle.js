// Sun, sky gradient, fog and light over 13 in-game hours

import * as THREE from 'three';
import { DAY_START_HOUR, DAY_END_HOUR, DAY_REAL_SECONDS } from './constants.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = `
uniform vec3 topColor;
uniform vec3 botColor;
uniform vec3 glowColor;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(botColor, topColor, pow(h, 0.75));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += glowColor * pow(s, 4.0) * 0.22;
  col += glowColor * pow(s, 42.0) * 0.85;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class DayCycle {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;                 // 0..1 across the day
    this.hour = DAY_START_HOUR;

    // Sun
    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.0);
    this.sun.position.set(60, 80, 40);
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Sky bounce
    this.hemi = new THREE.HemisphereLight(0x9fb0b8, 0x33301f, 0.55);
    scene.add(this.hemi);

    // Ambient filler
    this.amb = new THREE.AmbientLight(0x5a6470, 0.35);
    scene.add(this.amb);

    // Sky dome
    this.uniforms = {
      topColor: { value: new THREE.Color(0x5c7d94) },
      botColor: { value: new THREE.Color(0xb8bdb2) },
      glowColor: { value: new THREE.Color(0xffc98a) },
      sunDir: { value: new THREE.Vector3(0.5, 0.4, 0.6) }
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), skyMat);
    scene.add(this.sky);

    // Keyframe colours
    this.dawn = {
      fog: new THREE.Color(0x8e989c),
      top: new THREE.Color(0x4d6a84),
      bot: new THREE.Color(0xacb2ac),
      glow: new THREE.Color(0xffc07a),
      sun: new THREE.Color(0xffd2a0)
    };
    this.noon = {
      fog: new THREE.Color(0xa9b6ba),
      top: new THREE.Color(0x5f89ab),
      bot: new THREE.Color(0xc7cec6),
      glow: new THREE.Color(0xfff0d0),
      sun: new THREE.Color(0xfff2dc)
    };
    this.dusk = {
      fog: new THREE.Color(0x8d7a6b),
      top: new THREE.Color(0x39536e),
      bot: new THREE.Color(0xc09068),
      glow: new THREE.Color(0xff9d55),
      sun: new THREE.Color(0xffb070)
    };

    this._fog = new THREE.Color();
    this._top = new THREE.Color();
    this._bot = new THREE.Color();
    this._glow = new THREE.Color();
    this._sun = new THREE.Color();

    this.update(0);
  }

  get clockString() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  update(dt) {
    this.t = Math.min(1, this.t + dt / DAY_REAL_SECONDS);
    this.hour = DAY_START_HOUR + this.t * (DAY_END_HOUR - DAY_START_HOUR);

    const el = THREE.MathUtils.degToRad(11 - this.t * 17);
    const az = THREE.MathUtils.degToRad(100 + this.t * 155);

    const sx = Math.cos(el) * Math.sin(az);
    const sy = Math.sin(el);
    const sz = Math.cos(el) * Math.cos(az);
    this.uniforms.sunDir.value.set(sx, sy, sz);

    this.sun.position.set(sx * 120, sy * 120 + 6, sz * 120);
    this.sun.target.position.set(0, 0, 0);

    // Blend dawn -> noon -> dusk
    let a, b, k;
    if (this.t < 0.5) { a = this.dawn; b = this.noon; k = this.t / 0.5; }
    else { a = this.noon; b = this.dusk; k = (this.t - 0.5) / 0.5; }
    k = k * k * (3 - 2 * k);

    this._fog.copy(a.fog).lerp(b.fog, k);
    this._top.copy(a.top).lerp(b.top, k);
    this._bot.copy(a.bot).lerp(b.bot, k);
    this._glow.copy(a.glow).lerp(b.glow, k);
    this._sun.copy(a.sun).lerp(b.sun, k);

    this.uniforms.topColor.value.copy(this._top);
    this.uniforms.botColor.value.copy(this._bot);
    this.uniforms.glowColor.value.copy(this._glow);

    // Fog: dense morning, open noon, warm dusk
    const fog = this.scene.fog;
    if (fog) {
      fog.color.copy(this._fog);
      const mid = 1 - Math.abs(this.t - 0.5) * 2;
      fog.near = 9 + mid * 16 + (this.t > 0.8 ? -5 : 0);
      fog.far = 46 + mid * 62;
      if (this.t > 0.82) fog.far -= (this.t - 0.82) * 90;
    }

    // Light response
    const sunUp = Math.max(0, Math.min(1, sy * 4 + 0.15));
    this.sun.intensity = 0.25 + sunUp * 0.95;
    this.sun.color.copy(this._sun);
    this.hemi.intensity = 0.28 + sunUp * 0.42;
    this.amb.intensity = 0.24 + sunUp * 0.18;

    this.sky.position.set(0, 0, 0);
  }
}
