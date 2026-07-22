import { describe, it, expect } from 'vitest';
import { DRONES, buildSubtypeParts, getSubtypeParts } from './drones.js';

describe('DRONES 数据', () => {
  it('多旋翼含四/六/八轴', () => {
    expect(Object.keys(DRONES.multirotor.subtypes)).toEqual(
      expect.arrayContaining(['quad', 'hexa', 'octa']),
    );
  });
  it('rotorCount 与轴数一致', () => {
    expect(DRONES.multirotor.subtypes.quad.rotorCount).toBe(4);
    expect(DRONES.multirotor.subtypes.hexa.rotorCount).toBe(6);
    expect(DRONES.multirotor.subtypes.octa.rotorCount).toBe(8);
  });
});

describe('buildSubtypeParts', () => {
  it('八轴电机数量等于 rotorCount', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.octa);
    const motors = parts.filter((p) => p.id.startsWith('motor'));
    expect(motors).toHaveLength(8);
  });
  it('每个部件都有 name 与 geometry', () => {
    const parts = buildSubtypeParts(DRONES.multirotor.subtypes.quad);
    for (const p of parts) {
      expect(p.name).toBeTruthy();
      expect(p.geometry).toBeTruthy();
    }
  });
});

describe('DRONES.helicopter', () => {
  it('含 tailrotor 与 coaxial 两子类', () => {
    expect(Object.keys(DRONES.helicopter.subtypes)).toEqual(
      expect.arrayContaining(['tailrotor', 'coaxial']),
    );
  });
  it('tailrotor 有且仅有一个主旋翼与一个尾桨；coaxial 两主旋翼无尾桨', () => {
    const tr = getSubtypeParts(DRONES.helicopter.subtypes.tailrotor);
    expect(tr.filter((p) => p.mainRotor)).toHaveLength(1);
    expect(tr.filter((p) => p.tailRotor)).toHaveLength(1);
    const co = getSubtypeParts(DRONES.helicopter.subtypes.coaxial);
    expect(co.filter((p) => p.mainRotor)).toHaveLength(2);
    expect(co.filter((p) => p.tailRotor)).toHaveLength(0);
  });
  it('coaxial 两主旋翼 spin 相反', () => {
    const spins = getSubtypeParts(DRONES.helicopter.subtypes.coaxial)
      .filter((p) => p.mainRotor).map((p) => p.spin);
    expect(new Set(spins)).toEqual(new Set(['cw', 'ccw']));
  });
  it('getSubtypeParts 对多旋翼等价于 buildSubtypeParts', () => {
    const st = DRONES.multirotor.subtypes.quad;
    expect(getSubtypeParts(st)).toHaveLength(buildSubtypeParts(st).length);
  });
  it('每个直升机部件都有 name/desc/geometry', () => {
    for (const st of Object.values(DRONES.helicopter.subtypes)) {
      for (const p of getSubtypeParts(st)) {
        expect(p.name).toBeTruthy();
        expect(p.desc).toBeTruthy();
        expect(p.geometry).toBeTruthy();
      }
    }
  });
});
