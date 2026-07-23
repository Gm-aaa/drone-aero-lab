import * as THREE from 'three';
import { buildSubtypeParts, getSubtypeParts, DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

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
  throw new Error(`未知几何体: ${g.type}`);
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

const WASHOUT = 8;
export function applyBladeTwist(meshes, subtype, aoaDeg, rotorDiameter) {
  for (const part of getSubtypeParts(subtype)) {
    if (part.geometry.type === 'blade' && !part.tailRotor && meshes[part.id]) {
      meshes[part.id].geometry.dispose();
      meshes[part.id].geometry = makeTwistedBlade(
        rotorDiameter ?? part.geometry.args[0], part.geometry.args[1],
        aoaDeg + WASHOUT, aoaDeg - WASHOUT,
      );
    }
  }
}

export { DRONES, buildSubtypeParts, getSubtypeParts };
