import { createScene } from './scene/scene.js';
import { buildDrone, DRONES, applyMaterial } from './builder/builder.js';
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
  if (current) ctx.scene.remove(current.group);
  subtype = DRONES.multirotor.subtypes[state.get().subtype];
  current = buildDrone(subtype, state.get().materialId);
  ctx.scene.add(current.group);
}

function recompute() {
  const s = state.get();
  applyMaterial(current.meshes, subtype, s.materialId);
  const lift = computeLift({ rotorCount: subtype.rotorCount, bladeSpeed: 55, refArea: 0.02, aoaDeg: s.aoaDeg, airDensity: 1.225 });
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

let last = performance.now();
ctx.start(() => { const now = performance.now(); viz.tick((now - last) / 1000); last = now; });
