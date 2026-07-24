import * as THREE from 'three';
import { buildSubtypeParts, getSubtypeParts, DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

const TOTAL_WASHOUT_DEG = 16;

export function bladePitchAtRadius(referenceAoaDeg, radiusFraction) {
  return referenceAoaDeg + (0.75 - radiusFraction) * TOTAL_WASHOUT_DEG;
}

export function makeTwistedBlade(diameter, chord, rootPitchDeg, tipPitchDeg, segments = 10) {
  const positions = [];
  const half = diameter / 2, c = chord / 2;
  const st = [];
  for (let i = 0; i <= segments; i++) {
    const x = -half + (diameter * i) / segments;
    const rFrac = Math.abs(x) / half;                 // 0=根(中心) 1=尖(两端)
    // 真实螺旋桨绕桨毂 180° 点对称：两半桨叶的桨距方向刚好相反，
    // 旋转时两侧才都以前缘迎风、产生同向升力。
    const sign = x >= 0 ? 1 : -1;
    const pitch = sign * (rootPitchDeg + (tipPitchDeg - rootPitchDeg) * rFrac) * Math.PI / 180;
    const s = Math.sin(pitch), cs = Math.cos(pitch);
    st.push([[x, -c * s, c * cs], [x, c * s, -c * cs]]); // 前缘, 后缘(绕X按桨距旋转)
  }
  for (let i = 0; i < segments; i++) {
    const [le0, te0] = st[i], [le1, te1] = st[i + 1];
    positions.push(...le0, ...te0, ...te1, ...le0, ...te1, ...le1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeGeometry(g) {
  if (g.type === 'box') return new THREE.BoxGeometry(...g.args);
  if (g.type === 'cylinder') return new THREE.CylinderGeometry(...g.args);
  if (g.type === 'blade') return makeTwistedBlade(g.args[0], g.args[1], 16, 0);
  if (g.type === 'wing') return makeWingGeometry(...g.args);
  throw new Error(`未知几何体: ${g.type}`);
}

// X=弦向、Y=厚度、Z=翼展方向的对称梯形机翼。
export function makeWingGeometry(span, rootChord, tipChord, thickness) {
  const h = span / 2;
  const vertices = [];
  const faces = [];
  for (const y of [-thickness / 2, thickness / 2]) {
    vertices.push(
      rootChord / 2, y, 0,
      -rootChord / 2, y, 0,
      tipChord / 2, y, h,
      -tipChord / 2, y, h,
      tipChord / 2, y, -h,
      -tipChord / 2, y, -h,
    );
  }
  const quad = (a, b, c, d) => faces.push(a, b, c, a, c, d);
  // 下表面、上表面、前缘、后缘、左右翼尖。
  quad(0, 2, 3, 1); quad(6, 7, 9, 8);
  quad(0, 6, 8, 2); quad(1, 3, 9, 7);
  quad(2, 8, 9, 3); quad(4, 5, 11, 10);
  // 另一半翼的上下表面。
  quad(0, 1, 5, 4); quad(6, 10, 11, 7);
  const positions = [];
  for (const index of faces) positions.push(
    vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2],
  );
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildDrone(subtype, materialId) {
  const group = new THREE.Group();
  const meshes = {};
  const structColor = MATERIALS[materialId].color;
  for (const part of getSubtypeParts(subtype)) {
    const color = part.materialRole === 'structural' ? structColor : (part.color ?? 0xffffff);
    const mesh = new THREE.Mesh(
      makeGeometry(part.geometry),
      new THREE.MeshStandardMaterial({
        color, metalness: 0.3, roughness: 0.6,
        side: part.geometry.type === 'blade' ? THREE.DoubleSide : THREE.FrontSide,
      }),
    );
    mesh.position.set(...part.position);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    mesh.userData.part = part;
    meshes[part.id] = mesh;
    group.add(mesh);
  }
  return { group, meshes };
}

export function highlightPart(meshes, partId) {
  for (const [id, mesh] of Object.entries(meshes)) {
    mesh.material.emissive = new THREE.Color(id === partId ? 0x2563eb : 0x000000);
    mesh.material.emissiveIntensity = id === partId ? 0.8 : 0;
  }
}

export function applyMaterial(meshes, subtype, materialId) {
  const structColor = MATERIALS[materialId].color;
  for (const part of getSubtypeParts(subtype)) {
    if (part.materialRole === 'structural' && meshes[part.id]) {
      meshes[part.id].material.color.setHex(structColor);
    }
  }
}

export function applyBladeTwist(meshes, subtype, aoaDeg, rotorDiameter) {
  for (const part of getSubtypeParts(subtype)) {
    if (part.geometry.type === 'blade' && !part.tailRotor && meshes[part.id]) {
      meshes[part.id].geometry.dispose();
      meshes[part.id].geometry = makeTwistedBlade(
        rotorDiameter ?? part.geometry.args[0], part.geometry.args[1],
        bladePitchAtRadius(aoaDeg, 0),
        bladePitchAtRadius(aoaDeg, 1),
      );
    }
  }
}

export { DRONES, buildSubtypeParts, getSubtypeParts };
