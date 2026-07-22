import * as THREE from 'three';
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, applyMaterial, highlightPart, applyBladeTwist, getSubtypeParts } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { createHeliViz } from './viz/heli.js';
import { createAxes, createGizmo } from './viz/axes.js';
import { createAirfoil } from './viz/airfoil.js';
import { createAeroChart } from './viz/aerochart.js';
import {
  computeWeight, computeDrag, MATERIALS, perRotorLift, netLift, windVector3D, bladeLinearSpeed,
  mainRotorTorque, tailRotorThrust, yawRate, cyclicSplit, autorotation,
} from './aero/aero.js';
import { createState } from './state.js';
import { createUI, renderReadout, renderPartInfo, renderPartList } from './ui/ui.js';

const BODY_VOLUME = 6.7;
const HELI_BODY_VOLUME = 48;   // 标定：直升机默认净升重比≈1.0-1.1（控制器实测微调）

const ctx = createScene(document.getElementById('app'));
const viz = createViz(ctx.content);
createAxes(ctx.content);
const gizmo = createGizmo(ctx.renderer, ctx.camera);
const panel = document.getElementById('panel');
const airfoil = createAirfoil(document.getElementById('airfoil'));
const aerochart = createAeroChart(document.getElementById('aerochart'));

const state = createState({
  category: 'multirotor', subtype: 'octa', aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon',
  updraft: 0, rpm: 2200, bladeLen: 0.42, tailPitch: 6, cyclicDeg: 0, engineOn: true,
});

// 姿态四元数：qWind(抗风倾斜) × qPitch(周期变距前倾，多旋翼恒为单位) 组成 baseQuat；
// 渲染循环再叠加 qYaw（偏航自旋，直升机不平衡时持续累积）
const qWind = new THREE.Quaternion(), qPitch = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
const baseQuat = new THREE.Quaternion();
const _axis = new THREE.Vector3(), _axisZ = new THREE.Vector3(0, 0, 1), _up = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0), _q = new THREE.Quaternion();
let yawAngle = 0;
let heliState = { yawRate: 0, rpmFactor: 1 };

