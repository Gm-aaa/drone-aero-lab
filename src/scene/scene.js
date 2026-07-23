import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function frameDeltaSeconds(now, previous, maxStep = 0.05) {
  return Math.min(Math.max((now - previous) / 1000, 0), maxStep);
}

// 坐标系约定：
//   工程坐标 Z-up（X-Y 水平，Z 垂直 = 升力方向）通过 camera.up=(0,0,1) 实现。
//   Three.js 内部 Y-up：content 组绕 X 旋转 90° 桥接（局部 +Y → 世界 +Z）。
//   所有模块在 content 局部空间工作，使用 Y-up 约定（+Y = 升力方向）。
export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1016);

  const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.1, 1000,
  );
  camera.up.set(0, 0, 1);
  camera.position.set(5, -5.5, 3.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 5, 8);
  scene.add(dir);

  const content = new THREE.Group();
  content.rotation.x = Math.PI / 2; // Y-up(局部) → Z-up(世界)
  scene.add(content);
  content.add(new THREE.GridHelper(10, 20, 0x334155, 0x1e293b));

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function start(renderCb, afterRenderCb) {
    let raf = 0;
    let running = false;
    let lastFrameTime = performance.now();
    function loop(now = performance.now()) {
      raf = requestAnimationFrame(loop);
      const dt = frameDeltaSeconds(now, lastFrameTime);
      lastFrameTime = now;
      controls.update();
      if (renderCb) renderCb(dt);
      renderer.render(scene, camera);
      if (afterRenderCb) afterRenderCb();
    }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else if (!running) {
        running = true;
        lastFrameTime = performance.now();
        loop();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    running = true;
    loop();
  }

  return { scene, content, camera, renderer, controls, start };
}
