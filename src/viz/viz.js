import * as THREE from 'three';

export function createViz(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const lift = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.1, 0), 1, 0x22c55e, 0.15, 0.09);
  const gravity = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0.1, 0), 1, 0xef4444, 0.15, 0.09);
  const wind = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1.2, 0.3, 0), 1, 0x22d3ee, 0.15, 0.09);
  group.add(lift, gravity, wind);

  // 气流粒子
  const N = 200;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    const p = [(Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 2];
    seed.push(p); pos.set(p, i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.03 }));
  group.add(points);

  let windVec = { x: 0, z: 0 };

  function update(s) {
    const liftLen = Math.min(2, 0.2 + s.lift / 400);
    lift.setLength(liftLen, 0.15, 0.09);
    lift.setColor(s.status === 'stall' ? 0xf97316 : 0x22c55e);
    gravity.setLength(Math.min(2, 0.2 + s.weight / 400), 0.15, 0.09);
    const wlen = Math.hypot(s.wind.x, s.wind.z);
    wind.visible = wlen > 0.01;
    if (wlen > 0.01) {
      wind.setDirection(new THREE.Vector3(s.wind.x, 0, s.wind.z).normalize());
      wind.setLength(Math.min(2, 0.3 + wlen / 15), 0.15, 0.09);
    }
    windVec = s.wind;
  }

  function tick(dt) {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      arr[i * 3]     += (windVec.x * 0.02 + 0) * dt * 60 / 60;
      arr[i * 3 + 1] -= 0.6 * dt;            // 下洗
      arr[i * 3 + 2] += windVec.z * 0.02 * dt * 60 / 60;
      if (arr[i * 3 + 1] < -0.6) {           // 复位
        arr.set(seed[i], i * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update, tick };
}
