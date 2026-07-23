import * as THREE from 'three';
import { applyMaterial, applyBladeTwist, getSubtypeParts } from './builder/builder.js';
import {
  computeWeight, computeDrag, MATERIALS, perRotorLift, netLift, windVector3D, bladeLinearSpeed,
  mainRotorTorque, tailRotorThrust, yawRate, cyclicSplit, autorotation,
} from './aero/aero.js';
import { renderReadout } from './ui/ui.js';

export const BODY_VOLUME = 6.7;
export const HELI_BODY_VOLUME = 48;
const REF_AREA_SCALE = 0.02 / 0.42;
const AIR_DENSITY = 1.225;

export function createAttitude() {
  const qWind = new THREE.Quaternion();
  const qPitch = new THREE.Quaternion();
  const baseQuat = new THREE.Quaternion();
  const _axis = new THREE.Vector3();
  const _axisZ = new THREE.Vector3(0, 0, 1);
  return { qWind, qPitch, baseQuat, _axis, _axisZ };
}

function recomputeMulti(s, deps, attitude) {
  const { current, subtype, viz, panel, airfoil, aerochart } = deps;
  applyMaterial(current.meshes, subtype, s.materialId);
  const bladeKey = `${s.aoaDeg}:${s.rotorDiameter}`;
  if (current.bladeGeometryKey !== bladeKey) {
    applyBladeTwist(current.meshes, subtype, s.aoaDeg, s.rotorDiameter);
    current.bladeGeometryKey = bladeKey;
  }
  const aeroP = {
    bladeSpeed: bladeLinearSpeed(s.rpm, s.rotorDiameter),
    refArea: s.rotorDiameter * REF_AREA_SCALE,
    aoaDeg: s.aoaDeg, airDensity: AIR_DENSITY,
  };
  const single = perRotorLift(aeroP);
  const perLift = Array.from({ length: subtype.rotorCount }, () => single);
  const totalLift = single * subtype.rotorCount;
  const weight = computeWeight({ bodyVolume: BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: AIR_DENSITY });
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  const wr = s.windDirDeg * Math.PI / 180;
  attitude.qWind.setFromAxisAngle(attitude._axis.set(Math.sin(wr), 0, -Math.cos(wr)), net.tiltDeg * Math.PI / 180);
  attitude.qPitch.identity();
  attitude.baseQuat.copy(attitude.qWind).multiply(attitude.qPitch);
  viz.update({ perLift, totalLift, effectiveLift: net.effectiveLift, weight, wind });
  const aeroDrag = computeDrag({ ...aeroP, rotorCount: subtype.rotorCount });
  renderReadout(panel.querySelector('#readout'), { totalLift, net, weight, aoaDeg: s.aoaDeg, aeroDrag, material: MATERIALS[s.materialId] });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
  return { yawRate: 0, rpmFactor: 1 };
}

function recomputeHeli(s, deps, attitude) {
  const { current, subtype, viz, heliViz, panel, airfoil, aerochart } = deps;
  if (!heliViz) return { yawRate: 0, rpmFactor: 1 };
  applyMaterial(current.meshes, subtype, s.materialId);
  const mainDiameter = subtype.mainRotorDiameter * (s.rotorDiameter / 0.42);
  const bladeKey = `${s.aoaDeg}:${mainDiameter}`;
  if (current.bladeGeometryKey !== bladeKey) {
    applyBladeTwist(current.meshes, subtype, s.aoaDeg, mainDiameter);
    current.bladeGeometryKey = bladeKey;
  }
  const auto = autorotation({ engineOn: s.engineOn, aoaDeg: s.aoaDeg });
  const effectiveRpm = s.rpm * auto.rpmFactor;
  const aeroP = { bladeSpeed: bladeLinearSpeed(effectiveRpm, mainDiameter), refArea: mainDiameter * REF_AREA_SCALE, aoaDeg: s.aoaDeg, airDensity: AIR_DENSITY };
  const nRotor = subtype.config === 'coaxial' ? 2 * 0.85 : 1;
  const totalLift = perRotorLift(aeroP) * nRotor;
  const cyc = cyclicSplit(totalLift, s.cyclicDeg);
  const weight = computeWeight({ bodyVolume: HELI_BODY_VOLUME, materialId: s.materialId });
  const net = netLift({ totalLift: cyc.vertical, weight, windSpeed: s.windSpeed, updraft: s.updraft ?? 0, airDensity: AIR_DENSITY });
  const torque = subtype.config === 'coaxial' ? 0 : mainRotorTorque(totalLift, mainDiameter);
  const tailThrust = subtype.config === 'tailrotor' ? tailRotorThrust(s.tailPitch, effectiveRpm) : null;
  const yr = subtype.config === 'tailrotor'
    ? yawRate({ torque, tailThrust, tailArm: subtype.tailArm })
    : 0;
  const wr = s.windDirDeg * Math.PI / 180;
  attitude.qWind.setFromAxisAngle(attitude._axis.set(Math.sin(wr), 0, -Math.cos(wr)), net.tiltDeg * Math.PI / 180);
  attitude.qPitch.setFromAxisAngle(attitude._axisZ, -s.cyclicDeg * Math.PI / 180);
  attitude.baseQuat.copy(attitude.qWind).multiply(attitude.qPitch);
  const wind = windVector3D(s.windSpeed, s.windDirDeg, s.updraft ?? 0);
  const rotorN = subtype.config === 'coaxial' ? 2 : 1;
  const perLift = Array.from({ length: rotorN }, () => totalLift / rotorN);
  viz.update({ perLift, totalLift: cyc.vertical, effectiveLift: net.effectiveLift, weight, wind, flowDir: auto.mode === 'powered' ? 1 : -1 });
  heliViz.update({ torque, tailThrust: tailThrust ?? 0 });
  const aeroDrag = computeDrag({ ...aeroP, rotorCount: 1 });
  const yawState = subtype.config === 'coaxial' ? null : Math.abs(yr) < 0.02 ? 'balanced' : yr > 0 ? 'spinLeft' : 'spinRight';
  renderReadout(panel.querySelector('#readout'), {
    totalLift, net, weight, aoaDeg: s.aoaDeg, aeroDrag, material: MATERIALS[s.materialId],
    heli: { torque, tailThrust, yawState, forward: cyc.forward, mode: auto.mode, descentRate: auto.descentRate },
  });
  airfoil.draw(s.aoaDeg);
  aerochart.draw(s.aoaDeg);
  return { yawRate: yr, rpmFactor: auto.rpmFactor };
}

export function recompute(s, deps, attitude) {
  if (s.category === 'helicopter') return recomputeHeli(s, deps, attitude);
  return recomputeMulti(s, deps, attitude);
}
