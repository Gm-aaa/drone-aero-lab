import * as THREE from 'three';
import { liftColor } from '../aero/aero.js';

const PER_ROTOR_PARTICLES = 26;
const ROTOR_Y = 0.09;      // 桨盘高度（与建造器 prop 高度一致）
const INTAKE_H = 0.45;     // 桨盘上方吸入高度
const DOWN_H = 0.9;        // 下洗柱向下延伸

function toColor(c) { return new THREE.Color(c.r, c.g, c.b); }

export function createViz(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 全局矢量：总升力（中心）、重力、风
  const totalLift = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, ROTOR_Y, 0), 1, 0x22c55e, 0.18, 0.11);
  const gravity = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, ROTOR_Y, 0), 1, 0xef4444, 0.15, 0.09);
  const wind = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.4, 0.5, 0), 1, 0x22d3ee, 0.15, 0.09);
  root.add(totalLift, gravity, wind);

  // 每旋翼动态部分
  let rotors = [];
  let rotorArrows = [];
  let flow = null;          // { points, geo, seed, rotorOf }
  let windVec = { x: 0, y: 0, z: 0 };
  let downStrength = 0.5;   // 0..1，随总升力

  function clearRotors() {
    for (const a of rotorArrows) {
      root.remove(a);
      a.line.material.dispose();
      a.cone.material.dispose();
    }
    rotorArrows = [];
    if (flow) { root.remove(flow.points); flow.geo.dispose(); flow.points.material.dispose(); flow = null; }
  }

  function setRotors(rs) {
    clearRotors();
    rotors = rs;
    // 每旋翼升力箭头
    for (const r of rotors) {
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(r.x, ROTOR_Y + 0.06, r.z), 0.4, 0x22c55e, 0.1, 0.06);
      rotorArrows.push(a); root.add(a);
    }
    // 下洗粒子束（每旋翼一列）
    const N = rotors.length * PER_ROTOR_PARTICLES;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);   // 相位 0..1
    const rotorOf = new Int16Array(N);
    let k = 0;
    for (let ri = 0; ri < rotors.length; ri++) {
      for (let j = 0; j < PER_ROTOR_PARTICLES; j++) {
        seed[k] = Math.random();
        rotorOf[k] = ri;
        writeParticle(pos, k, rotors[ri], seed[k]);
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.025, transparent: true, opacity: 0.85 }));
    root.add(points);
    flow = { points, geo, seed, rotorOf };
  }

  // 相位 phase(0..1)：0=桨盘上方吸入口，经桨盘，1=下洗柱底部
  function writeParticle(arr, i, rotor, phase) {
    const jitter = (i % 7 - 3) * 0.012;
    let x = rotor.x, y, z = rotor.z + jitter;
    if (phase < 0.35) {
      // 上方吸入：从外侧上方收拢到桨盘中心
      const t = phase / 0.35;
      y = ROTOR_Y + INTAKE_H * (1 - t);
      x = rotor.x + (1 - t) * jitter * 6;
    } else {
      // 桨盘下方：向下成柱 + 轻微外扩 + 风平流
      const t = (phase - 0.35) / 0.65;
      y = ROTOR_Y - DOWN_H * t + windVec.y * 0.02 * t;
      x = rotor.x + jitter * (1 + t * 1.5) + windVec.x * 0.05 * t;
      z = rotor.z + jitter * (1 + t * 1.5) + windVec.z * 0.05 * t;
    }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }

  function update(s) {
    const N = rotors.length || 1;
    const wShare = s.weight / N;
    for (let i = 0; i < rotorArrows.length; i++) {
      const lift = s.perLift[i] ?? 0;
      const len = Math.max(0.05, Math.min(1.2, lift / 120));
      rotorArrows[i].setLength(len, 0.1, 0.06);
      rotorArrows[i].setColor(toColor(liftColor(lift, wShare)));
    }
    totalLift.setLength(Math.max(0.1, Math.min(2.4, s.totalLift / 120)), 0.18, 0.11);
    totalLift.setColor(toColor(liftColor(s.effectiveLift, s.weight)));
    gravity.setLength(Math.max(0.1, Math.min(2.4, s.weight / 120)), 0.15, 0.09);
    const wlen = Math.hypot(s.wind.x, s.wind.y, s.wind.z);
    wind.visible = wlen > 0.01;
    if (wlen > 0.01) {
      wind.setDirection(new THREE.Vector3(s.wind.x, s.wind.y, s.wind.z).normalize());
      wind.setLength(Math.min(2, 0.3 + wlen / 15), 0.15, 0.09);
    }
    windVec = s.wind;
    downStrength = Math.max(0.25, Math.min(1.4, s.totalLift / (s.weight || 1)));
  }

  function tick(dt) {
    if (!flow) return;
    const arr = flow.geo.attributes.position.array;
    for (let i = 0; i < flow.seed.length; i++) {
      flow.seed[i] += dt * 0.35 * downStrength;
      if (flow.seed[i] > 1) flow.seed[i] -= 1;
      writeParticle(arr, i, rotors[flow.rotorOf[i]], flow.seed[i]);
    }
    flow.geo.attributes.position.needsUpdate = true;
  }

  return { setRotors, update, tick };
}
