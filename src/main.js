import { createScene } from './scene/scene.js';
import { buildDrone, DRONES } from './builder/builder.js';

const ctx = createScene(document.getElementById('app'));
const { group } = buildDrone(DRONES.multirotor.subtypes.octa, 'carbon');
ctx.scene.add(group);
ctx.start();
