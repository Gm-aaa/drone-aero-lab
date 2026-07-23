import * as THREE from 'three';

// 绕 Y 轴的弧形箭头（扭矩示意）：半径 r、高度 y、弧 250°，末端加锥头
function makeArc(r, y, color, flip = false) {
  const pts = [];
  const a0 = 0, a1 = Math.PI * 1.4;
  for (let i = 0; i <= 40; i++) {
    const a = a0 + (a1 - a0) * (i / 40) * (flip ? -1 : 1);
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, 0.012, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  head.position.copy(end);
  head.lookAt(end.clone().add(end.clone().sub(prev)));
  // lookAt 使 -Z 指向前进方向；锥尖在 +Y，需绕 X 转 -90° 使 +Y→-Z（前方）
  head.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  g.add(tube, head);
  return { group: g, mats: [tube.material, head.material], geos: [tube.geometry, head.geometry] };
}

export function createHeliViz(group, subtype) {
  const root = new THREE.Group();
  group.add(root);
  const mats = [], geos = [];
  const track = (a) => { mats.push(...a.mats); geos.push(...a.geos); root.add(a.group); };

  const arcs = [];
  if (subtype.config === 'coaxial') {
    const up = makeArc(0.55, 1.12, 0xf97316, false);   // 上旋翼反扭矩
    const dn = makeArc(0.55, 0.82, 0x38bdf8, true);    // 下旋翼反扭矩（反向）
    track(up); track(dn); arcs.push(up, dn);
  } else {
    const arc = makeArc(0.6, 0.92, 0xf97316, false);   // 主旋翼反扭矩（机身被反向拧）
    track(arc); arcs.push(arc);
  }

  // 尾桨推力箭头（仅 tailrotor）：沿 +Z（侧向）
  let tailArrow = null;
  if (subtype.config === 'tailrotor') {
    tailArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1.52, 0.55, 0.1), 0.4, 0x22d3ee, 0.1, 0.06,
    );
    root.add(tailArrow);
  }

  function update({ torque, tailThrust }) {
    const t = Math.max(0.15, Math.min(1, torque / 200));
    for (const a of arcs) a.group.children.forEach((m) => { m.material.opacity = 0.25 + 0.65 * t; });
    if (tailArrow) {
      tailArrow.setLength(Math.max(0.08, Math.min(0.9, tailThrust / 40)), 0.1, 0.06);
      tailArrow.visible = tailThrust > 0.01;
    }
  }

  function dispose() {
    group.remove(root);
    mats.forEach((m) => m.dispose());
    geos.forEach((g) => g.dispose());
    if (tailArrow) {
      tailArrow.line.geometry.dispose();
      tailArrow.line.material.dispose();
      tailArrow.cone.geometry.dispose();
      tailArrow.cone.material.dispose();
    }
  }

  return { update, dispose };
}
