import * as THREE from 'three';
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, highlightPart, getSubtypeParts } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { createHeliViz } from './viz/heli.js';
import { createVtolViz } from './viz/vtol.js';
import { createAxes, createGizmo } from './viz/axes.js';
import { createAirfoil } from './viz/airfoil.js';
import { createAeroChart } from './viz/aerochart.js';
import { createState } from './state.js';
import { createUI, renderPartInfo, renderPartList } from './ui/ui.js';
import { createAttitude, recompute } from './controller.js';

const VISUAL_SPIN_FACTOR = 0.05;

const ctx = createScene(document.getElementById('app'));
const viz = createViz(ctx.content);
createAxes(ctx.content);
const gizmo = createGizmo(ctx.renderer, ctx.camera);
const panel = document.getElementById('panel');
const airfoil = createAirfoil(document.getElementById('airfoil'));
const aerochart = createAeroChart(document.getElementById('aerochart'));

const state = createState({
  category: 'multirotor',
  subtype: 'octa',
  ...DRONES.multirotor.defaults,
  windSpeed: 4,
  windDirDeg: 0,
  materialId: 'carbon',
  updraft: 0,
});

const attitude = createAttitude();
const qYaw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _axisZ = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _qTilt = new THREE.Quaternion();
let yawAngle = 0;
let flightState = { yawRate: 0, rpmFactor: 1 };

let subtype, current;
let heliViz = null;
let vtolViz = null;
function rebuild() {
  if (current) {
    ctx.content.remove(current.group);
    for (const mesh of Object.values(current.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  if (heliViz) { heliViz.dispose(); heliViz = null; }
  if (vtolViz) { vtolViz.dispose(); vtolViz = null; }
  const s = state.get();
  subtype = DRONES[s.category].subtypes[s.subtype];
  current = buildDrone(subtype, s.materialId);
  ctx.content.add(current.group);
  if (s.category === 'multirotor') {
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.id.startsWith('motor'))
      .map((p) => ({ x: p.position[0], z: p.position[2] }));
    viz.setRotors(rotors);
  } else if (s.category === 'helicopter') {
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.mainRotor)
      .map((p) => ({ x: p.position[0], z: p.position[2], y: p.position[1] }));
    viz.setRotors(rotors);
    heliViz = createHeliViz(current.group, subtype);
  } else {
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.vtolRotor)
      .map((p) => ({ x: p.position[0], z: p.position[2], y: p.position[1] }));
    viz.setRotors(rotors);
    vtolViz = createVtolViz(current.group, subtype);
  }
  yawAngle = 0;
}

function doRecompute() {
  flightState = recompute(
    state.get(),
    { current, subtype, viz, heliViz, vtolViz, panel, airfoil, aerochart },
    attitude,
  );
}

let selectedPartId = null;
let changingAircraft = false;
function changeAircraft(patch) {
  changingAircraft = true;
  state.set(patch);
  rebuild();
  refreshUI();
  selectedPartId = null;
  renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), selectedPartId, selectPart);
  renderPartInfo(panel.querySelector('#partinfo'), null);
  changingAircraft = false;
  doRecompute();
}

function refreshUI() {
  createUI(panel, {
    state,
    onSubtypeChange: changeAircraft,
    onCategoryChange: changeAircraft,
  });
}

rebuild();
refreshUI();
renderPartInfo(panel.querySelector('#partinfo'), null);
state.subscribe(() => {
  if (!changingAircraft) doRecompute();
});
doRecompute();

function selectPart(partId) {
  selectedPartId = partId;
  const part = current.meshes[partId]?.userData.part;
  highlightPart(current.meshes, partId);
  renderPartInfo(panel.querySelector('#partinfo'), part);
  renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), partId, selectPart);
}
renderPartList(panel.querySelector('#partlist'), getSubtypeParts(subtype), selectedPartId, selectPart);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
ctx.renderer.domElement.addEventListener('click', (e) => {
  const r = ctx.renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(mouse, ctx.camera);
  const hits = raycaster.intersectObjects(current.group.children, false);
  if (hits.length && hits[0].object.userData.part) {
    selectPart(hits[0].object.userData.part.id);
  }
});

ctx.start(
  (dt) => {
    const st = state.get();
    yawAngle += flightState.yawRate * dt;
    qYaw.setFromAxisAngle(_up, yawAngle);
    // Fix #2: yaw 绕世界垂直轴，先施加 yaw 再叠加 tilt（baseQuat 在 yaw 后的局部坐标系）
    current.group.quaternion.copy(qYaw).multiply(attitude.baseQuat);
    viz.tick(dt, current.group.quaternion);
    for (const mesh of Object.values(current.meshes)) {
      const p = mesh.userData.part;
      if (p.tiltNacelle) {
        mesh.rotation.z = -(flightState.transitionDeg ?? 0) * Math.PI / 180;
      }
      let speedFactor = flightState.rpmFactor;
      if (p.liftRotor) speedFactor *= flightState.liftRotorFactor ?? 1;
      if (p.cruiseRotor) speedFactor *= flightState.cruiseRotorFactor ?? 0;
      const step = (st.rpm / 60) * 2 * Math.PI * VISUAL_SPIN_FACTOR * dt * speedFactor;
      mesh.userData.spinAngle = (mesh.userData.spinAngle ?? 0) + step;
      const spinAngle = mesh.userData.spinAngle;
      if (p.tailRotor) {
        mesh.quaternion.setFromAxisAngle(_axisX, Math.PI / 2);
        _q.setFromAxisAngle(_up, spinAngle * 4);
        mesh.quaternion.multiply(_q);
      } else if (p.tiltRotor || p.cruiseRotor) {
        const tiltDeg = p.tiltRotor ? (flightState.transitionDeg ?? 0) : 90;
        const tiltRad = tiltDeg * Math.PI / 180;
        if (p.tiltRotor) {
          mesh.position.set(
            p.tiltPivot[0] + Math.sin(tiltRad) * p.tiltOffset,
            p.tiltPivot[1] + Math.cos(tiltRad) * p.tiltOffset,
            p.tiltPivot[2],
          );
        }
        _qTilt.setFromAxisAngle(_axisZ, -tiltRad);
        _q.setFromAxisAngle(_up, (p.spin === 'cw' ? -1 : 1) * spinAngle);
        mesh.quaternion.copy(_qTilt).multiply(_q);
      } else if (p.spin) {
        mesh.rotation.y = (p.spin === 'cw' ? -1 : 1) * spinAngle;
      }
    }
  },
  () => gizmo.render(),
);
