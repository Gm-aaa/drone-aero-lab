import * as THREE from 'three';
import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, applyMaterial, highlightPart } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { computeLift, computeWeight, liftStatus, windVector, MATERIALS } from './aero/aero.js';
import { createState } from './state.js';
import { createUI, renderReadout, renderPartInfo } from './ui/ui.js';

const ctx = createScene(document.getElementById('app'));
const viz = createViz(ctx.scene);
const panel = document.getElementById('panel');

const state = createState({ subtype: 'octa', aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon' });

let subtype, current;
function rebuild() {
  if (current) {
    ctx.scene.remove(current.group);
    // 释放旧模型的 GPU 资源，避免切换子类时几何体/材质泄漏
    for (const mesh of Object.values(current.meshes)) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
  subtype = DRONES.multirotor.subtypes[state.get().subtype];
  current = buildDrone(subtype, state.get().materialId);
  ctx.scene.add(current.group);
}

function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  const lift = computeLift({ rotorCount: subtype.rotorCount, bladeSpeed: 36, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 });
  const weight = computeWeight({ bodyVolume: 6, materialId: s.materialId });
  const status = liftStatus(lift, weight);
  viz.update({ lift, weight, status, wind: windVector(s.windSpeed, s.windDirDeg) });
  renderReadout(panel.querySelector('#readout'), { lift, weight, status, material: MATERIALS[s.materialId] });
}

rebuild();
createUI(panel, { state, onSubtypeChange: () => { rebuild(); recompute(); } });
renderPartInfo(panel.querySelector('#partinfo'), null);
state.subscribe(recompute);
recompute();

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
    const part = hits[0].object.userData.part;
    highlightPart(current.meshes, part.id);
    renderPartInfo(panel.querySelector('#partinfo'), part);
  }
});

let last = performance.now();
ctx.start(() => { const now = performance.now(); viz.tick((now - last) / 1000); last = now; });
