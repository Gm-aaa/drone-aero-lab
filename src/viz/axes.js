import * as THREE from 'three';

function labelSprite(text, cssColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = cssColor;
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  spr.scale.set(0.35, 0.18, 1);
  return spr;
}

export function createAxes(group) {
  const g = new THREE.Group();
  const L = 1.2;
  const axis = (dir, color) => g.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), L, color, 0.12, 0.07));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444);
  axis(new THREE.Vector3(0, 1, 0), 0x3b82f6);
  axis(new THREE.Vector3(0, 0, 1), 0x22c55e);
  const xl = labelSprite('X', '#ef4444'); xl.position.set(L + 0.18, 0, 0);
  const zl = labelSprite('Z↑', '#3b82f6'); zl.position.set(0, L + 0.18, 0);
  const yl = labelSprite('Y', '#22c55e'); yl.position.set(0, 0, L + 0.18);
  g.add(xl, zl, yl);
  group.add(g);
  return g;
}

export function createGizmo(renderer, mainCamera) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
  const axesRoot = new THREE.Group();
  axesRoot.rotation.x = Math.PI / 2;
  scene.add(axesRoot);
  const axis = (dir, color) => axesRoot.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1, color, 0.28, 0.16));
  axis(new THREE.Vector3(1, 0, 0), 0xef4444);
  axis(new THREE.Vector3(0, 1, 0), 0x3b82f6);
  axis(new THREE.Vector3(0, 0, 1), 0x22c55e);
  const SIZE = 110, PAD = 12;
  const sz = new THREE.Vector2();
  function render() {
    renderer.getSize(sz);
    cam.position.set(0, 0, 4).applyQuaternion(mainCamera.quaternion);
    cam.quaternion.copy(mainCamera.quaternion);
    renderer.setScissorTest(true);
    renderer.setViewport(sz.x - SIZE - PAD, PAD, SIZE, SIZE);
    renderer.setScissor(sz.x - SIZE - PAD, PAD, SIZE, SIZE);
    renderer.clearDepth();
    renderer.render(scene, cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, sz.x, sz.y);
  }
  return { render };
}
