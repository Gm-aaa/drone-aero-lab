import { createScene } from './scene/scene.js';
import { buildDrone, DRONES } from './builder/builder.js';
import { createViz } from './viz/viz.js';
import { computeLift, computeWeight, liftStatus, windVector } from './aero/aero.js';

const ctx = createScene(document.getElementById('app'));
const subtype = DRONES.multirotor.subtypes.octa;
const { group } = buildDrone(subtype, 'carbon');
ctx.scene.add(group);

const viz = createViz(ctx.scene);
const params = { aoaDeg: 8, windSpeed: 4, windDirDeg: 0, materialId: 'carbon' };

function recompute() {
  const lift = computeLift({ rotorCount: subtype.rotorCount, bladeSpeed: 55, refArea: 0.02, aoaDeg: params.aoaDeg, airDensity: 1.225 });
  const weight = computeWeight({ bodyVolume: 6, materialId: params.materialId });
  viz.update({ lift, weight, status: liftStatus(lift, weight), wind: windVector(params.windSpeed, params.windDirDeg) });
}
recompute();

let last = performance.now();
ctx.start(() => {
  const now = performance.now();
  viz.tick((now - last) / 1000);
  last = now;
});
