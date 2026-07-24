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
  it('更多旋翼对应更高的固定设备和结构质量', () => {
    const { quad, hexa, octa } = DRONES.multirotor.subtypes;
    expect(hexa.massModel.fixedMass).toBeGreaterThan(quad.massModel.fixedMass);
    expect(octa.massModel.structuralVolume).toBeGreaterThan(hexa.massModel.structuralVolume);
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
  it('默认控件值就是各子类的真实主旋翼直径', () => {
    expect(DRONES.helicopter.subtypes.tailrotor.defaults.rotorDiameter).toBe(1.6);
    expect(DRONES.helicopter.subtypes.coaxial.defaults.rotorDiameter).toBe(1.4);
  });
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

describe('DRONES.vtol', () => {
  it('包含倾转旋翼与升力＋巡航两种典型构型', () => {
    expect(Object.keys(DRONES.vtol.subtypes)).toEqual(
      expect.arrayContaining(['tiltrotor', 'liftcruise']),
    );
  });

  it('倾转旋翼有两个可倾转旋翼', () => {
    const parts = getSubtypeParts(DRONES.vtol.subtypes.tiltrotor);
    expect(parts.filter((p) => p.tiltRotor)).toHaveLength(2);
  });

  it('升力＋巡航具有四个升力旋翼和一个独立推进桨', () => {
    const parts = getSubtypeParts(DRONES.vtol.subtypes.liftcruise);
    expect(parts.filter((p) => p.liftRotor)).toHaveLength(4);
    expect(parts.filter((p) => p.cruiseRotor)).toHaveLength(1);
  });

  it('两种构型均具有固定翼和完整部件说明', () => {
    for (const subtype of Object.values(DRONES.vtol.subtypes)) {
      const parts = getSubtypeParts(subtype);
      expect(parts.some((p) => p.fixedWing)).toBe(true);
      for (const part of parts) {
        expect(part.name).toBeTruthy();
        expect(part.desc).toBeTruthy();
        expect(part.geometry).toBeTruthy();
      }
    }
  });
});
