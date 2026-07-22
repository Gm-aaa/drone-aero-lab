import * as THREE from 'three';
import { createScene } from './scene/scene.js';

const ctx = createScene(document.getElementById('app'));
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x38bdf8 }),
);
ctx.scene.add(cube);
ctx.start(() => { cube.rotation.y += 0.005; });
