import * as THREE from 'three';
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, highlightPart, getSubtypeParts } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { createHeliViz } from './viz/heli.js';
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
  category: 'multirotor', subtype: 'octa', aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon',
  updraft: 0, rpm: 2200, rotorDiameter: 0.42, tailPitch: 6, cyclicDeg: 0, engineOn: true,
});

const attitude = createAttitude();
const qYaw = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _q = new THREE.Quaternion();
let yawAngle = 0;
let heliState = { yawRate: 0, rpmFactor: 1 };

let subtype, current;
let heliViz = null;
function rebuild() {
  if (current) {
    ctx.content.remove(current.group);
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
    const rotors = getSubtypeParts(subtype)
      .filter((p) => p.mainRotor)
      .map((p) => ({ x: p.position[0], z: p.position[2], y: p.position[1] }));
    viz.setRotors(rotors);
    heliViz = createHeliViz(current.group, subtype);
  }
  yawAngle = 0;
}

function doRecompute() {
  heliState = recompute(state.get(), { current, subtype, viz, heliViz, panel, airfoil, aerochart }, attitude);
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

let spinAngle = 0;
ctx.start(
  (dt) => {
    viz.tick(dt);
    const st = state.get();
    yawAngle += heliState.yawRate * dt;
    qYaw.setFromAxisAngle(_up, yawAngle);
    // Fix #2: yaw 绕世界垂直轴，先施加 yaw 再叠加 tilt（baseQuat 在 yaw 后的局部坐标系）
    current.group.quaternion.copy(qYaw).multiply(attitude.baseQuat);
    spinAngle += (st.rpm / 60) * 2 * Math.PI * VISUAL_SPIN_FACTOR * dt * heliState.rpmFactor;
    for (const mesh of Object.values(current.meshes)) {
      const p = mesh.userData.part;
      if (p.tailRotor) {
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
