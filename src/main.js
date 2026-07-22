import * as THREE from 'three';
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, applyMaterial, highlightPart, applyBladeTwist, buildSubtypeParts } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { createAxes, createGizmo } from './viz/axes.js';
import { createAirfoil } from './viz/airfoil.js';
import { createAeroChart } from './viz/aerochart.js';
import { computeWeight, liftStatus, windVector, MATERIALS, perRotorLift, netLift, windVector3D } from './aero/aero.js';
import { createState } from './state.js';
import { createUI, renderReadout, renderPartInfo, renderPartList } from './ui/ui.js';

const BODY_VOLUME = 6.7;

const ctx = createScene(document.getElementById('app'));
const viz = createViz(ctx.content);
createAxes(ctx.content);
const gizmo = createGizmo(ctx.renderer, ctx.camera);
const panel = document.getElementById('panel');
const airfoil = createAirfoil(document.getElementById('airfoil'));
const aerochart = createAeroChart(document.getElementById('aerochart'));

const state = createState({ subtype: 'octa', aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon', updraft: 0 });

let subtype, current;
function rebuild() {
  if (current) {
    ctx.content.remove(current.group);
    // 释放旧模型的 GPU 资源，避免切换子类时几何体/材质泄漏
    for (const mesh of Object.values(current.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  subtype = DRONES.multirotor.subtypes[state.get().subtype];
  current = buildDrone(subtype, state.get().materialId);
  ctx.content.add(current.group);
  const rotors = buildSubtypeParts(subtype)
    .filter((p) => p.id.startsWith('motor'))
    .map((p) => ({ x: p.position[0], z: p.position[2] }));
  viz.setRotors(rotors);
}

function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  applyBladeTwist(current.meshes, subtype, s.aoaDeg);
  const aeroP = { bladeSpeed: 36, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 };
  const single = perRotorLift(aeroP);
  const perLift = Array.from({ length: subtype.rotorCount }, () => single);
  const totalLift = single * subtype.rotorCount;
  const weight = computeWeight({ bodyVolume: BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: 1.225 });
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  // 机身抗风倾斜：绕与水平风垂直的水平轴倾转 tilt
  const wr = s.windDirDeg * Math.PI / 180;
  const tiltAxis = new THREE.Vector3(Math.sin(wr), 0, -Math.cos(wr));
  current.group.setRotationFromAxisAngle(tiltAxis, net.tiltDeg * Math.PI / 180);
  viz.update({ perLift, totalLift, effectiveLift: net.effectiveLift, weight, wind });
  renderReadout(panel.querySelector('#readout'), { lift: net.effectiveLift, weight, status: net.status, material: MATERIALS[s.materialId] });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
}

rebuild();
createUI(panel, {
  state,
  onSubtypeChange: () => {
    rebuild();
    recompute();
    renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), selectedPartId, selectPart);
  },
});
renderPartInfo(panel.querySelector('#partinfo'), null);
state.subscribe(recompute);
recompute();

let selectedPartId = null;
function selectPart(partId) {
  selectedPartId = partId;
  const part = current.meshes[partId]?.userData.part;
  highlightPart(current.meshes, partId);
  renderPartInfo(panel.querySelector('#partinfo'), part);
  renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), partId, selectPart);
}
renderPartList(panel.querySelector('#partlist'), buildSubtypeParts(subtype), selectedPartId, selectPart);

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
ctx.start(
  () => { const now = performance.now(); viz.tick((now - last) / 1000); last = now; },
  () => gizmo.render(),
);
