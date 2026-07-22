import * as THREE from 'three';
import { buildSubtypeParts, DRONES } from '../data/drones.js';
import { MATERIALS } from '../aero/aero.js';

function makeGeometry(g) {
  if (g.type === 'box') return new THREE.BoxGeometry(...g.args);
  if (g.type === 'cylinder') return new THREE.CylinderGeometry(...g.args);
  throw new Error(`未知几何体: ${g.type}`);
}

export function buildDrone(subtype, materialId) {
  const group = new THREE.Group();
  const meshes = {};
  const structColor = MATERIALS[materialId].color;
  for (const part of buildSubtypeParts(subtype)) {
    const color = part.materialRole === 'structural' ? structColor : (part.color ?? 0xffffff);
    const mesh = new THREE.Mesh(
      makeGeometry(part.geometry),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6 }),
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
  for (const part of buildSubtypeParts(subtype)) {
    if (part.materialRole === 'structural' && meshes[part.id]) {
      meshes[part.id].material.color.setHex(structColor);
    }
  }
}

export function applyBladePitch(meshes, subtype, aoaDeg) {
  const a = aoaDeg * Math.PI / 180;
  for (const part of buildSubtypeParts(subtype)) {
    if (part.id.startsWith('prop') && meshes[part.id]) {
      const rad = part.armAngleDeg * Math.PI / 180;
      const axis = new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)).normalize();
      meshes[part.id].setRotationFromAxisAngle(axis, a);
    }
  }
}

export { DRONES, buildSubtypeParts };
