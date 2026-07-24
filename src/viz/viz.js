import * as THREE from 'three';
import { liftColor } from '../aero/aero.js';

const PER_ROTOR_PARTICLES = 26;
const ROTOR_Y = 0.09;      // 桨盘高度（与建造器 prop 高度一致）
const INTAKE_H = 0.45;     // 桨盘上方吸入高度
const DOWN_H = 0.9;        // 下洗柱向下延伸

function toColor(c) { return new THREE.Color(c.r, c.g, c.b); }

export function advanceFlowPhase(phase, dt, strength) {
  return (phase + dt * 0.35 * strength) % 1;
}

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
  let flowDir = 1;          // 1=下洗（默认），-1=自转上行气流
  const attitude = new THREE.Quaternion();
  const transformedPosition = new THREE.Vector3();
  const transformedDirection = new THREE.Vector3();
  const totalDirectionLocal = new THREE.Vector3(0, 1, 0);
  let totalFollowsAttitude = true;

  function clearRotors() {
    for (const a of rotorArrows) {
      root.remove(a);
      a.line.geometry.dispose();
      a.line.material.dispose();
      a.cone.geometry.dispose();
      a.cone.material.dispose();
    }
    rotorArrows = [];
    if (flow) { root.remove(flow.points); flow.geo.dispose(); flow.points.material.dispose(); flow = null; }
  }

  function setRotors(rs) {
    clearRotors();
    attitude.identity();
    rotors = rs.map((r) => ({
      localPosition: new THREE.Vector3(r.x, r.y ?? ROTOR_Y, r.z),
      localDirection: new THREE.Vector3(0, 1, 0),
      x: r.x,
      y: r.y ?? ROTOR_Y,
      z: r.z,
      direction: { x: 0, y: 1, z: 0 },
    }));
    // 每旋翼升力箭头
    for (const r of rotors) {
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(r.x, r.y + 0.06, r.z), 0.4, 0x22c55e, 0.1, 0.06);
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
    applyAttitude();
  }

  function applyAttitude(nextAttitude = attitude) {
    attitude.copy(nextAttitude);
    for (let i = 0; i < rotors.length; i++) {
      const rotor = rotors[i];
      transformedPosition.copy(rotor.localPosition).applyQuaternion(attitude);
      transformedDirection.copy(rotor.localDirection).applyQuaternion(attitude).normalize();
      rotor.x = transformedPosition.x;
      rotor.y = transformedPosition.y;
      rotor.z = transformedPosition.z;
      rotor.direction = {
        x: transformedDirection.x,
        y: transformedDirection.y,
        z: transformedDirection.z,
      };
      rotorArrows[i].position.copy(transformedPosition)
        .addScaledVector(transformedDirection, 0.06);
      rotorArrows[i].setDirection(transformedDirection);
    }
    transformedPosition.set(0, ROTOR_Y, 0).applyQuaternion(attitude);
    totalLift.position.copy(transformedPosition);
    gravity.position.copy(transformedPosition);
    transformedDirection.copy(totalDirectionLocal);
    if (totalFollowsAttitude) transformedDirection.applyQuaternion(attitude);
    if (transformedDirection.lengthSq() > 1e-8) totalLift.setDirection(transformedDirection.normalize());
  }

  // 相位 phase(0..1)：0=桨盘上方吸入口，经桨盘，1=下洗柱底部
  function writeParticle(arr, i, rotor, phase) {
    const jitter = (i % 7 - 3) * 0.012;
    const d = rotor.direction;
    // 选一条与推力轴近似垂直的方向，让粒子束保持可见宽度。
    const side = Math.abs(d.y) > 0.9 ? { x: 0, y: 0, z: 1 } : { x: -d.y, y: d.x, z: 0 };
    let x = rotor.x + side.x * jitter;
    let y = rotor.y + side.y * jitter;
    let z = rotor.z + side.z * jitter;
    if (phase < 0.35) {
      // 推力轴正侧吸入；自转时整体流向反转。
      const t = phase / 0.35;
      const axial = flowDir * INTAKE_H * (1 - t);
      const spread = (1 - t) * jitter * 6;
      x = rotor.x + d.x * axial + side.x * spread;
      y = rotor.y + d.y * axial + side.y * spread;
      z = rotor.z + d.z * axial + side.z * spread;
    } else {
      // 沿推力反方向形成尾流，并受环境风平流。
      const t = (phase - 0.35) / 0.65;
      const axial = -flowDir * DOWN_H * t;
      const spread = jitter * (1 + t * 1.5);
      x = rotor.x + d.x * axial + side.x * spread + windVec.x * 0.05 * t;
      y = rotor.y + d.y * axial + side.y * spread + windVec.y * 0.02 * t;
      z = rotor.z + d.z * axial + side.z * spread + windVec.z * 0.05 * t;
    }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }

  function update(s) {
    const N = rotors.length || 1;
    const wShare = s.weight / N;
    for (let i = 0; i < rotorArrows.length; i++) {
      const lift = s.perLift[i] ?? 0;
      const position = s.rotorPositions?.[i];
      if (position) {
        rotors[i].localPosition.set(position.x, position.y, position.z);
      }
      const direction = s.rotorDirections?.[i] ?? { x: 0, y: 1, z: 0 };
      const vector = new THREE.Vector3(direction.x, direction.y, direction.z);
      if (vector.lengthSq() > 1e-8) {
        vector.normalize();
        rotors[i].localDirection.copy(vector);
      }
      const len = Math.max(0.05, Math.min(1.2, lift / 120));
      rotorArrows[i].setLength(len, 0.1, 0.06);
      rotorArrows[i].setColor(toColor(liftColor(lift, wShare)));
    }
    const totalDirection = s.totalDirection ?? { x: 0, y: 1, z: 0 };
    totalDirectionLocal.set(totalDirection.x, totalDirection.y, totalDirection.z).normalize();
    totalFollowsAttitude = s.totalFollowsAttitude ?? s.totalDirection == null;
    totalLift.setLength(Math.max(0.1, Math.min(2.4, (s.totalMagnitude ?? s.totalLift) / 120)), 0.18, 0.11);
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
    flowDir = s.flowDir ?? 1;
    applyAttitude();
  }

  function tick(dt, nextAttitude) {
    if (nextAttitude) applyAttitude(nextAttitude);
    if (!flow) return;
    const arr = flow.geo.attributes.position.array;
    for (let i = 0; i < flow.seed.length; i++) {
      flow.seed[i] = advanceFlowPhase(flow.seed[i], dt, downStrength);
      writeParticle(arr, i, rotors[flow.rotorOf[i]], flow.seed[i]);
    }
    flow.geo.attributes.position.needsUpdate = true;
  }

  return { root, setRotors, update, tick };
}