let subtype, current;
let heliViz = null;
function rebuild() {
  if (current) {
    ctx.content.remove(current.group);
    // 释放旧模型的 GPU 资源，避免切换子类时几何体/材质泄漏
    for (const mesh of Object.values(current.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  if (heliViz) { heliViz.dispose(); heliViz = null; }
  const s = state.get();
  subtype = DRONES[s.category].subtypes[s.subtype];
  current = buildDrone(subtype, s.materialId);
  ctx.content.add(current.group);
  if (s.category === 'multirotor') {
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.id.startsWith('motor'))
      .map((p) => ({ x: p.position[0], z: p.position[2] }));
    viz.setRotors(rotors);
  } else {
    // 主旋翼位置（含高度）作为下洗发射点；共轴取两副
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.mainRotor)
      .map((p) => ({ x: p.position[0], z: p.position[2], y: p.position[1] }));
    viz.setRotors(rotors);
    heliViz = createHeliViz(current.group, subtype);
  }
  yawAngle = 0;   // 切换机型复位偏航
}

function recomputeMulti(s) {
  applyMaterial(current.meshes, subtype, s.materialId);
  applyBladeTwist(current.meshes, subtype, s.aoaDeg, s.bladeLen);
  // 转速+桨长 → 桨叶线速度；参考面积随桨长线性缩放(0.42m 时保持原标定 0.02)
  const aeroP = {
    bladeSpeed: bladeLinearSpeed(s.rpm, s.bladeLen),
    refArea: s.bladeLen * (0.02 / 0.42),
    aoaDeg: s.aoaDeg, airDensity: 1.225,
  };
  const single = perRotorLift(aeroP);
  const perLift = Array.from({ length: subtype.rotorCount }, () => single);
  const totalLift = single * subtype.rotorCount;
  const weight = computeWeight({ bodyVolume: BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: 1.225 });
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  // 机身抗风倾斜：绕与水平风垂直的水平轴倾转 tilt
  const wr = s.windDirDeg * Math.PI / 180;
  qWind.setFromAxisAngle(_axis.set(Math.sin(wr), 0, -Math.cos(wr)), net.tiltDeg * Math.PI / 180);
  qPitch.identity();
  baseQuat.copy(qWind).multiply(qPitch);
  viz.update({ perLift, totalLift, effectiveLift: net.effectiveLift, weight, wind });
  const aeroDrag = computeDrag({ ...aeroP, rotorCount: subtype.rotorCount });
  renderReadout(panel.querySelector('#readout'), { totalLift, net, weight, aoaDeg: s.aoaDeg, aeroDrag, material: MATERIALS[s.materialId] });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
  heliState = { yawRate: 0, rpmFactor: 1 };
}

function recomputeHeli(s) {
  if (!heliViz) return;   // 分类刚切换、rebuild 尚未执行时的同步订阅触发：跳过，随后的 rebuild()+recompute() 会以正确状态重算
  applyMaterial(current.meshes, subtype, s.materialId);
  const mainLen = subtype.mainRotorLen * (s.bladeLen / 0.42);
  applyBladeTwist(current.meshes, subtype, s.aoaDeg, mainLen);
  const auto = autorotation({ engineOn: s.engineOn, aoaDeg: s.aoaDeg });
  const aeroP = { bladeSpeed: bladeLinearSpeed(s.rpm, mainLen) * auto.rpmFactor, refArea: mainLen * (0.02 / 0.42), aoaDeg: s.aoaDeg, airDensity: 1.225 };
  const nRotor = subtype.config === 'coaxial' ? 2 * 0.85 : 1;
  const totalLift = perRotorLift(aeroP) * nRotor;
  const cyc = cyclicSplit(totalLift, s.cyclicDeg);
  const weight = computeWeight({ bodyVolume: HELI_BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift: cyc.vertical, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: 1.225 });
  const torque = subtype.config === 'coaxial' ? 0 : mainRotorTorque(totalLift, mainLen);
  const tailThrust = subtype.config === 'tailrotor' ? tailRotorThrust(s.tailPitch, s.rpm) : null;
  const yr = subtype.config === 'tailrotor'
    ? yawRate({ torque, tailThrust, tailArm: subtype.tailArm })
    : 0;
  heliState = { yawRate: yr, rpmFactor: auto.rpmFactor };
  // 机身姿态：风倾 × 周期变距前倾（绕局部 Z 负向）——偏航在渲染循环叠加
  const wr = s.windDirDeg * Math.PI / 180;
  qWind.setFromAxisAngle(_axis.set(Math.sin(wr), 0, -Math.cos(wr)), net.tiltDeg * Math.PI / 180);
  qPitch.setFromAxisAngle(_axisZ, -s.cyclicDeg * Math.PI / 180);
  baseQuat.copy(qWind).multiply(qPitch);
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  // 每副主旋翼一支升力箭头（共轴两支，各半）
  const rotorN = subtype.config === 'coaxial' ? 2 : 1;
  const perLift = Array.from({ length: rotorN }, () => totalLift / rotorN);
  viz.update({ perLift, totalLift: cyc.vertical, effectiveLift: net.effectiveLift, weight, wind, flowDir: auto.mode === 'autorotation' ? -1 : 1 });
  heliViz.update({ torque, tailThrust: tailThrust ?? 0 });
  const aeroDrag = computeDrag({ ...aeroP, rotorCount: 1 });
  const yawState = subtype.config === 'coaxial' ? null : Math.abs(yr) < 0.02 ? 'balanced' : yr > 0 ? 'spinLeft' : 'spinRight';
  renderReadout(panel.querySelector('#readout'), {
    totalLift, net, weight, aoaDeg: s.aoaDeg, aeroDrag, material: MATERIALS[s.materialId],
    heli: { torque, tailThrust, yawState, forward: cyc.forward, mode: auto.mode, descentRate: auto.descentRate },
  });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
}

function recompute() {
  const s = state.get();
  if (s.category === 'helicopter') recomputeHeli(s);
  else recomputeMulti(s);
}

let selectedPartId = null;
function refreshUI() {
  createUI(panel, {
    state,
    onSubtypeChange: () => {
      rebuild();
      refreshUI();
      recompute();
      selectedPartId = null;
      renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), selectedPartId, selectPart);
      renderPartInfo(panel.querySelector('#partinfo'), null);
    },
    onCategoryChange: () => {
      rebuild();
      refreshUI();
      recompute();
      selectedPartId = null;
      renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), selectedPartId, selectPart);
      renderPartInfo(panel.querySelector('#partinfo'), null);
    },
  });
}

rebuild();
refreshUI();
renderPartInfo(panel.querySelector('#partinfo'), null);
state.subscribe(recompute);
recompute();

function selectPart(partId) {
  selectedPartId = partId;
  const part = current.meshes[partId]?.userData.part;
  highlightPart(current.meshes, partId);
  renderPartInfo(panel.querySelector('#partinfo'), part);
  renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), partId, selectPart);
}
renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), selectedPartId, selectPart);

// Part picking with raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
ctx.renderer.domElement.addEventListener('click', (e) => {
  const r = ctx.renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(mouse, ctx.camera);
  const hits = raycaster.intersectObjects(current.group.children, false);
  if (hits.length) {
    selectPart(hits[0].object.userData.part.id);
  }
});

let last = performance.now();
let spinAngle = 0;
ctx.start(
  () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    viz.tick(dt);
    const st = state.get();
    // 偏航（直升机不平衡时机身自旋）
    yawAngle += heliState.yawRate * dt;
    qYaw.setFromAxisAngle(_up, yawAngle);
    current.group.quaternion.copy(baseQuat).multiply(qYaw);
    // 旋翼/螺旋桨旋转(视觉减速系数 0.05,正反桨方向相反；自转/减速由 rpmFactor 调制)
    spinAngle += (st.rpm / 60) * 2 * Math.PI * 0.05 * dt * heliState.rpmFactor;
    for (const mesh of Object.values(current.meshes)) {
      const p = mesh.userData.part;
      if (p.tailRotor) {
        // 尾桨：竖直平面内旋转（先倾 90° 再绕自身盘面转，×4 倍速）
        mesh.quaternion.setFromAxisAngle(_axisX, Math.PI / 2);
        _q.setFromAxisAngle(_up, spinAngle * 4);
        mesh.quaternion.multiply(_q);
      } else if (p.spin) {
        mesh.rotation.y = (p.spin === 'cw' ? -1 : 1) * spinAngle;
      }
    }
  },
  () => gizmo.render(),
);
